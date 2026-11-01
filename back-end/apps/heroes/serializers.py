from rest_framework import serializers

from .models import Hero


class HeroSerializer(serializers.ModelSerializer):
    """CRUD de heróis (1 por equipe — ``group`` é OneToOne).

    ``spells`` é escrita (PKs); ``spell_names`` é só leitura para conveniência
    do front.
    """

    group_name = serializers.SerializerMethodField()
    spell_names = serializers.SerializerMethodField()

    class Meta:
        model = Hero
        fields = [
            "id",
            "name",
            "group",
            "group_name",
            "spells",
            "spell_names",
            "max_hp",
            "hp",
            "shield",
            "power_bonus",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None

    def get_spell_names(self, obj):
        # Nome limpo (sem o prefixo do __str__ do Spell, que é "Feitiço: X").
        return [spell.name for spell in obj.spells.all()]
