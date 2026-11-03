import django_filters
from django.db.models import Q
from .models import Movie

class MovieDiscoveryFilter(django_filters.FilterSet):
    title = django_filters.CharFilter(field_name='title', lookup_expr='icontains')
    genre = django_filters.CharFilter(field_name='genres__name', lookup_expr='iexact')
    language = django_filters.CharFilter(field_name='languages__name', lookup_expr='iexact')
    city = django_filters.CharFilter(field_name='showtimes__screen__theater__city', lookup_expr='iexact')
    theater = django_filters.NumberFilter(field_name='showtimes__screen__theater__id')
    release_date_after = django_filters.DateFilter(field_name='release_date', lookup_expr='gte')
    release_date_before = django_filters.DateFilter(field_name='release_date', lookup_expr='lte')
    min_rating = django_filters.NumberFilter(field_name='average_rating', lookup_expr='gte')
    show_date = django_filters.DateFilter(field_name='showtimes__start_time__date')
    show_slot = django_filters.CharFilter(method='filter_by_time_slot')

    class Meta:
        model = Movie
        fields = [
            'title', 'genre', 'language', 'city', 'theater',
            'release_date_after', 'release_date_before', 'min_rating',
            'show_date', 'show_slot'
        ]

    def filter_by_time_slot(self, queryset, name, value):
        """
        Filters movies by showtime slots:
        morning (6-12), afternoon (12-16), evening (16-20), night (20-24)
        """
        slots = {
            'morning': (6, 11),
            'afternoon': (12, 15),
            'evening': (16, 19),
            'night': (20, 23),
        }
        slot = value.lower()
        if slot in slots:
            start_hr, end_hr = slots[slot]
            return queryset.filter(
                showtimes__start_time__hour__gte=start_hr,
                showtimes__start_time__hour__lte=end_hr
            )
        return queryset