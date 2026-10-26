from rest_framework import generics, viewsets
from rest_framework.response import Response

from .models import Group
from .serializers import GroupSerializer, LeaderboardSerializer


class GroupViewSet(viewsets.ModelViewSet):
    """CRUD completo das equipes (8 equipes A–H na regra oficial).

    Leitura aberta / escrita só staff vêm do DEFAULT_PERMISSION_CLASSES
    (apps.users.permissions.ReadOnlyOrStaff).
    """

    queryset = Group.objects.all()
    serializer_class = GroupSerializer


class LeaderboardView(generics.ListAPIView):
    """`GET /api/leaderboard/` — placar público (épico da Lista 1-2).

    Sem login (leitura aberta, ADR-009). Ordenação: `points` desc, empate
    quebra por nome (regra do torneio: mais pontos primeiro). A resposta é a
    lista das equipes com `position` 1-based — formato de array simples,
    igual aos demais endpoints (sem paginação por enquanto).

    Quando existir o model de notas/AP1 (Fase 1), a entrada ganha essas
    colunas — a rota e o contrato ficam os mesmos.
    """

    queryset = Group.objects.all()
    serializer_class = LeaderboardSerializer

    def get_queryset(self):
        return Group.objects.order_by("-points", "name")

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        entradas = [
            {"position": pos, **entry}
            for pos, entry in enumerate(serializer.data, start=1)
        ]
        return Response(entradas)
