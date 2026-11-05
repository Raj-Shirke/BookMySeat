import re
from rest_framework import serializers
from .models import (
    Genre, Language, CastMember, Movie, MoviePoster,
    Theater, Screen, Showtime, Review, Booking, SeatReservation
)


class GenreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = ['id', 'name']


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ['id', 'name']


class CastMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = CastMember
        fields = ['id', 'name', 'role_name', 'photo_url']


class MoviePosterSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoviePoster
        fields = ['id', 'image_url', 'is_primary']


class ShowtimeDetailSerializer(serializers.ModelSerializer):
    theater_id = serializers.IntegerField(source='screen.theater.id', read_only=True)
    theater_name = serializers.CharField(source='screen.theater.name', read_only=True)
    city = serializers.CharField(source='screen.theater.city', read_only=True)
    screen_name = serializers.CharField(source='screen.name', read_only=True)

    class Meta:
        model = Showtime
        fields = [
            'id', 'theater_id', 'theater_name', 'city',
            'screen_name', 'start_time', 'ticket_price'
        ]


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id', 'username', 'rating', 'comment',
            'is_verified_viewer', 'is_reported', 'report_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'username', 'is_verified_viewer', 'is_reported', 'created_at', 'updated_at']


class MovieListSerializer(serializers.ModelSerializer):
    genres = GenreSerializer(many=True, read_only=True)
    languages = LanguageSerializer(many=True, read_only=True)
    posters = MoviePosterSerializer(many=True, read_only=True)
    min_ticket_price = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)

    class Meta:
        model = Movie
        fields = [
            'id', 'title', 'release_date', 'duration_minutes',
            'age_certification', 'average_rating', 'total_bookings_count',
            'min_ticket_price', 'genres', 'languages', 'posters'
        ]


class MovieDetailSerializer(serializers.ModelSerializer):
    genres = GenreSerializer(many=True, read_only=True)
    languages = LanguageSerializer(many=True, read_only=True)
    cast = CastMemberSerializer(many=True, read_only=True)
    posters = MoviePosterSerializer(many=True, read_only=True)
    showtimes = ShowtimeDetailSerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()
    secure_trailer_embed_url = serializers.SerializerMethodField()
    similar_movies = serializers.SerializerMethodField()
    trending_movies = serializers.SerializerMethodField()
    recently_released = serializers.SerializerMethodField()

    class Meta:
        model = Movie
        fields = [
            'id', 'title', 'description', 'release_date', 'duration_minutes',
            'age_certification', 'trailer_youtube_url', 'secure_trailer_embed_url',
            'average_rating', 'total_bookings_count', 'genres', 'languages',
            'cast', 'posters', 'showtimes', 'reviews',
            'similar_movies', 'trending_movies', 'recently_released'
        ]

    def get_secure_trailer_embed_url(self, obj):
        url = obj.trailer_youtube_url or ''
        match = re.search(r'(?:v=|youtu\.be/|embed/)([a-zA-Z0-9_-]{11})', url)
        if match:
            video_id = match.group(1)
            return f"https://www.youtube-nocookie.com/embed/{video_id}?rel=0&modestbranding=1"
        return url

    def get_reviews(self, obj):
        approved_reviews = obj.reviews.filter(is_reported=False).select_related('user').order_by('-created_at')
        return ReviewSerializer(approved_reviews, many=True).data

    def get_similar_movies(self, obj):
        genre_ids = obj.genres.values_list('id', flat=True)
        lang_ids = obj.languages.values_list('id', flat=True)
        similar = (
            Movie.objects.filter(genres__id__in=genre_ids, languages__id__in=lang_ids)
            .exclude(id=obj.id)
            .prefetch_related('genres', 'languages', 'posters')
            .distinct()
            .order_by('-average_rating', '-total_bookings_count')[:6]
        )
        return MovieListSerializer(similar, many=True).data

    def get_trending_movies(self, obj):
        trending = (
            Movie.objects.exclude(id=obj.id)
            .prefetch_related('genres', 'languages', 'posters')
            .order_by('-total_bookings_count', '-average_rating')[:6]
        )
        return MovieListSerializer(trending, many=True).data

    def get_recently_released(self, obj):
        recent = (
            Movie.objects.exclude(id=obj.id)
            .prefetch_related('genres', 'languages', 'posters')
            .order_by('-release_date')[:6]
        )
        return MovieListSerializer(recent, many=True).data


# --- TASK 5 SERIALIZERS: SMART SEAT RESERVATION ---

class SeatItemInputSerializer(serializers.Serializer):
    row_label = serializers.CharField(max_length=5)
    seat_number = serializers.IntegerField(min_value=1)


class SeatReservationRequestSerializer(serializers.Serializer):
    seats = SeatItemInputSerializer(many=True, allow_empty=False)
    booking_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_seats(self, value):
        seen = set()
        cleaned = []
        for item in value:
            row = item['row_label'].strip().upper()
            num = item['seat_number']
            key = (row, num)
            if key in seen:
                raise serializers.ValidationError(f"Duplicate seat {row}{num} in request.")
            seen.add(key)
            cleaned.append({'row_label': row, 'seat_number': num})
        return cleaned


class ReservedSeatOutputSerializer(serializers.ModelSerializer):
    seat_code = serializers.SerializerMethodField()

    class Meta:
        model = SeatReservation
        fields = ['id', 'row_label', 'seat_number', 'seat_code', 'status', 'locked_until']

    def get_seat_code(self, obj):
        return f"{obj.row_label}{obj.seat_number}"


class BookingReservationSerializer(serializers.ModelSerializer):
    seats = ReservedSeatOutputSerializer(many=True, read_only=True)
    movie_title = serializers.CharField(source='showtime.movie.title', read_only=True)
    theater_name = serializers.CharField(source='showtime.screen.theater.name', read_only=True)
    screen_name = serializers.CharField(source='showtime.screen.name', read_only=True)
    show_start_time = serializers.DateTimeField(source='showtime.start_time', read_only=True)
    remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'booking_id', 'status', 'movie_title', 'theater_name',
            'screen_name', 'show_start_time', 'total_amount',
            'expires_at', 'remaining_seconds', 'seats', 'created_at'
        ]

    def get_remaining_seconds(self, obj):
        from django.utils import timezone
        if obj.status != 'PENDING' or not obj.expires_at:
            return 0
        delta = (obj.expires_at - timezone.now()).total_seconds()
        return max(0, int(delta))