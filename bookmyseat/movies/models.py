import uuid
from datetime import timedelta
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import Avg


class Genre(models.Model):
    name = models.CharField(max_length=100, unique=True, db_index=True)

    def __str__(self):
        return self.name


class Language(models.Model):
    name = models.CharField(max_length=100, unique=True, db_index=True)

    def __str__(self):
        return self.name


class CastMember(models.Model):
    name = models.CharField(max_length=150)
    role_name = models.CharField(max_length=150, blank=True)
    photo_url = models.URLField(blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.role_name})" if self.role_name else self.name


class Movie(models.Model):
    CERTIFICATION_CHOICES = [
        ('U', 'U - Universal'),
        ('UA', 'U/A - Parental Guidance'),
        ('A', 'A - Adults Only'),
        ('S', 'S - Restricted'),
    ]

    title = models.CharField(max_length=255, db_index=True)
    description = models.TextField()
    genres = models.ManyToManyField(Genre, related_name='movies')
    languages = models.ManyToManyField(Language, related_name='movies')
    cast = models.ManyToManyField(CastMember, related_name='movies', blank=True)
    release_date = models.DateField(db_index=True)
    duration_minutes = models.PositiveIntegerField(help_text="Duration in minutes")
    age_certification = models.CharField(max_length=5, choices=CERTIFICATION_CHOICES, default='UA')
    trailer_youtube_url = models.URLField(help_text="Full YouTube URL or Embed URL")

    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00, db_index=True)
    total_bookings_count = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['-release_date', '-average_rating'], name='idx_movie_rel_rating'),
            models.Index(fields=['-total_bookings_count'], name='idx_movie_popularity'),
        ]

    def update_average_rating(self):
        avg = self.reviews.aggregate(avg_val=Avg('rating'))['avg_val'] or 0.00
        self.average_rating = round(avg, 2)
        self.save(update_fields=['average_rating'])

    def __str__(self):
        return self.title


class MoviePoster(models.Model):
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name='posters')
    image_url = models.URLField(help_text="Poster image URL")
    is_primary = models.BooleanField(default=False)

    def __str__(self):
        return f"Poster for {self.movie.title}"


class Theater(models.Model):
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=100, db_index=True)
    address = models.TextField()
    total_capacity = models.PositiveIntegerField(default=100)

    class Meta:
        indexes = [
            models.Index(fields=['city', 'name'], name='idx_theater_city_name'),
        ]

    def __str__(self):
        return f"{self.name} - {self.city}"


class Screen(models.Model):
    theater = models.ForeignKey(Theater, on_delete=models.CASCADE, related_name='screens')
    name = models.CharField(max_length=50, help_text="e.g., Screen 1, IMAX")
    rows = models.PositiveIntegerField(default=10)
    cols = models.PositiveIntegerField(default=12)

    @property
    def capacity(self):
        return self.rows * self.cols

    def __str__(self):
        return f"{self.theater.name} - {self.name}"


class Showtime(models.Model):
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name='showtimes')
    screen = models.ForeignKey(Screen, on_delete=models.CASCADE, related_name='showtimes')
    start_time = models.DateTimeField(db_index=True)
    ticket_price = models.DecimalField(max_digits=8, decimal_places=2, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['movie', 'start_time'], name='idx_show_movie_time'),
            models.Index(fields=['ticket_price'], name='idx_show_price'),
        ]

    def __str__(self):
        return f"{self.movie.title} at {self.screen} ({self.start_time.strftime('%Y-%m-%d %H:%M')})"


class Booking(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Payment'),
        ('CONFIRMED', 'Confirmed'),
        ('CANCELLED', 'Cancelled / Expired'),
        ('FAILED', 'Payment Failed'),
        ('REFUNDED', 'Refunded'),
    ]

    booking_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    showtime = models.ForeignKey(Showtime, on_delete=models.CASCADE, related_name='bookings')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING', db_index=True)

    payment_Order_id = models.CharField(max_length=150, blank=True, null=True, unique=True)
    payment_reference_id = models.CharField(max_length=150, blank=True, null=True, unique=True)

    expires_at = models.DateTimeField(blank=True, null=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'created_at'], name='idx_booking_status_date'),
            models.Index(fields=['showtime', 'status'], name='idx_booking_show_status'),
            models.Index(fields=['user', 'status'], name='idx_booking_user_status'),
        ]

    def save(self, *args, **kwargs):
        if not self.expires_at and self.status == 'PENDING':
            self.expires_at = timezone.now() + timedelta(minutes=2)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Booking {self.booking_id} - {self.user.username} ({self.status})"


class SeatReservation(models.Model):
    SEAT_STATUS = [
        ('RESERVED', 'Temporarily Reserved (2m Hold)'),
        ('BOOKED', 'Confirmed Booked'),
    ]

    showtime = models.ForeignKey(Showtime, on_delete=models.CASCADE, related_name='seat_reservations')
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='seats')
    row_label = models.CharField(max_length=5)
    seat_number = models.PositiveIntegerField()
    status = models.CharField(max_length=12, choices=SEAT_STATUS, default='RESERVED', db_index=True)
    locked_until = models.DateTimeField(db_index=True)

    class Meta:
        unique_together = ('showtime', 'row_label', 'seat_number')
        indexes = [
            models.Index(fields=['showtime', 'status', 'locked_until'], name='idx_seat_live_lookup'),
        ]

    def __str__(self):
        return f"{self.row_label}{self.seat_number} - {self.showtime} ({self.status})"


class Review(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField()
    is_verified_viewer = models.BooleanField(default=False)
    is_reported = models.BooleanField(default=False)
    report_reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'movie')

    def __str__(self):
        return f"{self.movie.title} - {self.rating}★ by {self.user.username}"


class RecentlyViewedMovie(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recently_viewed')
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE)
    viewed_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        unique_together = ('user', 'movie')
        ordering = ['-viewed_at']

class PaymentTransaction(models.Model):
    TRANSACTION_STATUS = [
        ('INITIATED', 'Initiated'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
        ('REFUNDED', 'Refunded'),
    ]

    transaction_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='transactions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payment_transactions')
    provider = models.CharField(max_length=20, default='RAZORPAY')
    gateway_order_id = models.CharField(max_length=150, db_index=True)
    gateway_payment_id = models.CharField(max_length=150, blank=True, null=True, unique=True)
    gateway_signature = models.CharField(max_length=255, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=15, choices=TRANSACTION_STATUS, default='INITIATED', db_index=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['gateway_order_id', 'status'], name='idx_payment_order_status'),
            models.Index(fields=['user', 'status'], name='idx_payment_user_status'),
        ]

    def __str__(self):
        return f"{self.gateway_order_id} - {self.status} (₹{self.amount})"