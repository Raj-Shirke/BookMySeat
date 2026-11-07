import logging
from celery import shared_task
from django.core.mail import EmailMessage
from django.conf import settings
from .models import Booking
from .utils import generate_pdf_ticket

logger = logging.getLogger(__name__)


@shared_task(bind=True, autoretry_for=(Exception,), retry_kwargs={'max_retries': 3}, retry_backoff=True)
def send_ticket_email_task(self, booking_id):
    """
    Task 2: Asynchronous background task with Celery to generate the PDF ticket
    and email it to the user. Retries automatically on network or SMTP failures.
    """
    try:
        booking = Booking.objects.select_related(
            'user', 'showtime__movie', 'showtime__screen__theater'
        ).prefetch_related('seats').get(id=booking_id)

        if booking.status != 'CONFIRMED':
            logger.warning(f"Booking {booking_id} is not confirmed. Skipping ticket email.")
            return

        user_email = booking.user.email
        if not user_email:
            logger.warning(f"User {booking.user.username} has no email address configured.")
            return

        # Generate PDF bytes
        pdf_bytes = generate_pdf_ticket(booking)

        subject = f"Your Movie Ticket: {booking.showtime.movie.title} (Booking #{str(booking.booking_id)[:8]})"
        body = (
            f"Dear {booking.user.username},\n\n"
            f"Your booking for {booking.showtime.movie.title} at {booking.showtime.screen.theater.name} "
            f"has been successfully confirmed!\n\n"
            f"Show Time: {booking.showtime.start_time.strftime('%Y-%m-%d %I:%M %p')}\n"
            f"Total Paid: ₹{booking.total_amount}\n"
            f"Payment Reference: {booking.payment_reference_id}\n\n"
            f"Your official PDF ticket with the entry QR code is attached to this email.\n\n"
            f"Best regards,\n"
            f"Team BookMySeat (ElevanceSkills Internship Project)"
        )

        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@bookmyseat.com'),
            to=[user_email],
        )
        email.attach(f"Ticket_{str(booking.booking_id)[:8]}.pdf", pdf_bytes, 'application/pdf')
        email.send(fail_silently=False)
        logger.info(f"Successfully sent PDF ticket email for booking {booking_id} to {user_email}")

    except Exception as exc:
        logger.error(f"Failed to send ticket email for booking {booking_id}: {str(exc)}")
        raise self.retry(exc=exc)