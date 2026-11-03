from django.contrib import admin
from .models import (
    Genre, Language, CastMember, Movie, MoviePoster,
    Theater, Screen, Showtime, Booking, SeatReservation,
    Review, RecentlyViewedMovie
)

class MoviePosterInline(admin.TabularInline):
    model = MoviePoster
    extra = 1

class ShowtimeInline(admin.TabularInline):
    model = Showtime
    extra = 1

@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    list_display = ('title', 'release_date', 'age_certification', 'duration_minutes', 'average_rating', 'total_bookings_count')
    list_filter = ('age_certification', 'release_date', 'genres', 'languages')
    search_fields = ('title', 'description')
    filter_horizontal = ('genres', 'languages', 'cast')
    inlines = [MoviePosterInline, ShowtimeInline]

class ScreenInline(admin.TabularInline):
    model = Screen
    extra = 1

@admin.register(Theater)
class TheaterAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'total_capacity')
    list_filter = ('city',)
    search_fields = ('name', 'city', 'address')
    inlines = [ScreenInline]

@admin.register(Showtime)
class ShowtimeAdmin(admin.ModelAdmin):
    list_display = ('movie', 'screen', 'start_time', 'ticket_price')
    list_filter = ('screen__theater__city', 'screen__theater', 'start_time')
    search_fields = ('movie__title', 'screen__theater__name')

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('movie', 'user', 'rating', 'is_verified_viewer', 'is_reported', 'created_at')
    list_filter = ('is_verified_viewer', 'is_reported', 'rating')
    search_fields = ('movie__title', 'user__username', 'comment')

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('booking_id', 'user', 'showtime', 'total_amount', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('booking_id', 'user__username', 'payment_reference_id')

admin.site.register(Genre)
admin.site.register(Language)
admin.site.register(CastMember)
admin.site.register(Screen)
admin.site.register(SeatReservation)
admin.site.register(RecentlyViewedMovie)