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
    RenewAbilitiesSerializer,
    ResetTeamSerializer,
    SetHpSerializer,
    UseAbilitySerializer,
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
    def reopen(self, request, pk=None):
        """Reabre uma disputa encerrada, estornando recompensa e saque (M-50)."""
        return self._run(request, services.reopen_round, self.get_object())

    @action(detail=True, methods=["post"], url_path="set-hp")
    def set_hp(self, request, pk=None):
        """Ajusta o PV do chefe (restaurar manda o PV máximo — M-50)."""
        serializer = SetHpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._run(
            request, services.set_hp_round, self.get_object(),
            serializer.validated_data["hp"],
        )

    @action(detail=True, methods=["post"])
    def undo(self, request, pk=None):
        """Desfaz a última ação com checkpoint e trunca o log (M-50)."""
        return self._run(request, services.undo_round, self.get_object())

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        """Cópia da rodada em CONFIG, sem histórico — devolve a nova (M-50)."""
        try:
            copy = services.duplicate_round(self.get_object())
        except engine.ArenaError as exc:
            raise ValidationError(str(exc))
        return Response(ArenaRoundSerializer(copy).data, status=201)

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

    @action(detail=True, methods=["post"], url_path="use-ability")
    def use_ability(self, request, pk=None):
        """Habilidade de equipe com d20 (rolado aqui, no servidor — ADR-019)."""
        serializer = UseAbilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return self._run(
            request, services.use_ability, self.get_object(),
            data["group_id"], data["ability_id"],
        )

    @action(detail=True, methods=["post"], url_path="renew-abilities")
    def renew_abilities(self, request, pk=None):
        """Professor repõe as cargas das habilidades da equipe (ADR-021)."""
        serializer = RenewAbilitiesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return self._run(
            request, services.renew_abilities, self.get_object(),
            data["group_id"],
        )

    @action(detail=True, methods=["post"], url_path="reset-team")
    def reset_team(self, request, pk=None):
        """Zera uma equipe na rodada e devolve o dano ao chefe (M-51)."""
        serializer = ResetTeamSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._run(
            request, services.reset_team, self.get_object(),
            serializer.validated_data["group_id"],
        )
