from django.urls import path
from .views import (
    MovieDiscoveryListView,
    RecommendedMoviesView,
    FilterMetadataView,
    MovieDetailView,
    MovieReviewCreateUpdateView,
    ReportReviewView,
    ShowtimeSeatLayoutView,
    ReserveSeatsView,
    ReleaseSeatReservationView,
    CreatePaymentOrderView,
    VerifyPaymentView,
    PaymentWebhookView,
    UserBookingAndPaymentHistoryView,
    DownloadPDFTicketView,
)

urlpatterns = [
    # Task 1 Endpoints: Discovery, Recommendations & Filter Metadata
    path('movies/discover/', MovieDiscoveryListView.as_view(), name='movie-discover'),
    path('movies/recommendations/', RecommendedMoviesView.as_view(), name='movie-recommendations'),
    path('movies/filters-metadata/', FilterMetadataView.as_view(), name='movie-filters-metadata'),

    # Task 3 Endpoints: Movie Details, Trailer, Verified Reviews & Moderation
    path('movies/<int:pk>/', MovieDetailView.as_view(), name='movie-detail'),
    path('movies/<int:movie_id>/reviews/', MovieReviewCreateUpdateView.as_view(), name='movie-reviews'),
    path('reviews/<int:review_id>/report/', ReportReviewView.as_view(), name='report-review'),

    # Task 5 Endpoints: Live Seat Map, 2-Minute Atomic Seat Reservation & Release
    path('showtimes/<int:showtime_id>/seats/', ShowtimeSeatLayoutView.as_view(), name='showtime-seats'),
    path('showtimes/<int:showtime_id>/reserve/', ReserveSeatsView.as_view(), name='showtime-reserve-seats'),
    path('bookings/<uuid:booking_id>/release/', ReleaseSeatReservationView.as_view(), name='booking-release-seats'),

    # Task 4 Endpoints: Razorpay Order Creation, Server-Side Verification, Webhooks & History
    path('payments/create-order/', CreatePaymentOrderView.as_view(), name='payment-create-order'),
    path('payments/verify/', VerifyPaymentView.as_view(), name='payment-verify'),
    path('payments/webhook/', PaymentWebhookView.as_view(), name='payment-webhook'),
    path('users/my-bookings/', UserBookingAndPaymentHistoryView.as_view(), name='user-booking-history'),

    # Task 2 Endpoint: Download PDF Ticket with QR Code
    path('bookings/<uuid:booking_id>/download-ticket/', DownloadPDFTicketView.as_view(), name='booking-download-ticket'),
]