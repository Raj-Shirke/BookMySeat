from datetime import date, datetime, time, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from movies.models import (
    Genre, Language, CastMember, Movie, MoviePoster,
    Theater, Screen, Showtime, Booking, Review, RecentlyViewedMovie
)


class Command(BaseCommand):
    help = "Seeds realistic movies, theaters, screens, showtimes, and user history for Task 1-6."

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding BookMySeat demo data...")

        # 1. Create Demo Admin & Test User (Required for Task 6 Report Credentials)
        admin_user, _ = User.objects.get_or_create(
            username='admin',
            defaults={'email': 'admin@bookmyseat.com', 'is_staff': True, 'is_superuser': True}
        )
        admin_user.set_password('Admin@1234')
        admin_user.save()

        demo_user, _ = User.objects.get_or_create(
            username='raj_shirke',
            defaults={'email': 'raj@example.com'}
        )
        demo_user.set_password('User@1234')
        demo_user.save()

        # 2. Genres & Languages
        genre_names = ['Action', 'Sci-Fi', 'Thriller', 'Drama', 'Comedy', 'Horror', 'Crime', 'Adventure']
        genres = {name: Genre.objects.get_or_create(name=name)[0] for name in genre_names}

        lang_names = ['Hindi', 'English', 'Marathi', 'Tamil', 'Telugu']
        langs = {name: Language.objects.get_or_create(name=name)[0] for name in lang_names}

        # 3. Cast Members
        cast_list = [
            ('Shah Rukh Khan', 'Vikram Rathore'),
            ('Hrithik Roshan', 'Kabir'),
            ('Cillian Murphy', 'J. Robert Oppenheimer'),
            ('Timothée Chalamet', 'Paul Atreides'),
            ('Prabhas', 'Bhairava'),
            ('Allu Arjun', 'Pushpa Raj'),
            ('Rajkummar Rao', 'Vicky'),
            ('Matthew McConaughey', 'Cooper'),
        ]
        cast_objs = {}
        for name, role in cast_list:
            obj, _ = CastMember.objects.get_or_create(name=name, defaults={'role_name': role})
            cast_objs[name] = obj

        # 4. Movies Data
        movies_data = [
            {
                'title': 'Dune: Part Two',
                'description': 'Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.',
                'genres': ['Sci-Fi', 'Adventure', 'Action'],
                'languages': ['English', 'Hindi'],
                'cast': ['Timothée Chalamet'],
                'release_date': date(2026, 2, 15),
                'duration_minutes': 166,
                'age_certification': 'UA',
                'trailer_youtube_url': 'https://www.youtube.com/embed/Way9Dexny3w',
                'average_rating': Decimal('4.80'),
                'total_bookings_count': 1420,
                'poster': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
            },
            {
                'title': 'Kalki 2898 AD',
                'description': 'A modern-day avatar of Vishnu, a Hindu god, who is believed to have descended to earth to protect the world from evil forces.',
                'genres': ['Sci-Fi', 'Action', 'Adventure'],
                'languages': ['Telugu', 'Hindi', 'Tamil', 'English'],
                'cast': ['Prabhas'],
                'release_date': date(2026, 5, 10),
                'duration_minutes': 180,
                'age_certification': 'UA',
                'trailer_youtube_url': 'https://www.youtube.com/embed/kQDd1AhGIHk',
                'average_rating': Decimal('4.60'),
                'total_bookings_count': 1890,
                'poster': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
            },
            {
                'title': 'Oppenheimer',
                'description': 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.',
                'genres': ['Drama', 'Thriller'],
                'languages': ['English', 'Hindi'],
                'cast': ['Cillian Murphy'],
                'release_date': date(2026, 1, 20),
                'duration_minutes': 181,
                'age_certification': 'UA',
                'trailer_youtube_url': 'https://www.youtube.com/embed/uYPbbksJxIg',
                'average_rating': Decimal('4.90'),
                'total_bookings_count': 2150,
                'poster': 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=600&auto=format&fit=crop&q=80',
            },
            {
                'title': 'Stree 2: Sarkate Ka Aatank',
                'description': 'After the events of Stree, the town of Chanderi is being haunted again, this time by a headless entity abducting women.',
                'genres': ['Comedy', 'Horror'],
                'languages': ['Hindi'],
                'cast': ['Rajkummar Rao'],
                'release_date': date(2026, 8, 15),
                'duration_minutes': 147,
                'age_certification': 'UA',
                'trailer_youtube_url': 'https://www.youtube.com/embed/KVnheXywIbY',
                'average_rating': Decimal('4.50'),
                'total_bookings_count': 2400,
                'poster': 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
            },
            {
                'title': 'Jawan',
                'description': 'A high-octane action thriller which outlines the emotional journey of a man who is set to rectify the wrongs in the society.',
                'genres': ['Action', 'Thriller', 'Crime'],
                'languages': ['Hindi', 'Tamil', 'Telugu'],
                'cast': ['Shah Rukh Khan'],
                'release_date': date(2026, 4, 2),
                'duration_minutes': 169,
                'age_certification': 'UA',
                'trailer_youtube_url': 'https://www.youtube.com/embed/COv52Qyctws',
                'average_rating': Decimal('4.40'),
                'total_bookings_count': 1750,
                'poster': 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80',
            },
            {
                'title': 'Pushpa 2: The Rule',
                'description': 'Pushpa Raj expands his red sandalwood syndicate globally while facing off against his nemesis Bhanwar Singh Shekhawat.',
                'genres': ['Action', 'Crime', 'Drama'],
                'languages': ['Telugu', 'Hindi', 'Tamil'],
                'cast': ['Allu Arjun'],
                'release_date': date(2026, 10, 25),
                'duration_minutes': 175,
                'age_certification': 'UA',
                'trailer_youtube_url': 'https://www.youtube.com/embed/Q1NKMPhP8PY',
                'average_rating': Decimal('4.70'),
                'total_bookings_count': 2600,
                'poster': 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80',
            },
            {
                'title': 'Interstellar (IMAX Re-Release)',
                'description': 'When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft.',
                'genres': ['Sci-Fi', 'Adventure', 'Drama'],
                'languages': ['English'],
                'cast': ['Matthew McConaughey'],
                'release_date': date(2026, 9, 12),
                'duration_minutes': 169,
                'age_certification': 'U',
                'trailer_youtube_url': 'https://www.youtube.com/embed/zSWdZVtXT7E',
                'average_rating': Decimal('4.95'),
                'total_bookings_count': 1980,
                'poster': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
            },
            {
                'title': 'War 2',
                'description': 'Agent Kabir returns for his deadliest covert mission across continents inside the YRF Spy Universe.',
                'genres': ['Action', 'Thriller'],
                'languages': ['Hindi', 'English'],
                'cast': ['Hrithik Roshan'],
                'release_date': date(2026, 10, 30),
                'duration_minutes': 158,
                'age_certification': 'UA',
                'trailer_youtube_url': 'https://www.youtube.com/embed/tQ0mzXRk-oM',
                'average_rating': Decimal('4.30'),
                'total_bookings_count': 1320,
                'poster': 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=600&auto=format&fit=crop&q=80',
            },
        ]

        created_movies = []
        for m_data in movies_data:
            movie, _ = Movie.objects.update_or_create(
                title=m_data['title'],
                defaults={
                    'description': m_data['description'],
                    'release_date': m_data['release_date'],
                    'duration_minutes': m_data['duration_minutes'],
                    'age_certification': m_data['age_certification'],
                    'trailer_youtube_url': m_data['trailer_youtube_url'],
                    'average_rating': m_data['average_rating'],
                    'total_bookings_count': m_data['total_bookings_count'],
                }
            )
            movie.genres.set([genres[g] for g in m_data['genres']])
            movie.languages.set([langs[l] for l in m_data['languages']])
            movie.cast.set([cast_objs[c] for c in m_data['cast']])
            MoviePoster.objects.get_or_create(
                movie=movie,
                image_url=m_data['poster'],
                defaults={'is_primary': True}
            )
            created_movies.append(movie)

        # 5. Theaters & Screens (Mumbai, Pune, Bengaluru)
        theaters_data = [
            ('PVR ICON: Oberoi Mall, Goregaon', 'Mumbai', 'Oberoi Garden City, Goregaon East, Mumbai'),
            ('INOX: Megaplex, Inorbit Mall, Malad', 'Mumbai', 'Link Road, Malad West, Mumbai'),
            ('Cinepolis: Nexus Seawoods', 'Mumbai', 'Nerul, Navi Mumbai'),
            ('PVR: Phoenix Marketcity', 'Pune', 'Viman Nagar, Pune'),
            ('INOX: Garuda Mall', 'Bengaluru', 'Magrath Road, Bengaluru'),
        ]

        screens = []
        for t_name, city, addr in theaters_data:
            theater, _ = Theater.objects.get_or_create(
                name=t_name,
                city=city,
                defaults={'address': addr, 'total_capacity': 240}
            )
            s1, _ = Screen.objects.get_or_create(theater=theater, name='IMAX Screen 1', defaults={'rows': 10, 'cols': 12})
            s2, _ = Screen.objects.get_or_create(theater=theater, name='Dolby Atmos Screen 2', defaults={'rows': 10, 'cols': 12})
            screens.extend([s1, s2])

        # 6. Showtimes across Morning, Afternoon, Evening, Night for Today & Tomorrow
        today = timezone.localdate()
        time_slots = [
            (time(9, 30), Decimal('220.00')),    # Morning
            (time(14, 15), Decimal('280.00')),   # Afternoon
            (time(18, 45), Decimal('350.00')),   # Evening
            (time(21, 30), Decimal('420.00')),   # Night
        ]

        for idx, movie in enumerate(created_movies):
            for day_offset in [0, 1, 2]:
                show_date = today + timedelta(days=day_offset)
                target_screen = screens[idx % len(screens)]
                for slot_time, base_price in time_slots:
                    aware_dt = timezone.make_aware(datetime.combine(show_date, slot_time))
                    Showtime.objects.get_or_create(
                        movie=movie,
                        screen=target_screen,
                        start_time=aware_dt,
                        defaults={'ticket_price': base_price + Decimal(idx * 20)}
                    )

        # 7. Seed Recent Views & Booking History for 'raj_shirke' (Tests Task 1 Recommendations)
        RecentlyViewedMovie.objects.get_or_create(user=demo_user, movie=created_movies[0])  # Dune 2 (Sci-Fi)
        RecentlyViewedMovie.objects.get_or_create(user=demo_user, movie=created_movies[2])  # Oppenheimer

        self.stdout.write(self.style.SUCCESS(
            "Successfully seeded 8 Movies, 5 Theaters, 10 Screens, 96 Showtimes, and Demo Users!\n"
            "Admin Login: admin / Admin@1234 | User Login: raj_shirke / User@1234"
        ))