from rest_framework import mixins, viewsets

from .models import BattleEvent, GroupJourney, Journey, Stage, StageProgress
from .serializers import (
    BattleEventSerializer,
    GroupJourneySerializer,
    JourneySerializer,
    StageProgressSerializer,
    StageSerializer,
)


class JourneyViewSet(viewsets.ModelViewSet):
    """CRUD de jornadas (a campanha; as 8 incursões viram etapas)."""

    queryset = Journey.objects.all()
    serializer_class = JourneySerializer


class StageViewSet(viewsets.ModelViewSet):
    """CRUD de etapas (ordem única dentro da jornada)."""

    queryset = Stage.objects.select_related("journey").prefetch_related(
        "boss_pool"
    )
    serializer_class = StageSerializer


class GroupJourneyViewSet(viewsets.ModelViewSet):
    """CRUD do vínculo grupo ↔ jornada."""

    queryset = GroupJourney.objects.select_related(
        "group", "journey", "current_stage"
    )
    serializer_class = GroupJourneySerializer


class StageProgressViewSet(viewsets.ModelViewSet):
    """CRUD do progresso de um grupo numa etapa (batalha)."""

    queryset = StageProgress.objects.select_related(
        "group_journey", "stage", "boss"
    )
    serializer_class = StageProgressSerializer


class BattleEventViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """Log de batalha APPEND-ONLY: criação é permitida (registro manual ou
    motor), edição e exclusão não — é a trilha de auditoria da disputa.
    """

    queryset = BattleEvent.objects.select_related("progress")
    serializer_class = BattleEventSerializer
