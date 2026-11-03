from django.urls import path
from .views import MovieDiscoveryListView, RecommendedMoviesView, FilterMetadataView

urlpatterns = [
    path('movies/discover/', MovieDiscoveryListView.as_view(), name='movie-discover'),
    path('movies/recommendations/', RecommendedMoviesView.as_view(), name='movie-recommendations'),
    path('movies/filters-metadata/', FilterMetadataView.as_view(), name='movie-filters-metadata'),
]