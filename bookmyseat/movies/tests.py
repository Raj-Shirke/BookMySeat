from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from movies.models import Movie, Theater, Screen, Showtime, Booking


class BookMySeatSecurityAndConcurrencyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username="alice", password="Password123!")
        self.user2 = User.objects.create_user(username="bob", password="Password123!")
        self.admin = User.objects.create_superuser(
            username="admin_test", password="Password123!", email="admin@test.com"
        )

        self.movie = Movie.objects.create(
            title="Test Blockbuster",
            description="Test Description",
            duration_minutes=150,
            release_date=timezone.now().date(),
            age_certification="UA",
        )
        self.theater = Theater.objects.create(name="PVR Test", city="Mumbai", address="Andheri")
        self.screen = Screen.objects.create(
            theater=self.theater, name="Screen 1", total_rows=10, seats_per_row=15
        )
        self.showtime = Showtime.objects.create(
            movie=self.movie,
            screen=self.screen,
            start_time=timezone.now() + timedelta(days=1),
            ticket_price=250,
        )

    def test_1_concurrent_seat_reservation_prevents_double_booking(self):
        """Point 7: Verify second user cannot reserve a seat held by first user."""
        self.client.force_authenticate(user=self.user1)
        res1 = self.client.post(
            f"/api/showtimes/{self.showtime.id}/reserve/",
            {"seats": [{"row_label": "A", "seat_number": 1}]},
            format="json",
        )
        self.assertEqual(res1.status_code, 201)

        self.client.force_authenticate(user=self.user2)
        res2 = self.client.post(
            f"/api/showtimes/{self.showtime.id}/reserve/",
            {"seats": [{"row_label": "A", "seat_number": 1}]},
            format="json",
        )
        self.assertEqual(res2.status_code, 409)

    def test_2_missing_or_invalid_payment_signature_rejected(self):
        """Point 1: Verify payment confirmation rejects forged or missing signatures."""
        self.client.force_authenticate(user=self.user1)
        res = self.client.post(
            f"/api/showtimes/{self.showtime.id}/reserve/",
            {"seats": [{"row_label": "B", "seat_number": 2}]},
            format="json",
        )
        booking_id = res.data["booking_id"]
        self.client.post("/api/payments/create-order/", {"booking_id": booking_id}, format="json")

        bad_verify = self.client.post(
            "/api/payments/verify/",
            {
                "booking_id": booking_id,
                "razorpay_order_id": "order_fake",
                "razorpay_payment_id": "pay_fake",
                "razorpay_signature": "forged_signature_123",
                "payment_outcome": "SUCCESS",
            },
            format="json",
        )
        self.assertEqual(bad_verify.status_code, 400)

    def test_3_unsigned_webhook_rejected(self):
        """Point 2: Verify webhook without X-Razorpay-Signature is rejected."""
        res = self.client.post(
            "/api/payments/webhook/",
            {"event": "payment.captured"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_4_expired_hold_cannot_be_confirmed(self):
        """Point 4: Verify expired booking hold cannot be confirmed by late payment."""
        self.client.force_authenticate(user=self.user1)
        res = self.client.post(
            f"/api/showtimes/{self.showtime.id}/reserve/",
            {"seats": [{"row_label": "C", "seat_number": 3}]},
            format="json",
        )
        booking_id = res.data["booking_id"]
        order_res = self.client.post("/api/payments/create-order/", {"booking_id": booking_id}, format="json")
        payload = order_res.data["test_verification_payload"]

        Booking.objects.filter(id=booking_id).update(expires_at=timezone.now() - timedelta(minutes=5))

        verify_res = self.client.post("/api/payments/verify/", payload, format="json")
        self.assertEqual(verify_res.status_code, 400)
        self.assertNotEqual(Booking.objects.get(id=booking_id).status, "CONFIRMED")

    def test_5_analytics_uses_real_screen_dimensions(self):
        """Point 6: Verify analytics calculates true seat capacity (10 * 15 = 150) instead of hardcoded 120."""
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/admin/analytics/")
        self.assertEqual(res.status_code, 200)
        theaters = res.data["top_performing_theaters_and_occupancy"]
        self.assertEqual(theaters[0]["total_capacity"], 150)