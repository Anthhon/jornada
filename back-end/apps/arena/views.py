from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import engine, services
from .models import ArenaRound
from .serializers import (
    ArenaRoundSerializer,
    ArenaStateSerializer,
    AttackSerializer,
    DamageSerializer,
    OverrideSerializer,
    PerformanceSerializer,
)


class ArenaRoundViewSet(viewsets.ModelViewSet):
    """Rodadas da Arena (raid do chefe da rodada).

    Leitura aberta / escrita só professor vêm do DEFAULT_PERMISSION_CLASSES
    (``ReadOnlyOrStaff``). Exceção: ``state`` é público (polling do front).
    """

    queryset = ArenaRound.objects.select_related("boss", "journey").prefetch_related(
        "contributions__group", "events__group", "boss__abilities"
    )
    serializer_class = ArenaRoundSerializer

    def get_permissions(self):
        if self.action == "state":
            return [AllowAny()]
        return super().get_permissions()

    def _run(self, request, func, *args, **kwargs):
        """Executa um serviço, converte regra violada em 400 e devolve o estado."""
        try:
            func(*args, **kwargs)
        except engine.ArenaError as exc:
            raise ValidationError(str(exc))
        round_obj = self.get_object()
        return Response(ArenaRoundSerializer(round_obj).data)

    @action(detail=True, methods=["get"])
    @extend_schema(responses=ArenaStateSerializer)
    def state(self, request, pk=None):
        """Público: hp, placar e log ao vivo (polling do front)."""
        round_obj = self.get_object()
        return Response(ArenaStateSerializer(round_obj).data)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._run(request, services.start_round, self.get_object())

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        return self._run(request, services.pause_round, self.get_object())

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        return self._run(request, services.resume_round, self.get_object())

    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        return self._run(request, services.end_round, self.get_object())

    @action(detail=True, methods=["post"])
    def attack(self, request, pk=None):
        serializer = AttackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return self._run(
            request, services.attack, self.get_object(),
            data["group_id"], data["correct"], data["points"],
        )

    @action(detail=True, methods=["post"], url_path="apply-performance")
    def apply_performance(self, request, pk=None):
        serializer = PerformanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return self._run(
            request, services.apply_performance, self.get_object(),
            data.get("group_id"), data.get("performance"), data.get("criteria"),
        )

    @action(detail=True, methods=["post"])
    def damage(self, request, pk=None):
        serializer = DamageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return self._run(
            request, services.add_damage, self.get_object(),
            data["group_id"], data["damage"],
        )

    @action(detail=True, methods=["post"])
    def override(self, request, pk=None):
        serializer = OverrideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return self._run(
            request, services.adjust_points, self.get_object(),
            data["group_id"], data["amount"],
        )
