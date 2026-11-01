from rest_framework import viewsets

from .models import Boss, BossSpell, Choice, Question
from .serializers import (
    BossSerializer,
    BossSpellSerializer,
    ChoiceSerializer,
    QuestionSerializer,
)


class BossViewSet(viewsets.ModelViewSet):
    """CRUD de chefes (HP, feitiços e, depois, o sorteio — Fase 2)."""

    queryset = Boss.objects.prefetch_related("spells")
    serializer_class = BossSerializer


class BossSpellViewSet(viewsets.ModelViewSet):
    """CRUD dos vínculos chefe ↔ feitiço (peso da IA do chefe)."""

    queryset = BossSpell.objects.select_related("boss", "spell")
    serializer_class = BossSpellSerializer


class QuestionViewSet(viewsets.ModelViewSet):
    """CRUD de perguntas (com alternativas aninhadas na leitura)."""

    queryset = Question.objects.select_related("boss").prefetch_related(
        "choices"
    )
    serializer_class = QuestionSerializer


class ChoiceViewSet(viewsets.ModelViewSet):
    """CRUD de alternativas de uma pergunta."""

    queryset = Choice.objects.select_related("question")
    serializer_class = ChoiceSerializer
