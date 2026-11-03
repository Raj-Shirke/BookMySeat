from rest_framework import serializers
from .models import (
    Genre, Language, CastMember, Movie, MoviePoster,
    Theater, Screen, Showtime, Review
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