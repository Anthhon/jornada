from rest_framework import serializers

from .models import Group, GroupAbility, TeamAbilityTemplate


class TeamAbilityTemplateSerializer(serializers.ModelSerializer):
    """Catálogo de habilidades de equipe (o professor escolhe 3+1, ADR-021)."""

    class Meta:
        model = TeamAbilityTemplate
        fields = [
            "id", "theme", "name", "kind", "effect", "value", "max_charges",
            "description",
        ]


class GroupSerializer(serializers.ModelSerializer):
    # Propriedades do model (não são colunas) expostas como campos de leitura.
    member_count = serializers.IntegerField(read_only=True)
    total_points = serializers.IntegerField(read_only=True)
    abilities = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
        help_text=(
            "Ids dos modelos escolhidos: exatamente 3 básicas + 1 ultimate "
            "(só usadas na Arena — ADR-021)."
        ),
    )

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
            "abilities",
        ]
        read_only_fields = ["created_at"]

    def validate_abilities(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Habilidades repetidas.")
        if len(value) != 4:
            raise serializers.ValidationError(
                "Escolha exatamente 4 habilidades (3 básicas + 1 ultimate)."
            )
        templates = TeamAbilityTemplate.objects.filter(id__in=value)
        if len(templates) != len(value):
            raise serializers.ValidationError("Modelo de habilidade inexistente.")
        basics = sum(1 for t in templates if t.kind == TeamAbilityTemplate.Kind.BASIC)
        if basics != 3:
            raise serializers.ValidationError(
                "A escolha precisa ser 3 básicas + 1 ultimate."
            )
        return value

    def create(self, validated_data):
        template_ids = validated_data.pop("abilities", None)
        group = super().create(validated_data)
        self._sync_abilities(group, template_ids)
        return group

    def update(self, instance, validated_data):
        template_ids = validated_data.pop("abilities", None)
        group = super().update(instance, validated_data)
        if template_ids is not None:
            self._sync_abilities(group, template_ids)
        return group

    @staticmethod
    def _sync_abilities(group, template_ids):
        """Troca a escolha 3+1 mantendo as cargas das habilidades que ficam."""
        if template_ids is None:
            return
        group.abilities.exclude(template_id__in=template_ids).delete()
        present = set(
            group.abilities.values_list("template_id", flat=True)
        )
        GroupAbility.objects.bulk_create([
            GroupAbility(group=group, template_id=tid)
            for tid in template_ids if tid not in present
        ])


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
