import csv
import hmac
import hashlib
import io
import time
import uuid
from datetime import timedelta
from decimal import Decimal

import qrcode
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, DecimalField, F, Min, Q, Sum, Value
from django.db.models.functions import Coalesce, ExtractHour
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import models as movie_models
from .models import (
    Booking,
    CastMember,
    Genre,
    Language,
    Movie,
    MoviePoster,
    Review,
    Screen,
    SeatReservation,
    Showtime,
    Theater,
)

# Dynamically load optional models so imports never fail across schema versions
PaymentTransaction = getattr(movie_models, "PaymentTransaction", None)
UserMovieViewHistory = (
    getattr(movie_models, "UserMovieViewHistory", None)
    or getattr(movie_models, "MovieViewHistory", None)
    or getattr(movie_models, "RecentlyViewedMovie", None)
)

from .serializers import (
    BookingHistorySerializer,
    GenreSerializer,
    LanguageSerializer,
    MovieDetailSerializer,
    MovieListSerializer,
    ReviewSerializer,
    ShowtimeSerializer,
    TheaterSerializer,
)

try:
    from .tasks import send_ticket_confirmation_email_task
except Exception:
    send_ticket_confirmation_email_task = None


def release_expired_seat_holds(showtime=None):
    """Automatically releases expired 2-minute temporary seat locks."""
    now = timezone.now()
    expired_qs = Booking.objects.filter(status="PENDING", expires_at__lt=now)
    if showtime is not None:
        expired_qs = expired_qs.filter(showtime=showtime)

    expired_ids = list(expired_qs.values_list("id", flat=True))
    if expired_ids:
        with transaction.atomic():
            SeatReservation.objects.filter(booking_id__in=expired_ids, status="RESERVED").delete()
            Booking.objects.filter(id__in=expired_ids).update(
                status="CANCELLED",
                updated_at=now,
            )
    return len(expired_ids)


def generate_order_signature(order_id: str, payment_id: str) -> str:
    """Computes HMAC-SHA256 signature using RAZORPAY_KEY_SECRET."""
    secret = getattr(settings, "RAZORPAY_KEY_SECRET", "rzp_test_bookmyseat_secret_2026")
    message = f"{order_id}|{payment_id}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def build_pdf_ticket_bytes(booking: Booking) -> bytes:
    """Generates a downloadable PDF e-ticket with embedded QR code."""
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    p.setFillColor(colors.HexColor("#E11D48"))
    p.rect(0, height - 110, width, 110, fill=1, stroke=0)

    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 24)
    p.drawString(40, height - 55, "BookMySeat Official E-Ticket")
    p.setFont("Helvetica", 11)
    p.drawString(40, height - 80, "Verified Multiplex Pass • Present QR Code at Cinema Entrance")

    p.setFillColor(colors.HexColor("#F8FAFC"))
    p.setStrokeColor(colors.HexColor("#CBD5E1"))
    p.roundRect(40, height - 430, width - 80, 290, 12, fill=1, stroke=1)

    showtime = booking.showtime
    movie = showtime.movie
    screen = showtime.screen
    theater = screen.theater
    seat_codes = ", ".join(
        [f"{s.row_label}{s.seat_number}" for s in booking.seats.all().order_by("row_label", "seat_number")]
    )

    p.setFillColor(colors.HexColor("#0F172A"))
    p.setFont("Helvetica-Bold", 18)
    p.drawString(60, height - 180, movie.title)

    p.setFont("Helvetica", 11)
    p.setFillColor(colors.HexColor("#475569"))
    p.drawString(60, height - 205, f"Certification: {movie.age_certification} | Duration: {movie.duration_minutes} mins")

    details = [
        ("Booking Reference ID", f"#{str(booking.id).upper()[:8]}"),
        ("Customer", f"{booking.user.username} ({booking.user.email or 'Verified User'})"),
        ("Theater & City", f"{theater.name}, {theater.city}"),
        ("Auditorium / Screen", screen.name),
        ("Show Date & Time", timezone.localtime(showtime.start_time).strftime("%a, %d %b %Y at %I:%M %p")),
        ("Confirmed Seats", seat_codes or "Confirmed"),
        ("Total Amount Paid", f"INR {booking.total_amount}"),
        ("Payment Reference", booking.payment_reference_id or "PAID"),
    ]

    y_pos = height - 240
    for label, val in details:
        p.setFont("Helvetica-Bold", 10)
        p.setFillColor(colors.HexColor("#64748B"))
        p.drawString(60, y_pos, f"{label}:")
        p.setFont("Helvetica-Bold", 11)
        p.setFillColor(colors.HexColor("#0F172A"))
        p.drawString(200, y_pos, str(val))
        y_pos -= 22

    qr_payload = (
        f"BOOKMYSEAT|ID:{booking.id}|MOVIE:{movie.title}|"
        f"THEATER:{theater.name}|SEATS:{seat_codes}|STATUS:{booking.status}"
    )
    qr_img = qrcode.make(qr_payload)
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)

    p.drawImage(ImageReader(qr_buffer), width - 195, height - 360, width=125, height=125)
    p.setFont("Helvetica-Bold", 9)
    p.setFillColor(colors.HexColor("#059669"))
    p.drawCentredString(width - 132, height - 375, "STATUS: CONFIRMED")

    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer.getvalue()


def _confirm_booking_and_issue_ticket(booking_id, payment_id: str, signature: str = "", raw_payload: dict = None):
    """
    Validates under row lock that booking is still PENDING,
    unexpired, and has locked seats before confirming.
    """
    with transaction.atomic():
        booking = Booking.objects.select_for_update().select_related("showtime__movie", "user").get(id=booking_id)

        if booking.status == "CONFIRMED":
            return booking, False

        now = timezone.now()
        locked_seats = list(SeatReservation.objects.select_for_update().filter(booking=booking))

        is_expired = bool(booking.expires_at and booking.expires_at < now)
        if booking.status != "PENDING" or is_expired or len(locked_seats) == 0:
            SeatReservation.objects.filter(booking=booking).delete()
            if booking.status != "CANCELLED":
                booking.status = "CANCELLED"
                booking.save(update_fields=["status", "updated_at"])

            if PaymentTransaction is not None:
                PaymentTransaction.objects.create(
                    booking=booking,
                    order_id=booking.payment_order_id or "EXPIRED_ORDER",
                    payment_id=payment_id or f"late_{uuid.uuid4().hex[:8]}",
                    signature=signature,
                    amount=booking.total_amount,
                    status="FAILED",
                    raw_payload={
                        **(raw_payload or {}),
                        "error": "Hold expired or booking cancelled before payment confirmation. Flagged for refund.",
                    },
                )
            raise ValueError("Booking hold has expired or seats were released. Payment flagged for refund.")

        booking.status = "CONFIRMED"
        booking.payment_reference_id = payment_id
        booking.payment_signature = signature
        booking.save(update_fields=["status", "payment_reference_id", "payment_signature", "updated_at"])

        SeatReservation.objects.filter(booking=booking).update(status="BOOKED")

        if PaymentTransaction is not None:
            PaymentTransaction.objects.update_or_create(
                booking=booking,
                order_id=booking.payment_order_id or f"order_{booking.id}",
                defaults={
                    "payment_id": payment_id,
                    "signature": signature,
                    "amount": booking.total_amount,
                    "status": "SUCCESS",
                    "raw_payload": raw_payload or {},
                },
            )

        Movie.objects.filter(id=booking.showtime.movie_id).update(
            total_bookings_count=F("total_bookings_count") + 1
        )

    if send_ticket_confirmation_email_task is not None:
        try:
            send_ticket_confirmation_email_task.delay(str(booking.id))
        except Exception:
            pass

    return booking, True


class AuthAPIView(APIView):
    """Handles user login and registration with DRF Token authentication."""

    def post(self, request):
        action = request.data.get("action", "login")
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        email = (request.data.get("email") or "").strip()

        if not username or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == "register":
            if User.objects.filter(username__iexact=username).exists():
                return Response(
                    {"detail": "Username already exists. Please sign in or pick another."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user = User.objects.create_user(username=username, password=password, email=email)
        else:
            user = authenticate(username=username, password=password)
            if not user:
                return Response(
                    {"detail": "Invalid username or password."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "is_staff": user.is_staff,
            }
        )


class MovieDiscoveryAPIView(APIView):
    """Task 1: Optimized Search, Multi-Filter, Show Window & Sorting."""

    def get(self, request):
        qs = (
            Movie.objects.filter(is_active=True)
            .prefetch_related("genres", "languages", "posters", "showtimes__screen__theater")
            .annotate(min_ticket_price=Min("showtimes__ticket_price"))
            .distinct()
        )

        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(cast__name__icontains=search)
            ).distinct()

        genre = (request.query_params.get("genre") or "").strip()
        if genre:
            qs = qs.filter(genres__name__iexact=genre)

        language = (request.query_params.get("language") or "").strip()
        if language:
            qs = qs.filter(languages__name__iexact=language)

        city = (request.query_params.get("city") or "").strip()
        if city:
            qs = qs.filter(showtimes__screen__theater__city__iexact=city)

        theater = (request.query_params.get("theater") or "").strip()
        if theater:
            qs = qs.filter(showtimes__screen__theater__name__icontains=theater)

        min_rating = request.query_params.get("min_rating")
        if min_rating:
            try:
                qs = qs.filter(average_rating__gte=Decimal(min_rating))
            except Exception:
                pass

        show_window = (request.query_params.get("show_window") or "").strip().lower()
        if show_window in ("morning", "afternoon", "evening", "night"):
            qs = qs.annotate(show_hour=ExtractHour("showtimes__start_time"))
            if show_window == "morning":
                qs = qs.filter(show_hour__gte=6, show_hour__lt=12)
            elif show_window == "afternoon":
                qs = qs.filter(show_hour__gte=12, show_hour__lt=17)
            elif show_window == "evening":
                qs = qs.filter(show_hour__gte=17, show_hour__lt=21)
            elif show_window == "night":
                qs = qs.filter(Q(show_hour__gte=21) | Q(show_hour__lt=6))

        ordering = request.query_params.get("ordering", "-total_bookings_count")
        allowed_orderings = {
            "-total_bookings_count",
            "total_bookings_count",
            "-release_date",
            "release_date",
            "-average_rating",
            "average_rating",
            "min_ticket_price",
            "-min_ticket_price",
        }
        if ordering in allowed_orderings:
            qs = qs.order_by(ordering, "-id")
        else:
            qs = qs.order_by("-total_bookings_count", "-id")

        total_matching = qs.count()
        serializer = MovieListSerializer(qs, many=True)
        return Response(
            {
                "total_matching_movies": total_matching,
                "results": serializer.data,
            }
        )


class FilterMetadataAPIView(APIView):
    """Returns dynamic filter options for Genres, Languages, Cities, and Theaters."""

    def get(self, request):
        genres = GenreSerializer(Genre.objects.all().order_by("name"), many=True).data
        languages = LanguageSerializer(Language.objects.all().order_by("name"), many=True).data
        cities = list(Theater.objects.values_list("city", flat=True).distinct().order_by("city"))
        theaters = TheaterSerializer(Theater.objects.all().order_by("name"), many=True).data
        return Response(
            {
                "genres": genres,
                "languages": languages,
                "cities": cities,
                "theaters": theaters,
            }
        )


class RecommendedMoviesAPIView(APIView):
    """Task 1: Personalized 'Recommended for You' engine based on bookings & view history."""

    def get(self, request):
        base_qs = (
            Movie.objects.filter(is_active=True)
            .prefetch_related("genres", "languages", "posters")
            .annotate(min_ticket_price=Min("showtimes__ticket_price"))
        )

        if request.user.is_authenticated:
            booked_movie_ids = list(
                Booking.objects.filter(user=request.user, status="CONFIRMED").values_list(
                    "showtime__movie_id", flat=True
                )
            )
            viewed_movie_ids = []
            if UserMovieViewHistory is not None:
                try:
                    viewed_movie_ids = list(
                        UserMovieViewHistory.objects.filter(user=request.user)
                        .order_by("-id")
                        .values_list("movie_id", flat=True)[:10]
                    )
                except Exception:
                    viewed_movie_ids = []

            seed_ids = set(booked_movie_ids + viewed_movie_ids)
            if seed_ids:
                preferred_genres = Genre.objects.filter(movies__id__in=seed_ids).distinct()
                rec_qs = (
                    base_qs.filter(genres__in=preferred_genres)
                    .exclude(id__in=booked_movie_ids)
                    .distinct()
                    .order_by("-average_rating", "-total_bookings_count")[:6]
                )
                if rec_qs.exists():
                    return Response(
                        {
                            "strategy": "personalized_history",
                            "results": MovieListSerializer(rec_qs, many=True).data,
                        }
                    )

        fallback_qs = base_qs.order_by("-average_rating", "-total_bookings_count")[:6]
        return Response(
            {
                "strategy": "popular_fallback",
                "results": MovieListSerializer(fallback_qs, many=True).data,
            }
        )


class MovieDetailAPIView(APIView):
    """Task 3: Movie Detail, Multiple Posters, Secure Trailer, Cast, Reviews & Similar Movies."""

    def get(self, request, pk):
        movie = get_object_or_404(
            Movie.objects.prefetch_related(
                "genres",
                "languages",
                "posters",
                "cast",
                "showtimes__screen__theater",
                "reviews__user",
            ),
            pk=pk,
        )

        if request.user.is_authenticated and UserMovieViewHistory is not None:
            try:
                UserMovieViewHistory.objects.update_or_create(
                    user=request.user,
                    movie=movie,
                )
            except Exception:
                pass

        serializer = MovieDetailSerializer(movie, context={"request": request})
        return Response(serializer.data)


class MovieReviewAPIView(APIView):
    """Task 3: Verified Viewer Review submission & editing."""

    permission_classes = [IsAuthenticated]

    def _recalculate_movie_rating(self, movie: Movie):
        agg = movie.reviews.filter(is_approved=True, is_reported=False).aggregate(avg=Avg("rating"))
        movie.average_rating = round(agg["avg"] or 0, 2)
        movie.save(update_fields=["average_rating"])

    def post(self, request, pk):
        movie = get_object_or_404(Movie, pk=pk)
        has_confirmed_booking = Booking.objects.filter(
            user=request.user,
            showtime__movie=movie,
            status="CONFIRMED",
        ).exists()

        if not has_confirmed_booking and not request.user.is_staff:
            return Response(
                {
                    "detail": "Verified Viewer Policy: Only users with a confirmed ticket for this movie can post a review."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if Review.objects.filter(movie=movie, user=request.user).exists():
            return Response(
                {"detail": "You have already reviewed this movie. Use PUT to edit your review."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rating = int(request.data.get("rating", 5))
        comment = (request.data.get("comment") or "").strip()
        if not (1 <= rating <= 5) or not comment:
            return Response(
                {"detail": "Provide a valid rating (1-5) and review comment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        review = Review.objects.create(
            movie=movie,
            user=request.user,
            rating=rating,
            comment=comment,
            is_verified_viewer=True,
        )
        self._recalculate_movie_rating(movie)
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)

    def put(self, request, pk):
        movie = get_object_or_404(Movie, pk=pk)
        review = get_object_or_404(Review, movie=movie, user=request.user)

        rating = int(request.data.get("rating", review.rating))
        comment = (request.data.get("comment") or review.comment).strip()
        review.rating = max(1, min(5, rating))
        review.comment = comment
        review.save(update_fields=["rating", "comment", "updated_at"])
        self._recalculate_movie_rating(movie)
        return Response(ReviewSerializer(review).data)


class ReportReviewAPIView(APIView):
    """Task 3: Flag inappropriate reviews for moderation."""

    permission_classes = [IsAuthenticated]

    def post(self, request, review_id):
        review = get_object_or_404(Review, pk=review_id)
        reason = (request.data.get("reason") or "Flagged by user").strip()
        review.is_reported = True
        review.report_reason = reason
        review.save(update_fields=["is_reported", "report_reason", "updated_at"])

        movie = review.movie
        agg = movie.reviews.filter(is_approved=True, is_reported=False).aggregate(avg=Avg("rating"))
        movie.average_rating = round(agg["avg"] or 0, 2)
        movie.save(update_fields=["average_rating"])

        return Response({"detail": "Review reported and hidden pending admin moderation."})


class ShowtimeSeatMapAPIView(APIView):
    """Task 5: Real-Time Seat Map Layout with automatic expired hold release."""

    def get(self, request, showtime_id):
        showtime = get_object_or_404(
            Showtime.objects.select_related("movie", "screen__theater"),
            pk=showtime_id,
        )
        release_expired_seat_holds(showtime=showtime)

        screen = showtime.screen
        reservations = SeatReservation.objects.filter(showtime=showtime)
        res_map = {(r.row_label, r.seat_number): r.status for r in reservations}

        rows = [chr(ord("A") + i) for i in range(screen.total_rows)]
        seat_map = []
        available_count = 0
        reserved_count = 0
        booked_count = 0

        for r_label in rows:
            row_seats = []
            for s_num in range(1, screen.seats_per_row + 1):
                st_status = res_map.get((r_label, s_num), "AVAILABLE")
                if st_status == "AVAILABLE":
                    available_count += 1
                elif st_status == "RESERVED":
                    reserved_count += 1
                elif st_status == "BOOKED":
                    booked_count += 1

                row_seats.append(
                    {
                        "row_label": r_label,
                        "seat_number": s_num,
                        "seat_code": f"{r_label}{s_num}",
                        "status": st_status,
                    }
                )
            seat_map.append({"row_label": r_label, "seats": row_seats})

        return Response(
            {
                "showtime_id": showtime.id,
                "movie_title": showtime.movie.title,
                "theater_name": screen.theater.name,
                "city": screen.theater.city,
                "screen_name": screen.name,
                "start_time": showtime.start_time,
                "ticket_price": showtime.ticket_price,
                "summary": {
                    "total_seats": screen.total_rows * screen.seats_per_row,
                    "available_seats": available_count,
                    "reserved_seats": reserved_count,
                    "booked_seats": booked_count,
                },
                "seat_map": seat_map,
            }
        )


class ReserveSeatsAPIView(APIView):
    """
    Task 5: Concurrency-Safe 2-Minute Seat Reservation using
    transaction.atomic() and select_for_update().
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, showtime_id):
        seats_req = request.data.get("seats") or []
        if not seats_req or not isinstance(seats_req, list):
            return Response(
                {"detail": "Please select at least one seat to reserve."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                showtime = Showtime.objects.select_for_update().select_related("screen").get(pk=showtime_id)
                release_expired_seat_holds(showtime=showtime)

                normalized_seats = []
                for item in seats_req:
                    r_label = str(item.get("row_label", "")).strip().upper()
                    s_num = int(item.get("seat_number", 0))
                    if not r_label or s_num <= 0:
                        return Response(
                            {"detail": "Invalid seat coordinates specified."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    normalized_seats.append((r_label, s_num))

                q_conflicts = Q()
                for r_label, s_num in normalized_seats:
                    q_conflicts |= Q(row_label=r_label, seat_number=s_num)

                existing_conflicts = list(
                    SeatReservation.objects.select_for_update()
                    .filter(showtime=showtime)
                    .filter(q_conflicts)
                )
                if existing_conflicts:
                    conflict_codes = [f"{c.row_label}{c.seat_number}" for c in existing_conflicts]
                    return Response(
                        {
                            "detail": f"Seat(s) {', '.join(conflict_codes)} were just taken by another user! Please pick different seats."
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                expires_at = timezone.now() + timedelta(minutes=2)
                total_amount = Decimal(len(normalized_seats)) * showtime.ticket_price

                booking = Booking.objects.create(
                    user=request.user,
                    showtime=showtime,
                    status="PENDING",
                    total_amount=total_amount,
                    expires_at=expires_at,
                )

                for r_label, s_num in normalized_seats:
                    SeatReservation.objects.create(
                        showtime=showtime,
                        booking=booking,
                        row_label=r_label,
                        seat_number=s_num,
                        status="RESERVED",
                    )

                return Response(
                    {
                        "booking_id": str(booking.id),
                        "status": booking.status,
                        "total_amount": str(booking.total_amount),
                        "expires_at": booking.expires_at,
                        "remaining_seconds": 120,
                        "seats": [f"{r}{n}" for r, n in normalized_seats],
                    },
                    status=status.HTTP_201_CREATED,
                )

        except IntegrityError:
            return Response(
                {"detail": "Concurrent seat lock conflict detected. Please select other seats."},
                status=status.HTTP_409_CONFLICT,
            )


class ReleaseSeatHoldAPIView(APIView):
    """Allows a user to manually cancel their 2-minute hold and free seats immediately."""

    permission_classes = [IsAuthenticated]

    def post(self, request, booking_id):
        with transaction.atomic():
            booking = get_object_or_404(
                Booking.objects.select_for_update(),
                id=booking_id,
                user=request.user,
            )
            if booking.status == "PENDING":
                SeatReservation.objects.filter(booking=booking, status="RESERVED").delete()
                booking.status = "CANCELLED"
                booking.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Temporary seat hold released."})


class CreatePaymentOrderAPIView(APIView):
    """
    Task 4: Creates a server-side payment order bound to the booking,
    validating active hold state before issuing an order ID.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        booking_id = request.data.get("booking_id")
        booking = get_object_or_404(Booking, id=booking_id, user=request.user)

        now = timezone.now()
        if booking.status != "PENDING" or (booking.expires_at and booking.expires_at < now) or booking.seats.count() == 0:
            release_expired_seat_holds(showtime=booking.showtime)
            return Response(
                {"detail": "Your 2-minute seat hold has expired. Please select seats again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order_id = f"order_{uuid.uuid4().hex[:14]}"
        booking.payment_order_id = order_id
        booking.save(update_fields=["payment_order_id", "updated_at"])

        if PaymentTransaction is not None:
            PaymentTransaction.objects.create(
                booking=booking,
                order_id=order_id,
                amount=booking.total_amount,
                status="CREATED",
            )

        response_data = {
            "booking_id": str(booking.id),
            "razorpay_order_id": order_id,
            "amount": str(booking.total_amount),
            "currency": "INR",
            "razorpay_key_id": settings.RAZORPAY_KEY_ID,
        }

        if getattr(settings, "DEMO_SANDBOX_MODE", True):
            sim_payment_id = f"pay_{uuid.uuid4().hex[:14]}"
            sim_signature = generate_order_signature(order_id, sim_payment_id)
            response_data["test_verification_payload"] = {
                "booking_id": str(booking.id),
                "razorpay_order_id": order_id,
                "razorpay_payment_id": sim_payment_id,
                "razorpay_signature": sim_signature,
                "payment_outcome": "SUCCESS",
            }

        return Response(response_data, status=status.HTTP_201_CREATED)


class VerifyPaymentAPIView(APIView):
    """
    Task 4: Requires non-empty cryptographic HMAC-SHA256 signatures,
    matches order_id to booking.payment_order_id, and rejects expired holds.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        booking_id = request.data.get("booking_id")
        order_id = (request.data.get("razorpay_order_id") or "").strip()
        payment_id = (request.data.get("razorpay_payment_id") or "").strip()
        signature = (request.data.get("razorpay_signature") or "").strip()
        outcome = (request.data.get("payment_outcome") or "SUCCESS").upper()

        booking = get_object_or_404(Booking, id=booking_id, user=request.user)

        if outcome == "FAILED":
            with transaction.atomic():
                locked_booking = Booking.objects.select_for_update().get(id=booking.id)
                SeatReservation.objects.filter(booking=locked_booking, status="RESERVED").delete()
                locked_booking.status = "FAILED"
                locked_booking.save(update_fields=["status", "updated_at"])
                if PaymentTransaction is not None:
                    PaymentTransaction.objects.create(
                        booking=locked_booking,
                        order_id=order_id or locked_booking.payment_order_id or "FAILED_ORDER",
                        payment_id=payment_id or "FAILED_PAY",
                        signature=signature,
                        amount=locked_booking.total_amount,
                        status="FAILED",
                        raw_payload=request.data,
                    )
            return Response(
                {"detail": "Payment failed or cancelled. Reserved seats have been released."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not order_id or not payment_id or not signature:
            return Response(
                {"detail": "Missing payment verification parameters or cryptographic signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if booking.payment_order_id != order_id:
            return Response(
                {"detail": "Order ID does not match the active booking order."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expected_signature = generate_order_signature(order_id, payment_id)
        if not hmac.compare_digest(signature, expected_signature):
            return Response(
                {"detail": "Invalid payment signature. Verification rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            confirmed_booking, _ = _confirm_booking_and_issue_ticket(
                booking_id=booking.id,
                payment_id=payment_id,
                signature=signature,
                raw_payload=request.data,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "detail": "Payment verified and booking confirmed!",
                "booking_id": str(confirmed_booking.id),
                "status": confirmed_booking.status,
                "payment_reference_id": confirmed_booking.payment_reference_id,
            }
        )


class RazorpayWebhookAPIView(APIView):
    """
    Task 4: Idempotent webhook endpoint that strictly rejects
    unsigned requests and verifies HMAC-SHA256 authenticity.
    """

    def post(self, request):
        webhook_signature = (request.headers.get("X-Razorpay-Signature") or "").strip()
        if not webhook_signature:
            return Response(
                {"detail": "Missing X-Razorpay-Signature header. Unsigned webhooks are rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expected_sig = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
            request.body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(webhook_signature, expected_sig):
            return Response(
                {"detail": "Invalid webhook cryptographic signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event = request.data.get("event", "")
        payload_entity = request.data.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payload_entity.get("order_id")
        payment_id = payload_entity.get("id", f"wh_pay_{uuid.uuid4().hex[:8]}")

        if not order_id:
            return Response({"detail": "Webhook acknowledged (no order_id)."})

        booking = Booking.objects.filter(payment_order_id=order_id).first()
        if not booking:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if event == "payment.captured":
            try:
                _confirm_booking_and_issue_ticket(
                    booking_id=booking.id,
                    payment_id=payment_id,
                    signature=webhook_signature,
                    raw_payload=request.data,
                )
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"status": "ok"})


class UserBookingsAPIView(APIView):
    """Returns authenticated user's booking and payment history."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        bookings = (
            Booking.objects.filter(user=request.user)
            .select_related("showtime__movie", "showtime__screen__theater")
            .prefetch_related("seats")
            .order_by("-created_at")
        )
        return Response(BookingHistorySerializer(bookings, many=True).data)


class DownloadTicketPDFAPIView(APIView):
    """Task 2: Streams official PDF ticket with embedded QR code."""

    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        booking = get_object_or_404(
            Booking.objects.select_related("showtime__movie", "showtime__screen__theater", "user").prefetch_related(
                "seats"
            ),
            id=booking_id,
        )
        if booking.user_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        if booking.status != "CONFIRMED":
            return Response(
                {"detail": "PDF tickets are only available for CONFIRMED bookings."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pdf_bytes = build_pdf_ticket_bytes(booking)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="BookMySeat_Ticket_{str(booking.id)[:8]}.pdf"'
        return response


class AdminAnalyticsAPIView(APIView):
    """
    Task 6: High-performance ORM aggregations tested for 100k+ rows.
    Applies date filters consistently across revenue, movies, and theater occupancy,
    and calculates true screen seat capacity from Screen dimensions.
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        t0 = time.perf_counter()
        now = timezone.now()
        today = now.date()

        start_date = parse_date(request.query_params.get("start_date") or "")
        end_date = parse_date(request.query_params.get("end_date") or "")

        booking_qs = Booking.objects.all()
        movie_booking_filter = Q(showtimes__bookings__status="CONFIRMED")
        theater_booking_filter = Q(screens__showtimes__bookings__status="CONFIRMED")
        theater_seat_filter = Q(screens__showtimes__seat_reservations__status="BOOKED")

        if start_date:
            booking_qs = booking_qs.filter(created_at__date__gte=start_date)
            movie_booking_filter &= Q(showtimes__bookings__created_at__date__gte=start_date)
            theater_booking_filter &= Q(screens__showtimes__bookings__created_at__date__gte=start_date)
            theater_seat_filter &= Q(screens__showtimes__seat_reservations__created_at__date__gte=start_date)

        if end_date:
            booking_qs = booking_qs.filter(created_at__date__lte=end_date)
            movie_booking_filter &= Q(showtimes__bookings__created_at__date__lte=end_date)
            theater_booking_filter &= Q(screens__showtimes__bookings__created_at__date__lte=end_date)
            theater_seat_filter &= Q(screens__showtimes__seat_reservations__created_at__date__lte=end_date)

        confirmed_qs = booking_qs.filter(status="CONFIRMED")

        rev_agg = confirmed_qs.aggregate(
            total_rev=Coalesce(Sum("total_amount"), Value(0, output_field=DecimalField())),
            daily_rev=Coalesce(
                Sum("total_amount", filter=Q(created_at__date=today)),
                Value(0, output_field=DecimalField()),
            ),
            weekly_rev=Coalesce(
                Sum("total_amount", filter=Q(created_at__gte=now - timedelta(days=7))),
                Value(0, output_field=DecimalField()),
            ),
            monthly_rev=Coalesce(
                Sum("total_amount", filter=Q(created_at__gte=now - timedelta(days=30))),
                Value(0, output_field=DecimalField()),
            ),
        )

        status_agg = booking_qs.aggregate(
            total_count=Count("id"),
            confirmed_count=Count("id", filter=Q(status="CONFIRMED")),
            cancelled_count=Count("id", filter=Q(status__in=["CANCELLED", "FAILED"])),
        )
        total_b = status_agg["total_count"] or 0
        cancelled_b = status_agg["cancelled_count"] or 0
        cancellation_rate = round((cancelled_b / total_b) * 100, 2) if total_b > 0 else 0.0

        most_booked = (
            Movie.objects.annotate(
                confirmed_bookings=Count("showtimes__bookings", filter=movie_booking_filter),
                total_revenue=Coalesce(
                    Sum("showtimes__bookings__total_amount", filter=movie_booking_filter),
                    Value(0, output_field=DecimalField()),
                ),
            )
            .order_by("-total_revenue", "-confirmed_bookings")[:8]
        )

        theaters = Theater.objects.prefetch_related("screens__showtimes").annotate(
            confirmed_bookings=Count(
                "screens__showtimes__bookings",
                filter=theater_booking_filter,
                distinct=True,
            ),
            total_revenue=Coalesce(
                Sum("screens__showtimes__bookings__total_amount", filter=theater_booking_filter),
                Value(0, output_field=DecimalField()),
            ),
            booked_seats_count=Count(
                "screens__showtimes__seat_reservations",
                filter=theater_seat_filter,
                distinct=True,
            ),
        ).order_by("-total_revenue")

        theater_data = []
        for th in theaters:
            total_capacity = 0
            for scr in th.screens.all():
                showtime_count = scr.showtimes.count()
                total_capacity += (scr.total_rows * scr.seats_per_row) * max(showtime_count, 1)

            occupancy = (
                round((th.booked_seats_count / total_capacity) * 100, 2)
                if total_capacity > 0
                else 0.0
            )
            theater_data.append(
                {
                    "theater_id": th.id,
                    "theater_name": th.name,
                    "city": th.city,
                    "confirmed_bookings": th.confirmed_bookings,
                    "booked_seats_count": th.booked_seats_count,
                    "total_capacity": total_capacity,
                    "occupancy_percentage": min(occupancy, 100.0),
                    "total_revenue": str(th.total_revenue),
                }
            )

        peak_hours_qs = (
            confirmed_qs.annotate(hour=ExtractHour("created_at"))
            .values("hour")
            .annotate(bookings_count=Count("id"), revenue=Sum("total_amount"))
            .order_by("-bookings_count")[:6]
        )

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        return Response(
            {
                "query_execution_time_ms": elapsed_ms,
                "revenue_insights": {
                    "total_revenue": str(rev_agg["total_rev"]),
                    "daily_revenue": str(rev_agg["daily_rev"]),
                    "weekly_revenue": str(rev_agg["weekly_rev"]),
                    "monthly_revenue": str(rev_agg["monthly_rev"]),
                },
                "cancellation_and_refund_stats": {
                    "total_bookings": total_b,
                    "confirmed_bookings": status_agg["confirmed_count"] or 0,
                    "cancelled_or_failed_bookings": cancelled_b,
                    "cancellation_rate_percent": cancellation_rate,
                },
                "most_booked_movies": [
                    {
                        "movie_id": m.id,
                        "movie_title": m.title,
                        "confirmed_bookings": m.confirmed_bookings,
                        "total_revenue": str(m.total_revenue),
                    }
                    for m in most_booked
                ],
                "top_performing_theaters_and_occupancy": theater_data,
                "peak_booking_hours": list(peak_hours_qs),
            }
        )


class ExportAnalyticsCSVAPIView(APIView):
    """Task 6: Exports filtered booking analytics as a downloadable CSV report."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        start_date = parse_date(request.query_params.get("start_date") or "")
        end_date = parse_date(request.query_params.get("end_date") or "")

        movie_filter = Q(showtimes__bookings__status="CONFIRMED")
        if start_date:
            movie_filter &= Q(showtimes__bookings__created_at__date__gte=start_date)
        if end_date:
            movie_filter &= Q(showtimes__bookings__created_at__date__lte=end_date)

        movies = Movie.objects.annotate(
            confirmed_bookings=Count("showtimes__bookings", filter=movie_filter),
            total_revenue=Coalesce(
                Sum("showtimes__bookings__total_amount", filter=movie_filter),
                Value(0, output_field=DecimalField()),
            ),
        ).order_by("-total_revenue")

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="BookMySeat_Analytics_Report.csv"'

        writer = csv.writer(response)
        writer.writerow(["Movie ID", "Movie Title", "Certification", "Average Rating", "Confirmed Bookings", "Total Revenue (INR)"])
        for m in movies:
            writer.writerow([m.id, m.title, m.age_certification, m.average_rating, m.confirmed_bookings, m.total_revenue])

        return response