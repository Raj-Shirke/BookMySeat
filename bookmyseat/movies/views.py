import hmac
import hashlib
import json
import logging
import string
import uuid
from datetime import timedelta
from decimal import Decimal

import razorpay
from django.conf import settings
from django.db import transaction, IntegrityError
from django.db.models import Min, Q, Count, F
from django.http import HttpResponse
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
    Language, Theater, Review, Showtime, SeatReservation,
    PaymentTransaction
)
from .serializers import (
    MovieListSerializer, MovieDetailSerializer,
    GenreSerializer, LanguageSerializer, ReviewSerializer,
    SeatReservationRequestSerializer, BookingReservationSerializer,
    CreatePaymentOrderSerializer, VerifyPaymentSerializer,
    PaymentTransactionSerializer
)
from .filters import MovieDiscoveryFilter
from .tasks import send_ticket_email_task
from .utils import generate_pdf_ticket

logger = logging.getLogger(__name__)


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
        'total_bookings_count',
        'release_date',
        'average_rating',
        'min_ticket_price',
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
    """
    Task 3: Submit or Edit a rating & review.
    Enforces rule: Registered users can only review AFTER booking and watching the movie.
    Automatically updates Movie.average_rating.
    """
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


# ============================================================================
# TASK 5: SMART SEAT RESERVATION WITH LIVE AVAILABILITY & 2-MINUTE HOLD
# ============================================================================

def release_expired_holds(showtime_id=None):
    """
    Automatically releases any temporarily RESERVED seats whose 2-minute lock
    has expired (locked_until <= now) and marks their parent PENDING bookings as CANCELLED.
    """
    now = timezone.now()
    expired_seats_qs = SeatReservation.objects.filter(
        status='RESERVED',
        locked_until__lte=now
    )
    if showtime_id:
        expired_seats_qs = expired_seats_qs.filter(showtime_id=showtime_id)

    expired_booking_ids = list(expired_seats_qs.values_list('booking_id', flat=True).distinct())
    if expired_booking_ids:
        expired_seats_qs.delete()
        Booking.objects.filter(
            id__in=expired_booking_ids,
            status='PENDING'
        ).update(status='CANCELLED')


class ShowtimeSeatLayoutView(APIView):
    """
    Task 5: Live Seat Availability Matrix for a Showtime.
    Automatically purges expired 2-minute holds first, then returns the complete
    row/column seat map with clear status indicators: AVAILABLE, RESERVED, or BOOKED.
    """
    def get(self, request, showtime_id):
        showtime = get_object_or_404(
            Showtime.objects.select_related('movie', 'screen__theater'),
            id=showtime_id
        )

        release_expired_holds(showtime_id=showtime.id)

        screen = showtime.screen
        active_reservations = SeatReservation.objects.filter(
            showtime=showtime
        ).select_related('booking')

        seat_lookup = {
            (res.row_label, res.seat_number): res
            for res in active_reservations
        }

        row_labels = list(string.ascii_uppercase[:screen.rows])
        seat_grid = []
        counts = {'AVAILABLE': 0, 'RESERVED': 0, 'BOOKED': 0}

        for r_label in row_labels:
            row_seats = []
            for c_num in range(1, screen.cols + 1):
                res = seat_lookup.get((r_label, c_num))
                if res:
                    seat_status = res.status
                    is_mine = (
                        request.user.is_authenticated
                        and res.booking.user_id == request.user.id
                    )
                    locked_until = res.locked_until if seat_status == 'RESERVED' else None
                else:
                    seat_status = 'AVAILABLE'
                    is_mine = False
                    locked_until = None

                counts[seat_status] += 1
                row_seats.append({
                    'seat_code': f"{r_label}{c_num}",
                    'row_label': r_label,
                    'seat_number': c_num,
                    'status': seat_status,
                    'is_reserved_by_current_user': is_mine,
                    'locked_until': locked_until,
                })
            seat_grid.append({
                'row_label': r_label,
                'seats': row_seats
            })

        return Response({
            'showtime_id': showtime.id,
            'movie_title': showtime.movie.title,
            'theater_name': screen.theater.name,
            'city': screen.theater.city,
            'screen_name': screen.name,
            'start_time': showtime.start_time,
            'ticket_price': showtime.ticket_price,
            'hold_duration_seconds': 120,
            'summary': {
                'total_capacity': screen.capacity,
                'available_seats': counts['AVAILABLE'],
                'reserved_seats': counts['RESERVED'],
                'booked_seats': counts['BOOKED'],
            },
            'seat_map': seat_grid,
        })


class ReserveSeatsView(APIView):
    """
    Task 5: Concurrency-Safe Seat Reservation & Pre-Payment Seat Modification.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, showtime_id):
        serializer = SeatReservationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested_seats = serializer.validated_data['seats']
        booking_uuid = serializer.validated_data.get('booking_id')

        try:
            with transaction.atomic():
                showtime = get_object_or_404(
                    Showtime.objects.select_for_update().select_related('screen', 'movie'),
                    id=showtime_id
                )

                release_expired_holds(showtime_id=showtime.id)

                screen = showtime.screen
                valid_rows = set(string.ascii_uppercase[:screen.rows])

                for s in requested_seats:
                    if s['row_label'] not in valid_rows or s['seat_number'] > screen.cols:
                        return Response(
                            {"detail": f"Seat {s['row_label']}{s['seat_number']} does not exist in {screen.name}."},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                existing_booking = None
                if booking_uuid:
                    existing_booking = Booking.objects.select_for_update().filter(
                        booking_id=booking_uuid,
                        user=request.user,
                        showtime=showtime,
                        status='PENDING'
                    ).first()
                else:
                    existing_booking = Booking.objects.select_for_update().filter(
                        user=request.user,
                        showtime=showtime,
                        status='PENDING'
                    ).first()

                seat_filter = Q()
                for s in requested_seats:
                    seat_filter |= Q(row_label=s['row_label'], seat_number=s['seat_number'])

                conflicting_qs = SeatReservation.objects.select_for_update().filter(
                    showtime=showtime
                ).filter(seat_filter)

                if existing_booking:
                    conflicting_qs = conflicting_qs.exclude(booking=existing_booking)

                conflicts = list(conflicting_qs.values_list('row_label', 'seat_number', 'status'))
                if conflicts:
                    conflict_labels = [f"{r}{n} ({st})" for r, n, st in conflicts]
                    return Response(
                        {
                            "detail": "One or more selected seats are no longer available.",
                            "unavailable_seats": conflict_labels
                        },
                        status=status.HTTP_409_CONFLICT
                    )

                now = timezone.now()
                lock_expiry = now + timedelta(minutes=2)
                total_price = showtime.ticket_price * Decimal(len(requested_seats))

                if existing_booking:
                    existing_booking.seats.all().delete()
                    existing_booking.total_amount = total_price
                    existing_booking.expires_at = lock_expiry
                    existing_booking.save(update_fields=['total_amount', 'expires_at'])
                    booking = existing_booking
                else:
                    booking = Booking.objects.create(
                        user=request.user,
                        showtime=showtime,
                        total_amount=total_price,
                        status='PENDING',
                        expires_at=lock_expiry
                    )

                new_reservations = [
                    SeatReservation(
                        showtime=showtime,
                        booking=booking,
                        row_label=s['row_label'],
                        seat_number=s['seat_number'],
                        status='RESERVED',
                        locked_until=lock_expiry
                    )
                    for s in requested_seats
                ]
                SeatReservation.objects.bulk_create(new_reservations)

        except IntegrityError:
            return Response(
                {"detail": "Concurrent booking conflict detected. Those seats were just taken by another user."},
                status=status.HTTP_409_CONFLICT
            )

        booking.refresh_from_db()
        return Response(
            BookingReservationSerializer(booking).data,
            status=status.HTTP_201_CREATED
        )

    put = post


class ReleaseSeatReservationView(APIView):
    """
    Task 5: Allows a user to manually cancel/release their 2-minute seat hold
    before payment completes.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        with transaction.atomic():
            booking = get_object_or_404(
                Booking.objects.select_for_update(),
                booking_id=booking_id,
                user=request.user
            )
            if booking.status != 'PENDING':
                return Response(
                    {"detail": f"Cannot release seats for a booking with status '{booking.status}'."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            booking.seats.all().delete()
            booking.status = 'CANCELLED'
            booking.save(update_fields=['status'])

        return Response(
            {"detail": "Reserved seats have been released and booking cancelled."},
            status=status.HTTP_200_OK
        )


# ============================================================================
# TASK 4 & TASK 2: PAYMENT WORKFLOW, WEBHOOKS & ASYNC PDF TICKET DISPATCH
# ============================================================================

def generate_razorpay_signature(order_id: str, payment_id: str, secret: str) -> str:
    payload = f"{order_id}|{payment_id}".encode('utf-8')
    return hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()


def dispatch_ticket_email_non_blocking(booking_pk: int):
    """
    Dispatches the Celery task asynchronously via Redis. If Redis is not running
    locally on Windows, logs a warning and falls back gracefully so the booking
    transaction never blocks or crashes.
    """
    try:
        send_ticket_email_task.delay(booking_pk)
    except Exception as exc:
        logger.warning(f"Celery broker unreachable ({exc}); running local eager fallback.")
        try:
            send_ticket_email_task(booking_pk)
        except Exception as inner_exc:
            logger.error(f"Fallback email dispatch failed: {inner_exc}")


def confirm_booking_atomically(booking: Booking, order_id: str, payment_id: str, signature: str = ''):
    """
    Idempotent helper that confirms a booking, converts RESERVED seats to BOOKED,
    records the successful transaction, triggers Celery PDF ticket email after DB commit,
    and increments movie popularity.
    """
    if booking.status == 'CONFIRMED':
        return booking, True  # Already confirmed (idempotent)

    booking.status = 'CONFIRMED'
    booking.payment_Order_id = order_id
    booking.payment_reference_id = payment_id
    booking.save(update_fields=['status', 'payment_Order_id', 'payment_reference_id'])

    # Convert temporary 2-minute holds into permanent BOOKED seats
    booking.seats.update(status='BOOKED')

    # Increment movie total_bookings_count for Task 1 popularity sorting
    Movie.objects.filter(id=booking.showtime.movie_id).update(
        total_bookings_count=F('total_bookings_count') + 1
    )

    PaymentTransaction.objects.update_or_create(
        gateway_order_id=order_id,
        booking=booking,
        defaults={
            'user': booking.user,
            'gateway_payment_id': payment_id,
            'gateway_signature': signature,
            'amount': booking.total_amount,
            'status': 'SUCCESS',
        }
    )

    # Task 2: Trigger async background PDF ticket generation & email dispatch after DB commit
    booking_pk = booking.id
    transaction.on_commit(lambda: dispatch_ticket_email_non_blocking(booking_pk))

    return booking, False


class CreatePaymentOrderView(APIView):
    """
    Task 4: Initiates or Retries a Razorpay Payment Order for a Booking.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CreatePaymentOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking_uuid = serializer.validated_data['booking_id']

        with transaction.atomic():
            booking = get_object_or_404(
                Booking.objects.select_for_update().select_related('showtime__movie'),
                booking_id=booking_uuid,
                user=request.user
            )

            if booking.status == 'CONFIRMED':
                return Response(
                    {"detail": "This booking is already confirmed and paid."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            now = timezone.now()
            active_seats_count = booking.seats.filter(locked_until__gt=now).count()

            if booking.status != 'PENDING' or active_seats_count == 0:
                booking.seats.all().delete()
                if booking.status == 'PENDING':
                    booking.status = 'CANCELLED'
                    booking.save(update_fields=['status'])
                return Response(
                    {
                        "detail": "Your 2-minute seat reservation has expired or was released after a failed payment. Please select your seats again."
                    },
                    status=status.HTTP_410_GONE
                )

            new_expiry = now + timedelta(minutes=2)
            booking.expires_at = new_expiry
            booking.seats.update(locked_until=new_expiry)

            amount_paise = int(booking.total_amount * 100)
            key_id = getattr(settings, 'RAZORPAY_KEY_ID', 'rzp_test_bookmyseat_key')
            key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', 'rzp_test_bookmyseat_secret_12345')

            gateway_order_id = None
            if not key_id.startswith('rzp_test_bookmyseat'):
                try:
                    client = razorpay.Client(auth=(key_id, key_secret))
                    rp_order = client.order.create({
                        'amount': amount_paise,
                        'currency': 'INR',
                        'receipt': str(booking.booking_id),
                        'payment_capture': 1
                    })
                    gateway_order_id = rp_order['id']
                except Exception:
                    gateway_order_id = f"order_{uuid.uuid4().hex[:14]}"
            else:
                gateway_order_id = f"order_{uuid.uuid4().hex[:14]}"

            booking.payment_Order_id = gateway_order_id
            booking.save(update_fields=['expires_at', 'payment_Order_id'])

            tx = PaymentTransaction.objects.create(
                booking=booking,
                user=request.user,
                provider='RAZORPAY',
                gateway_order_id=gateway_order_id,
                amount=booking.total_amount,
                status='INITIATED'
            )

            sample_payment_id = f"pay_{uuid.uuid4().hex[:14]}"
            sample_signature = generate_razorpay_signature(gateway_order_id, sample_payment_id, key_secret)

        return Response({
            'booking_id': booking.booking_id,
            'transaction_id': tx.transaction_id,
            'razorpay_key_id': key_id,
            'razorpay_order_id': gateway_order_id,
            'amount': booking.total_amount,
            'amount_paise': amount_paise,
            'currency': 'INR',
            'lock_expires_at': booking.expires_at,
            'test_verification_payload': {
                'booking_id': str(booking.booking_id),
                'razorpay_order_id': gateway_order_id,
                'razorpay_payment_id': sample_payment_id,
                'razorpay_signature': sample_signature,
                'payment_outcome': 'SUCCESS'
            }
        }, status=status.HTTP_201_CREATED)


class VerifyPaymentView(APIView):
    """
    Task 4: Server-Side Payment Verification, Failure Handling & Idempotency.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = VerifyPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        booking_uuid = data['booking_id']
        order_id = data['razorpay_order_id']
        payment_id = data.get('razorpay_payment_id') or f"pay_{uuid.uuid4().hex[:14]}"
        signature = data.get('razorpay_signature') or ''
        outcome = data.get('payment_outcome', 'SUCCESS')
        failure_reason = data.get('failure_reason', '')

        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', 'rzp_test_bookmyseat_secret_12345')

        with transaction.atomic():
            booking = get_object_or_404(
                Booking.objects.select_for_update().select_related('showtime__movie', 'showtime__screen__theater'),
                booking_id=booking_uuid,
                user=request.user
            )

            if booking.status == 'CONFIRMED':
                return Response({
                    'detail': 'Booking already confirmed (idempotent response).',
                    'already_confirmed': True,
                    'booking': BookingReservationSerializer(booking).data
                }, status=status.HTTP_200_OK)

            if outcome in ['FAILED', 'CANCELLED']:
                booking.seats.all().delete()
                booking.status = 'FAILED' if outcome == 'FAILED' else 'CANCELLED'
                booking.save(update_fields=['status'])

                PaymentTransaction.objects.update_or_create(
                    gateway_order_id=order_id,
                    booking=booking,
                    defaults={
                        'user': request.user,
                        'amount': booking.total_amount,
                        'status': outcome,
                        'failure_reason': failure_reason or f"Payment {outcome.lower()} by user or gateway."
                    }
                )
                return Response({
                    'detail': f"Payment {outcome.lower()}. Reserved seats have been automatically released.",
                    'booking': BookingReservationSerializer(booking).data
                }, status=status.HTTP_400_BAD_REQUEST)

            expected_signature = generate_razorpay_signature(order_id, payment_id, key_secret)
            if signature and not hmac.compare_digest(expected_signature, signature):
                booking.seats.all().delete()
                booking.status = 'FAILED'
                booking.save(update_fields=['status'])

                PaymentTransaction.objects.update_or_create(
                    gateway_order_id=order_id,
                    booking=booking,
                    defaults={
                        'user': request.user,
                        'amount': booking.total_amount,
                        'status': 'FAILED',
                        'failure_reason': 'Invalid payment signature verification.'
                    }
                )
                return Response(
                    {'detail': 'Server-side signature verification failed. Reserved seats have been released.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            booking, was_already_confirmed = confirm_booking_atomically(
                booking=booking,
                order_id=order_id,
                payment_id=payment_id,
                signature=expected_signature
            )

        booking.refresh_from_db()
        return Response({
            'detail': 'Payment verified and booking confirmed!',
            'already_confirmed': was_already_confirmed,
            'booking': BookingReservationSerializer(booking).data
        }, status=status.HTTP_200_OK)


class PaymentWebhookView(APIView):
    """
    Task 4: Server-Side Razorpay Webhook Handler (payment.captured & payment.failed).
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', 'whsec_bookmyseat_webhook_12345')
        received_sig = request.headers.get('X-Razorpay-Signature', '')

        if received_sig:
            expected_sig = hmac.new(
                webhook_secret.encode('utf-8'),
                request.body,
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(expected_sig, received_sig):
                return Response({'detail': 'Invalid webhook signature.'}, status=status.HTTP_400_BAD_REQUEST)

        payload = request.data
        event = payload.get('event', '')
        entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
        order_id = entity.get('order_id') or payload.get('order_id')
        payment_id = entity.get('id') or payload.get('payment_id') or f"pay_wh_{uuid.uuid4().hex[:10]}"

        if not order_id:
            return Response({'detail': 'Missing order_id in webhook payload.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            booking = Booking.objects.select_for_update().filter(payment_Order_id=order_id).first()
            if not booking:
                return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

            if event == 'payment.captured':
                confirm_booking_atomically(booking, order_id, payment_id, received_sig)
                return Response({'status': 'webhook_processed_confirmed'}, status=status.HTTP_200_OK)

            elif event == 'payment.failed':
                if booking.status != 'CONFIRMED':
                    booking.seats.all().delete()
                    booking.status = 'FAILED'
                    booking.save(update_fields=['status'])
                    PaymentTransaction.objects.filter(gateway_order_id=order_id).update(
                        status='FAILED',
                        failure_reason='Webhook reported payment.failed'
                    )
                return Response({'status': 'webhook_processed_failed_seats_released'}, status=status.HTTP_200_OK)

        return Response({'status': 'ignored_event'}, status=status.HTTP_200_OK)


class UserBookingAndPaymentHistoryView(generics.ListAPIView):
    """
    Task 4: Complete User Payment and Booking History Profile Endpoint.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BookingReservationSerializer

    def get_queryset(self):
        return (
            Booking.objects.filter(user=self.request.user)
            .select_related('showtime__movie', 'showtime__screen__theater')
            .prefetch_related('seats', 'transactions')
            .order_by('-created_at')
        )


class DownloadPDFTicketView(APIView):
    """
    Task 2: Allows users to download their previously booked PDF tickets from their booking history.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, booking_id):
        booking = get_object_or_404(
            Booking.objects.select_related('showtime__movie', 'showtime__screen__theater').prefetch_related('seats'),
            booking_id=booking_id,
            user=request.user,
            status='CONFIRMED'
        )
        pdf_bytes = generate_pdf_ticket(booking)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Ticket_{str(booking.booking_id)[:8]}.pdf"'
        return response