from rest_framework import viewsets

from .models import Hero
from .serializers import HeroSerializer


class HeroViewSet(viewsets.ModelViewSet):
    """CRUD de heróis (representante de uma equipe na batalha)."""

    queryset = Hero.objects.select_related("group").prefetch_related("spells")
    serializer_class = HeroSerializer
