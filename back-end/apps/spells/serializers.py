from rest_framework import serializers

from .models import Spell


class SpellSerializer(serializers.ModelSerializer):
    """CRUD de habilidades/feitiços (custo em PR e dados: Fase 2)."""

    class Meta:
        model = Spell
        fields = [
            "id",
            "name",
            "description",
            "spell_type",
            "base_value",
            "max_value",
            "cooldown_turns",
            "is_active",
        ]
