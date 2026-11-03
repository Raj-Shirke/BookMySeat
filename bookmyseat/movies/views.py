from django.db.models import Min, Q, Count
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Movie, Booking, RecentlyViewedMovie, Genre, Language, Theater
from .serializers import MovieListSerializer, GenreSerializer, LanguageSerializer
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
            # Fallback for anonymous users: Top rated & popular
            recommended = base_qs.order_by('-total_bookings_count', '-average_rating')[:8]
            return Response({
                'strategy': 'popular_fallback',
                'results': MovieListSerializer(recommended, many=True).data
            })

        # 1. Extract movie IDs from user's confirmed bookings and recently viewed history
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

        # 2. Find preferred genres and languages from interacted movies in a single query
        preferred_genres = Genre.objects.filter(movies__id__in=interacted_movie_ids).values_list('id', flat=True)
        preferred_languages = Language.objects.filter(movies__id__in=interacted_movie_ids).values_list('id', flat=True)

        # 3. Recommend unseen movies matching preferred genres/languages, ranked by relevance & popularity
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
    """Returns available genres, languages, and cities to populate frontend filter dropdowns."""
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