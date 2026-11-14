import os
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from movies.models import (
    Genre,
    Language,
    Movie,
    MoviePoster,
    CastMember,
    Theater,
    Screen,
    Showtime,
)


class Command(BaseCommand):
    help = "Seeds BookMySeat demo movies, theaters, showtimes, and safe demo accounts"

    def handle(self, *args, **options):
        self.stdout.write("Seeding BookMySeat demo data...")

        # Point 3 Fix: Use environment variable for admin password & do not overwrite existing password
        admin_password = os.environ.get("ADMIN_DEFAULT_PASSWORD", "Admin@1234")
        admin_user, created_admin = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@bookmyseat.com",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created_admin:
            admin_user.set_password(admin_password)
            admin_user.save()

        demo_user, created_user = User.objects.get_or_create(
            username="raj_shirke",
            defaults={"email": "raj@bookmyseat.com"},
        )
        if created_user:
            demo_user.set_password(os.environ.get("DEMO_USER_PASSWORD", "User@1234"))
            demo_user.save()

        genres_map = {}
        for g_name in ["Action", "Sci-Fi", "Thriller", "Drama", "Horror", "Comedy"]:
            g_obj, _ = Genre.objects.get_or_create(name=g_name)
            genres_map[g_name] = g_obj

        langs_map = {}
        for l_name in ["English", "Hindi", "Telugu", "Tamil", "Marathi"]:
            l_obj, _ = Language.objects.get_or_create(name=l_name)
            langs_map[l_name] = l_obj

        movies_seed = [
            {
                "title": "Pushpa 2: The Rule",
                "desc": "Pushpa Raj expands his red sandalwood syndicate globally while facing off against his fiercest rival SP Bhanwar Singh Shekhawat.",
                "dur": 195,
                "cert": "UA",
                "rating": 4.7,
                "genres": ["Action", "Thriller", "Drama"],
                "langs": ["Telugu", "Hindi", "Tamil"],
                "trailer": "https://www.youtube-nocookie.com/embed/Q1NKMPhP8PY",
                "poster": "https://upload.wikimedia.org/wikipedia/en/1/11/Pushpa_2-_The_Rule.jpg",
                "cast": [("Allu Arjun", "Pushpa Raj"), ("Rashmika Mandanna", "Srivalli"), ("Fahadh Faasil", "Bhanwar Singh")],
            },
            {
                "title": "Dune: Part Two",
                "desc": "Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.",
                "dur": 166,
                "cert": "UA",
                "rating": 4.8,
                "genres": ["Sci-Fi", "Action", "Drama"],
                "langs": ["English", "Hindi"],
                "trailer": "https://www.youtube-nocookie.com/embed/Way9Dexny3w",
                "poster": "https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
                "cast": [("Timothée Chalamet", "Paul Atreides"), ("Zendaya", "Chani"), ("Rebecca Ferguson", "Lady Jessica")],
            },
            {
                "title": "Kalki 2898 AD",
                "desc": "A modern-day avatar of Vishnu descends to Earth to protect the world from dark dystopian forces in the year 2898 AD.",
                "dur": 180,
                "cert": "UA",
                "rating": 4.6,
                "genres": ["Sci-Fi", "Action"],
                "langs": ["Telugu", "Hindi", "English"],
                "trailer": "https://www.youtube-nocookie.com/embed/kQDd1AhGIHk",
                "poster": "https://upload.wikimedia.org/wikipedia/en/4/4c/Kalki_2898_AD.jpg",
                "cast": [("Prabhas", "Bhairava"), ("Amitabh Bachchan", "Ashwatthama"), ("Deepika Padukone", "SUM-80")],
            },
            {
                "title": "Oppenheimer",
                "desc": "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II.",
                "dur": 180,
                "cert": "UA",
                "rating": 4.9,
                "genres": ["Drama", "Thriller"],
                "langs": ["English", "Hindi"],
                "trailer": "https://www.youtube-nocookie.com/embed/uYPbbksJxIg",
                "poster": "https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
                "cast": [("Cillian Murphy", "J. Robert Oppenheimer"), ("Emily Blunt", "Kitty"), ("Robert Downey Jr.", "Lewis Strauss")],
            },
            {
                "title": "Stree 2: Sarkate Ka Aatank",
                "desc": "The town of Chanderi faces a terrifying new headless entity abducting women, forcing Vicky and his friends to reunite with Stree.",
                "dur": 149,
                "cert": "UA",
                "rating": 4.5,
                "genres": ["Horror", "Comedy"],
                "langs": ["Hindi"],
                "trailer": "https://www.youtube-nocookie.com/embed/KVnheXywIbY",
                "poster": "https://upload.wikimedia.org/wikipedia/en/a/a1/Stree_2.jpg",
                "cast": [("Rajkummar Rao", "Vicky"), ("Shraddha Kapoor", "Mystery Woman"), ("Pankaj Tripathi", "Rudra")],
            },
            {
                "title": "Jawan",
                "desc": "A high-octane action thriller outlining the emotional journey of a prison warden who is set to rectify the wrongs in society.",
                "dur": 169,
                "cert": "UA",
                "rating": 4.6,
                "genres": ["Action", "Thriller"],
                "langs": ["Hindi", "Tamil", "Telugu"],
                "trailer": "https://www.youtube-nocookie.com/embed/COv52Qyctws",
                "poster": "https://upload.wikimedia.org/wikipedia/en/3/39/Jawan_film_poster.jpg",
                "cast": [("Shah Rukh Khan", "Vikram Rathore / Azad"), ("Nayanthara", "Narmada"), ("Vijay Sethupathi", "Kaalie")],
            },
            {
                "title": "Interstellar (IMAX Re-Release)",
                "desc": "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival across distant galaxies.",
                "dur": 169,
                "cert": "UA",
                "rating": 4.9,
                "genres": ["Sci-Fi", "Drama"],
                "langs": ["English"],
                "trailer": "https://www.youtube-nocookie.com/embed/zSWdZVtXT7E",
                "poster": "https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
                "cast": [("Matthew McConaughey", "Cooper"), ("Anne Hathaway", "Brand"), ("Jessica Chastain", "Murph")],
            },
        ]

        created_movies = []
        for idx, m_data in enumerate(movies_seed):
            movie, _ = Movie.objects.get_or_create(
                title=m_data["title"],
                defaults={
                    "description": m_data["desc"],
                    "duration_minutes": m_data["dur"],
                    "release_date": timezone.now().date() - timedelta(days=idx * 5),
                    "age_certification": m_data["cert"],
                    "trailer_url": m_data["trailer"],
                    "average_rating": m_data["rating"],
                    "total_bookings_count": 150 - (idx * 15),
                    "is_active": True,
                },
            )
            movie.genres.set([genres_map[g] for g in m_data["genres"]])
            movie.languages.set([langs_map[l] for l in m_data["langs"]])

            if not movie.posters.exists():
                MoviePoster.objects.create(movie=movie, image_url=m_data["poster"], is_primary=True)

            if not movie.cast.exists():
                for c_name, c_role in m_data["cast"]:
                    CastMember.objects.create(movie=movie, name=c_name, role_name=c_role)

            created_movies.append(movie)

        theaters_seed = [
            ("PVR ICON: Oberoi Mall, Goregaon", "Mumbai", "Andheri & Western Suburbs"),
            ("INOX: Maison Jio World Drive, BKC", "Mumbai", "Bandra Kurla Complex (BKC)"),
            ("PVR: Phoenix Marketcity, Viman Nagar", "Pune", "Viman Nagar & Kalyani Nagar"),
            ("PVR: Director's Cut, Forum Rex Walk", "Bengaluru", "MG Road & Indiranagar"),
            ("PVR: CyberHub, Gurugram", "Delhi NCR", "Gurugram & Noida"),
        ]

        now = timezone.now()
        for t_name, t_city, t_region in theaters_seed:
            theater, _ = Theater.objects.get_or_create(
                name=t_name,
                city=t_city,
                defaults={"address": t_region},
            )
            screen, _ = Screen.objects.get_or_create(
                theater=theater,
                name=f"IMAX Laser • {t_region}",
                defaults={"total_rows": 8, "seats_per_row": 12},
            )
            for idx, movie in enumerate(created_movies):
                if not Showtime.objects.filter(movie=movie, screen=screen).exists():
                    start_t = (now + timedelta(days=1)).replace(
                        hour=10 + ((idx * 3) % 12), minute=30, second=0, microsecond=0
                    )
                    Showtime.objects.create(
                        movie=movie,
                        screen=screen,
                        start_time=start_t,
                        ticket_price=220 + ((idx % 4) * 40),
                    )

        self.stdout.write(self.style.SUCCESS("Successfully seeded movies, multi-city theaters, and demo users!"))