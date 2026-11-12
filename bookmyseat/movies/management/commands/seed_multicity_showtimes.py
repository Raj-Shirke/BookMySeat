from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from movies.models import Movie, Theater, Screen, Showtime

CITY_REGIONS = {
    "Mumbai": [
        ("PVR ICON: Oberoi Mall, Goregaon", "Andheri & Western Suburbs"),
        ("INOX: Maison Jio World Drive, BKC", "Bandra Kurla Complex (BKC)"),
        ("PVR: Phoenix Palladium, Lower Parel", "South Mumbai & Lower Parel"),
    ],
    "Pune": [
        ("PVR: Phoenix Marketcity, Viman Nagar", "Viman Nagar & Kalyani Nagar"),
        ("INOX: Elpro City Square, Chinchwad", "Wakad & Pimpri-Chinchwad"),
        ("Cinepolis: WestEnd Mall, Aundh", "Koregaon Park & Aundh"),
    ],
    "Bengaluru": [
        ("PVR: Director's Cut, Forum Rex Walk", "MG Road & Indiranagar"),
        ("INOX: Mantri Square, Malleshwaram", "Koramangala & Central"),
        ("Cinepolis: Nexus Shantiniketan", "Whitefield & Marathahalli"),
    ],
    "Delhi NCR": [
        ("PVR: Director's Cut, Ambience Mall", "Vasant Kunj & South Delhi"),
        ("INOX: Nehru Place, Epicuria", "Connaught Place & Central"),
        ("PVR: CyberHub, Gurugram", "Gurugram & Noida"),
    ],
}

class Command(BaseCommand):
    help = "Seeds multi-city and sub-region theaters and showtimes for all movies"

    def handle(self, *args, **options):
        movies = list(Movie.objects.all())
        if not movies:
            self.stdout.write(self.style.WARNING("No movies found. Run seed_demo first."))
            return

        now = timezone.now()
        created_showtimes = 0

        for city, theater_list in CITY_REGIONS.items():
            for theater_name, sub_region in theater_list:
                theater, _ = Theater.objects.get_or_create(
                    name=theater_name,
                    city=city,
                    defaults={"address": sub_region},
                )
                if theater.address != sub_region:
                    theater.address = sub_region
                    theater.save(update_fields=["address"])

                screen, _ = Screen.objects.get_or_create(
                    theater=theater,
                    name=f"IMAX Laser • {sub_region}",
                    defaults={"total_rows": 8, "seats_per_row": 12},
                )

                for idx, movie in enumerate(movies):
                    if not Showtime.objects.filter(movie=movie, screen=screen).exists():
                        start_time = (now + timedelta(days=1)).replace(
                            hour=10 + ((idx * 3) % 12), minute=30, second=0, microsecond=0
                        )
                        Showtime.objects.create(
                            movie=movie,
                            screen=screen,
                            start_time=start_time,
                            ticket_price=220 + ((idx % 4) * 40),
                        )
                        created_showtimes += 1

        self.stdout.write(
            self.style.SUCCESS(f"Successfully ensured multi-city showtimes! Added {created_showtimes} new showtimes.")
        )