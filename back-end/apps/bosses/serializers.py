from rest_framework import serializers

from apps.spells.models import Spell

from .models import Boss, BossSpell, Choice, Question


class BossSerializer(serializers.ModelSerializer):
    """CRUD de chefes.

    ``spells`` é declarado à mão porque o ModelSerializer do DRF deixa
    read-only todo M2M que tem modelo ``through`` (BossSpell). Aqui é
    escrita (PKs): o ``.set()`` cria as linhas do through com ``weight``
    padrão 1 — pesos são ajustados no endpoint ``api/boss-spells/``.
    """

    spells = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Spell.objects.all(),
        required=False,
    )
    spell_names = serializers.SerializerMethodField()

    class Meta:
        model = Boss
        fields = [
            "id",
            "name",
            "description",
            "max_hp",
            "spells",
            "spell_names",
        ]

    def get_spell_names(self, obj):
        # Nome limpo (sem o prefixo do __str__ do Spell, que é "Feitiço: X").
        return [spell.name for spell in obj.spells.all()]


class BossSpellSerializer(serializers.ModelSerializer):
    """Vínculo chefe ↔ feitiço com o peso da IA do chefe."""

    boss_name = serializers.CharField(source="boss.name", read_only=True)
    spell_name = serializers.CharField(source="spell.name", read_only=True)

    class Meta:
        model = BossSpell
        fields = [
            "id",
            "boss",
            "boss_name",
            "spell",
            "spell_name",
            "weight",
        ]


class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ["id", "question", "text", "is_correct"]


class QuestionSerializer(serializers.ModelSerializer):
    """CRUD de perguntas da arguição/quiz, com alternativas aninhadas (leitura).

    Alternativas são escritas pelo endpoint próprio ``api/choices/``.
    """

    boss_name = serializers.CharField(source="boss.name", read_only=True)
    choices = ChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "boss",
            "boss_name",
            "text",
            "points",
            "choices",
        ]
