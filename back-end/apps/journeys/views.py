from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.users.models import Student
from apps.users.permissions import is_teacher, student_in_group

from . import battle
from .battle_serializers import AnswerSerializer, StartBattleSerializer, battle_state
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
    """CRUD de etapas (ordem única dentro da jornada). Filtro: ``?journey=<id>``."""

    queryset = Stage.objects.select_related("journey").prefetch_related(
        "boss_pool"
    )
    serializer_class = StageSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("journey") is not None:
            qs = qs.filter(journey_id=self.request.query_params["journey"])
        return qs


class GroupJourneyViewSet(viewsets.ModelViewSet):
    """CRUD do vínculo grupo ↔ jornada + histórico.

    Filtros (histórico de jornadas participadas/finalizadas):
    ``?group=<id>``, ``?journey=<id>``, ``?status=PROG|DONE|FAIL``,
    ``?student=<id>`` (jornadas do grupo em que o aluno está hoje).
    """

    queryset = GroupJourney.objects.select_related(
        "group", "journey", "current_stage"
    )
    serializer_class = GroupJourneySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        for field, lookup in (
            ("group", "group_id"),
            ("journey", "journey_id"),
            ("status", "status"),
            ("student", "group__students__id"),
        ):
            if params.get(field) is not None:
                qs = qs.filter(**{lookup: params[field]})
        return qs

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        """Nota/pontuação final da jornada e desempenho por aluno."""
        return Response(battle.journey_summary(self.get_object()))


class StageProgressViewSet(viewsets.ModelViewSet):
    """CRUD do progresso de um grupo numa etapa (batalha)."""

    queryset = StageProgress.objects.select_related(
        "group_journey", "stage", "boss"
    )
    serializer_class = StageProgressSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("group_journey") is not None:
            qs = qs.filter(group_journey_id=self.request.query_params["group_journey"])
        return qs


class BattleEventViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """Log de batalha APPEND-ONLY: criação é permitida (registro manual ou
    motor), edição e exclusão não — é a trilha de auditoria da disputa.
    Filtro: ``?progress=<id>``.
    """

    queryset = BattleEvent.objects.select_related("progress")
    serializer_class = BattleEventSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("progress") is not None:
            qs = qs.filter(progress_id=self.request.query_params["progress"])
        return qs


class BattleViewSet(viewsets.ViewSet):
    """Execução da batalha (regras no servidor; o front só chama e desenha).

    - ``POST /api/battle/start/``      abre a próxima etapa do grupo (sorteia o chefe)
    - ``GET  /api/battle/{id}/``       estado atual (aberto: serve o placar ao vivo)
    - ``POST /api/battle/{id}/answer/`` responde a pergunta pendente (+ feitiço opcional)

    Quem joga: professor, ou aluno ativo que é membro do grupo da batalha.
    """

    def get_permissions(self):
        # Estado é público (placar ao vivo). Jogar exige login; QUEM pode jogar
        # (professor ou membro do grupo) é checado em _ensure_can_play.
        if self.action == "retrieve":
            return [AllowAny()]
        return [IsAuthenticated()]

    @staticmethod
    def _ensure_can_play(request, group_id):
        user = request.user
        if not (user and user.is_authenticated):
            raise NotAuthenticated()
        if not (is_teacher(user) or student_in_group(user, group_id)):
            raise PermissionDenied("Só o professor ou membros do grupo podem jogar.")

    @staticmethod
    def _run(fn, *args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except battle.BattleError as exc:
            raise ValidationError({"detail": str(exc)})

    def retrieve(self, request, pk=None):
        progress = get_object_or_404(
            StageProgress.objects.select_related(
                "group_journey__group", "stage", "boss", "current_question"
            ),
            pk=pk,
        )
        return Response(battle_state(progress))

    @action(detail=False, methods=["post"])
    def start(self, request):
        data = StartBattleSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        gj = get_object_or_404(
            GroupJourney.objects.select_related("group", "journey"),
            pk=data.validated_data["group_journey"],
        )
        self._ensure_can_play(request, gj.group_id)
        stage = None
        if data.validated_data.get("stage") is not None:
            stage = get_object_or_404(
                Stage, pk=data.validated_data["stage"], journey_id=gj.journey_id
            )
        progress = self._run(battle.start_stage, gj, stage)
        progress = StageProgress.objects.select_related(
            "group_journey__group", "stage", "boss", "current_question"
        ).get(pk=progress.pk)
        return Response(battle_state(progress), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def answer(self, request, pk=None):
        progress = get_object_or_404(
            StageProgress.objects.select_related("group_journey__group"), pk=pk
        )
        self._ensure_can_play(request, progress.group_journey.group_id)
        data = AnswerSerializer(data=request.data)
        data.is_valid(raise_exception=True)

        own = getattr(request.user, "student", None)
        if is_teacher(request.user):
            student = None
            if data.validated_data.get("student") is not None:
                student = get_object_or_404(Student, pk=data.validated_data["student"])
        else:
            student = own  # aluno sempre responde como ele mesmo

        progress, correct, events = self._run(
            battle.answer,
            progress,
            data.validated_data["choice"],
            student=student,
            spell_id=data.validated_data.get("spell"),
        )
        progress = StageProgress.objects.select_related(
            "group_journey__group", "stage", "boss", "current_question"
        ).get(pk=progress.pk)
        return Response({
            "correct": correct,
            "finished": progress.status != StageProgress.Status.IN_PROGRESS,
            "victory": progress.status == StageProgress.Status.COMPLETED,
            "state": battle_state(progress),
        })
