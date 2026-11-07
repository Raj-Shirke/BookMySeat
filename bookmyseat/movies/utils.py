import io
import qrcode
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from django.core.files.base import ContentFile


def generate_pdf_ticket(booking) -> bytes:
    """
    Generates a professional PDF ticket in-memory for a confirmed booking
    containing movie details, theater, screen, show timing, seats, booking ID,
    payment reference, and a QR code.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()

    # Custom Color Palette
    primary_color = colors.HexColor('#1E293B')  # Slate Dark
    accent_color = colors.HexColor('#6366F1')   # Indigo
    bg_light = colors.HexColor('#F8FAFC')

    # Title Style
    title_style = ParagraphStyle(
        'TicketTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=primary_color,
        spaceAfter=4,
        alignment=1  # Centered
    )
    subtitle_style = ParagraphStyle(
        'TicketSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=accent_color,
        spaceAfter=15,
        alignment=1
    )
    normal_style = ParagraphStyle(
        'TicketNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=primary_color,
        leading=14
    )

    # 1. Header
    story.append(Paragraph("<b>BOOKMYSEAT CONFIRMED TICKET</b>", title_style))
    story.append(Paragraph("<b>ElevanceSkills Enterprise Cinema Ticketing System</b>", subtitle_style))
    story.append(Spacer(1, 10))

    # 2. Generate QR Code Image in memory
    qr_data = f"BOOKING-ID:{booking.booking_id} | USER:{booking.user.username} | MOVIE:{booking.showtime.movie.title}"
    qr = qrcode.QRCode(version=1, box_size=4, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    qr_io = io.BytesIO()
    qr_img.save(qr_io, format='PNG')
    qr_io.seek(0)
    qr_reportlab_img = Image(qr_io, width=90, height=90)

    # 3. Format Booking Details Table
    showtime_str = booking.showtime.start_time.strftime('%A, %d %B %Y at %I:%M %p')
    seats_list = ", ".join([f"{s.row_label}{s.seat_number}" for s in booking.seats.all()])

    data = [
        [Paragraph("<b>Movie:</b>", normal_style), Paragraph(f"<b>{booking.showtime.movie.title}</b>", normal_style)],
        [Paragraph("<b>Theater:</b>", normal_style), Paragraph(f"{booking.showtime.screen.theater.name}, {booking.showtime.screen.theater.city}", normal_style)],
        [Paragraph("<b>Screen & Show:</b>", normal_style), Paragraph(f"{booking.showtime.screen.name} | {showtime_str}", normal_style)],
        [Paragraph("<b>Booked Seats:</b>", normal_style), Paragraph(f"<b><font color='#6366F1'>{seats_list}</font></b>", normal_style)],
        [Paragraph("<b>Booking ID:</b>", normal_style), Paragraph(str(booking.booking_id), normal_style)],
        [Paragraph("<b>Payment Ref:</b>", normal_style), Paragraph(booking.payment_reference_id or 'N/A', normal_style)],
        [Paragraph("<b>Total Amount:</b>", normal_style), Paragraph(f"₹{booking.total_amount}", normal_style)],
        [Paragraph("<b>Verification QR:</b>", normal_style), qr_reportlab_img],
    ]

    t = Table(data, colWidths=[130, 400])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_light),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('BOX', (0, 0), (-1, -1), 1, primary_color),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))

    story.append(t)
    story.append(Spacer(1, 20))
    story.append(Paragraph("<i>Please present this QR code or Booking ID at the cinema entrance. Enjoy your movie!</i>", subtitle_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()