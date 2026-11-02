from rest_framework import serializers, validators

from .models import Hero


class HeroSerializer(serializers.ModelSerializer):
    """CRUD de heróis (1 por equipe em cada jornada — par group+journey único).

    ``spells`` é escrita (PKs); ``spell_names`` é só leitura para conveniência
    do front.
    """

    group_name = serializers.SerializerMethodField()
    journey_name = serializers.SerializerMethodField()
    spell_names = serializers.SerializerMethodField()

    class Meta:
        model = Hero
        fields = [
            "id",
            "name",
            "group",
            "group_name",
            "journey",
            "journey_name",
            "is_active",
            "spells",
            "spell_names",
            "max_hp",
            "hp",
            "shield",
            "power_bonus",
            "created_at",
        ]
        read_only_fields = ["created_at"]
        validators = [
            validators.UniqueTogetherValidator(
                queryset=Hero.objects.all(),
                fields=["group", "journey"],
                message="Este grupo já tem um herói nesta jornada.",
            )
        ]

    def get_journey_name(self, obj):
        return obj.journey.name if obj.journey else None

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None

    def get_spell_names(self, obj):
        # Nome limpo (sem o prefixo do __str__ do Spell, que é "Feitiço: X").
        return [spell.name for spell in obj.spells.all()]
