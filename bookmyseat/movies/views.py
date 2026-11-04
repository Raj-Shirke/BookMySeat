from django.db.models import Min, Q, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import (
    Movie, Booking, RecentlyViewedMovie, Genre,
    Language, Theater, Review
)
from .serializers import (
    MovieListSerializer, MovieDetailSerializer,
    GenreSerializer, LanguageSerializer, ReviewSerializer
)
from .filters import MovieDiscoveryFilter


class DynamicCountPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 50

    def get_paginated_response(self, data):
        return Response({
            'total_matching_movies': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
        })


class MovieDiscoveryListView(generics.ListAPIView):
    """
    Task 1: Movie Discovery with Search, Filters, Sorting, Dynamic Count & Pagination.
    Optimized with prefetch_related and Min('showtimes__ticket_price') annotation.
    """
    serializer_class = MovieListSerializer
    pagination_class = DynamicCountPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = MovieDiscoveryFilter
    search_fields = ['title', 'description', 'cast__name']
    ordering_fields = [
        'total_bookings_count',  # Popularity
        'release_date',          # Newest releases
        'average_rating',        # Rating
        'min_ticket_price',      # Ticket price
    ]
    ordering = ['-total_bookings_count', '-release_date']

    def get_queryset(self):
        return (
            Movie.objects.all()
            .prefetch_related('genres', 'languages', 'posters')
            .annotate(min_ticket_price=Min('showtimes__ticket_price'))
            .distinct()
        )


class RecommendedMoviesView(APIView):
    """
    Task 1: 'Recommended for You' section based on user's booking history
    and recently viewed movies. Falls back to top popular movies for guests.
    """
    def get(self, request):
        user = request.user
        base_qs = (
            Movie.objects.all()
            .prefetch_related('genres', 'languages', 'posters')
            .annotate(min_ticket_price=Min('showtimes__ticket_price'))
        )

        if not user.is_authenticated:
            recommended = base_qs.order_by('-total_bookings_count', '-average_rating')[:8]
            return Response({
                'strategy': 'popular_fallback',
                'results': MovieListSerializer(recommended, many=True).data
            })

        booked_movie_ids = list(
            Booking.objects.filter(user=user, status='CONFIRMED')
            .values_list('showtime__movie_id', flat=True)
        )
        viewed_movie_ids = list(
            RecentlyViewedMovie.objects.filter(user=user)
            .values_list('movie_id', flat=True)[:15]
        )
        interacted_movie_ids = set(booked_movie_ids + viewed_movie_ids)

        if not interacted_movie_ids:
            recommended = base_qs.order_by('-total_bookings_count', '-average_rating')[:8]
            return Response({
                'strategy': 'new_user_popular',
                'results': MovieListSerializer(recommended, many=True).data
            })

        preferred_genres = Genre.objects.filter(movies__id__in=interacted_movie_ids).values_list('id', flat=True)
        preferred_languages = Language.objects.filter(movies__id__in=interacted_movie_ids).values_list('id', flat=True)

        recommended = (
            base_qs.filter(
                Q(genres__id__in=preferred_genres) | Q(languages__id__in=preferred_languages)
            )
            .exclude(id__in=booked_movie_ids)
            .annotate(relevance_score=Count('genres', filter=Q(genres__id__in=preferred_genres)))
            .order_by('-relevance_score', '-average_rating', '-total_bookings_count')
            .distinct()[:8]
        )

        return Response({
            'strategy': 'personalized_history',
            'results': MovieListSerializer(recommended, many=True).data
        })


class FilterMetadataView(APIView):
    """Returns available genres, languages, cities, and theaters to populate frontend filter dropdowns."""
    def get(self, request):
        genres = GenreSerializer(Genre.objects.all(), many=True).data
        languages = LanguageSerializer(Language.objects.all(), many=True).data
        cities = list(Theater.objects.values_list('city', flat=True).distinct())
        theaters = list(Theater.objects.values('id', 'name', 'city'))
        return Response({
            'genres': genres,
            'languages': languages,
            'cities': cities,
            'theaters': theaters,
        })


class MovieDetailView(generics.RetrieveAPIView):
    """
    Task 3: Movie Details with secure YouTube embed, multiple posters, cast,
    show schedules, verified reviews, similar movies, trending & new releases.
    Also records RecentlyViewedMovie for Task 1 recommendations.
    """
    serializer_class = MovieDetailSerializer
    queryset = Movie.objects.prefetch_related(
        'genres', 'languages', 'cast', 'posters',
        'showtimes__screen__theater', 'reviews__user'
    )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_authenticated:
            RecentlyViewedMovie.objects.update_or_create(
                user=request.user,
                movie=instance,
                defaults={'viewed_at': timezone.now()}
            )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class MovieReviewCreateUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request, movie_id):
        reviews = Review.objects.filter(movie_id=movie_id, is_reported=False).select_related('user').order_by('-created_at')
        return Response(ReviewSerializer(reviews, many=True).data)

    def post(self, request, movie_id):
        movie = get_object_or_404(Movie, id=movie_id)

        has_watched = Booking.objects.filter(
            user=request.user,
            showtime__movie=movie,
            status='CONFIRMED',
            showtime__start_time__lte=timezone.now()
        ).exists()

        if not has_watched:
            return Response(
                {
                    "detail": "Verified Viewer Policy: You can only submit a review after booking and watching this movie."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        if Review.objects.filter(user=request.user, movie=movie).exists():
            return Response(
                {"detail": "You have already reviewed this movie. Use PUT/PATCH to edit your review."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ReviewSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(
                user=request.user,
                movie=movie,
                is_verified_viewer=True
            )
            movie.update_average_rating()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, movie_id):
        movie = get_object_or_404(Movie, id=movie_id)
        review = get_object_or_404(Review, user=request.user, movie=movie)

        serializer = ReviewSerializer(review, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            movie.update_average_rating()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    patch = put


class ReportReviewView(APIView):
    """
    Task 3: Report inappropriate review content for admin moderation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, review_id):
        review = get_object_or_404(Review, id=review_id)
        reason = request.data.get('reason', 'Inappropriate or spam content')
        review.is_reported = True
        review.report_reason = reason[:255]
        review.save(update_fields=['is_reported', 'report_reason'])
        return Response(
            {"detail": "Review has been flagged and reported for moderation."},
            status=status.HTTP_200_OK
        )