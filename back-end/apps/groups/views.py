from django.db import transaction
from django.db.models import F
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.users.models import Student

from .models import Group
from .serializers import (
    ExtraPointsSerializer,
    GroupSerializer,
    LeaderboardSerializer,
    SetMembersSerializer,
)


class GroupViewSet(viewsets.ModelViewSet):
    """CRUD completo das equipes.

    Leitura aberta / escrita só professor vêm do DEFAULT_PERMISSION_CLASSES
    (apps.users.permissions.ReadOnlyOrStaff). Filtro: ``?active=true|false``.
    """

    queryset = Group.objects.all()
    serializer_class = GroupSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        active = self.request.query_params.get("active")
        if active is not None:
            qs = qs.filter(is_active=active.lower() in ("1", "true", "yes"))
        return qs

    @action(detail=True, methods=["post"], url_path="set-members")
    def set_members(self, request, pk=None):
        """Define de uma vez quem são os N alunos do grupo.

        Corpo: ``{"students": [ids]}``. Quem está na lista entra no grupo (saindo
        do anterior); quem está no grupo e não está na lista fica sem grupo.
        """
        group = self.get_object()
        data = SetMembersSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        ids = set(data.validated_data["students"])

        found = set(Student.objects.filter(pk__in=ids).values_list("pk", flat=True))
        if found != ids:
            raise ValidationError(
                {"students": f"Alunos inexistentes: {sorted(ids - found)}"}
            )
        with transaction.atomic():
            Student.objects.filter(group=group).exclude(pk__in=ids).update(group=None)
            Student.objects.filter(pk__in=ids).update(group=group)
        group.refresh_from_db()
        return Response(self.get_serializer(group).data)

    @action(detail=True, methods=["post"], url_path="add-extra-points")
    def add_extra_points(self, request, pk=None):
        """Soma pontos extras ao grupo. Corpo: ``{"amount": 5}``."""
        group = self.get_object()
        data = ExtraPointsSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        group.add_extra_points(data.validated_data["amount"])
        return Response(self.get_serializer(group).data)


class LeaderboardView(generics.ListAPIView):
    """`GET /api/leaderboard/` — placar público.

    Sem login (leitura aberta). Ordenação: pontos totais (batalhas + extras)
    desc, empate quebra por nome. A resposta é a lista das equipes ativas com
    `position` 1-based — formato de array simples, sem paginação.
    """

    queryset = Group.objects.all()
    serializer_class = LeaderboardSerializer

    def get_queryset(self):
        return (
            Group.objects.filter(is_active=True)
            .annotate(_total=F("points") + F("extra_points"))
            .order_by("-_total", "name")
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        entradas = [
            {"position": pos, **entry}
            for pos, entry in enumerate(serializer.data, start=1)
        ]
        return Response(entradas)
