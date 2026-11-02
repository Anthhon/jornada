from rest_framework import serializers

from .models import Group


class GroupSerializer(serializers.ModelSerializer):
    # Propriedades do model (não são colunas) expostas como campos de leitura.
    member_count = serializers.IntegerField(read_only=True)
    total_points = serializers.IntegerField(read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "points",
            "extra_points",
            "total_points",
            "member_count",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class LeaderboardSerializer(GroupSerializer):
    """Entrada do placar público: mesmos dados da equipe, sem o `created_at`.

    A `position` é calculada na view (enumerate sobre a queryset ordenada).
    """

    class Meta(GroupSerializer.Meta):
        fields = ["id", "name", "points", "extra_points", "total_points", "member_count"]


class SetMembersSerializer(serializers.Serializer):
    students = serializers.ListField(child=serializers.IntegerField(), allow_empty=True)


class ExtraPointsSerializer(serializers.Serializer):
    amount = serializers.IntegerField(
        help_text="Pontos a somar (negativo para descontar)."
    )
