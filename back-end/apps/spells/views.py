from rest_framework import viewsets

from .models import Spell
from .serializers import SpellSerializer


class SpellViewSet(viewsets.ModelViewSet):
    """CRUD de feitiços (compartilhados por heróis e chefes)."""

    queryset = Spell.objects.all()
    serializer_class = SpellSerializer
