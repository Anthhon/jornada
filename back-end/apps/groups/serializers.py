from rest_framework import serializers

from .models import Group


class GroupSerializer(serializers.ModelSerializer):
    # Propriedade do model (não é coluna) exposta como campo de leitura.
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "points",
            "member_count",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class LeaderboardSerializer(GroupSerializer):
    """Entrada do placar público: mesmos dados da equipe, sem o `created_at`.

    A `position` é calculada na view (enumerate sobre a queryset ordenada).
    """

    class Meta(GroupSerializer.Meta):
        fields = ["id", "name", "points", "member_count"]
