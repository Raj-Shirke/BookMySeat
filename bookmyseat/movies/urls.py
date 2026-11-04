from django.urls import path
from .views import (
    MovieDiscoveryListView,
    RecommendedMoviesView,
    FilterMetadataView,
    MovieDetailView,
    MovieReviewCreateUpdateView,
    ReportReviewView,
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
]