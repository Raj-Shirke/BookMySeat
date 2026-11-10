from django.core.management.base import BaseCommand
from movies.models import Movie, MoviePoster

REAL_POSTERS = {
    "Pushpa": [
        "https://upload.wikimedia.org/wikipedia/en/1/11/Pushpa_2-_The_Rule.jpg",
        "https://upload.wikimedia.org/wikipedia/en/d/d6/Pushpa_-_The_Rise_%282021_film%29.jpg",
    ],
    "Stree": [
        "https://upload.wikimedia.org/wikipedia/en/a/a1/Stree_2.jpg",
        "https://upload.wikimedia.org/wikipedia/en/4/4f/Stree_-_2018_Movie_Poster.jpg",
    ],
    "Dune": [
        "https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
        "https://image.tmdb.org/t/p/w780/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
    ],
    "Kalki": [
        "https://upload.wikimedia.org/wikipedia/en/4/4c/Kalki_2898_AD.jpg",
    ],
    "Jawan": [
        "https://upload.wikimedia.org/wikipedia/en/3/39/Jawan_film_poster.jpg",
    ],
    "Oppenheimer": [
        "https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
        "https://image.tmdb.org/t/p/w780/ptpr0kGAckfQkJeJIt8st5dglvd.jpg",
    ],
    "Interstellar": [
        "https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    ],
    "Batman": [
        "https://image.tmdb.org/t/p/w780/74xTEgt7R36Fpooo50r9T25onhq.jpg",
    ],
    "Avengers": [
        "https://image.tmdb.org/t/p/w780/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
    ],
    "Spider-Man": [
        "https://image.tmdb.org/t/p/w780/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg",
    ],
    "Singham": [
        "https://upload.wikimedia.org/wikipedia/en/f/f2/Singham_Again_poster.jpg",
    ],
    "Bhool Bhulaiyaa": [
        "https://upload.wikimedia.org/wikipedia/en/6/6f/Bhool_Bhulaiyaa_3_poster.jpg",
    ],
    "Chhaava": [
        "https://upload.wikimedia.org/wikipedia/en/7/75/Chhaava_poster.jpg",
    ],
    "Animal": [
        "https://upload.wikimedia.org/wikipedia/en/9/90/Animal_%282023_film%29_poster.jpg",
    ],
    "Leo": [
        "https://upload.wikimedia.org/wikipedia/en/7/75/Leo_%282023_Indian_film%29.jpg",
    ],
}

FALLBACK_POSTERS = [
    "https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    "https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    "https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    "https://image.tmdb.org/t/p/w780/74xTEgt7R36Fpooo50r9T25onhq.jpg",
]

class Command(BaseCommand):
    help = "Updates all movies with official high-res theatrical posters"

    def handle(self, *args, **options):
        movies = Movie.objects.all().order_by("id")
        for idx, movie in enumerate(movies):
            matched_urls = None
            for keyword, urls in REAL_POSTERS.items():
                if keyword.lower() in movie.title.lower():
                    matched_urls = urls
                    break
            if not matched_urls:
                matched_urls = [FALLBACK_POSTERS[idx % len(FALLBACK_POSTERS)]]

            MoviePoster.objects.filter(movie=movie).delete()
            for i, url in enumerate(matched_urls):
                MoviePoster.objects.create(
                    movie=movie,
                    image_url=url,
                    is_primary=(i == 0),
                )
            self.stdout.write(self.style.SUCCESS(f"Updated poster for: {movie.title}"))