from rest_framework import serializers

from .models import ArenaEvent, ArenaRound, TeamContribution


class BossAbilityBriefSerializer(serializers.ModelSerializer):
    """Habilidade do chefe exibida no estado da raid (habilidades executáveis)."""

    class Meta:
        from apps.bosses.models import BossAbility

        model = BossAbility
        fields = [
            "id", "name", "trigger", "effect", "value", "every",
            "threshold", "mode", "scope", "min_count", "description",
        ]


class BossBriefSerializer(serializers.ModelSerializer):
    """Resumo do chefe exibido no estado da raid (PV + habilidades)."""

    abilities = BossAbilityBriefSerializer(many=True, read_only=True)

    class Meta:
        from apps.bosses.models import Boss

        model = Boss
        fields = ["id", "name", "max_hp", "abilities"]


class ArenaEventSerializer(serializers.ModelSerializer):
    group_name = serializers.SerializerMethodField()

    class Meta:
        model = ArenaEvent
        fields = ["id", "kind", "actor", "group", "group_name", "value", "message", "created_at"]

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None


class TeamContributionSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)
    total_damage = serializers.IntegerField(read_only=True)
    points = serializers.IntegerField(read_only=True)

    class Meta:
        model = TeamContribution
        fields = [
            "group", "group_name", "base_damage", "battle_damage",
            "total_damage", "retaliation_loss", "manual_adjustment", "points",
            "criteria", "wrong_answers", "damage_factor",
        ]


class ArenaRoundSerializer(serializers.ModelSerializer):
    contributions = TeamContributionSerializer(many=True, read_only=True)

    class Meta:
        model = ArenaRound
        fields = [
            "id", "name", "journey", "boss", "level", "max_hp", "hp", "turn",
            "multiplier", "retaliation_ratio", "reward_factor", "status",
            "date", "deadline", "started_at", "finished_at", "rewards_credited",
            "created_at", "contributions",
        ]
        read_only_fields = [
            "hp", "turn", "status", "started_at", "finished_at",
            "rewards_credited", "created_at",
        ]


class ArenaStateSerializer(serializers.ModelSerializer):
    """Payload do ``GET /state``: hp, placar ao vivo e log (polling do front)."""

    boss = BossBriefSerializer(read_only=True)
    teams = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()

    class Meta:
        model = ArenaRound
        fields = [
            "id", "name", "status", "hp", "max_hp", "turn", "level",
            "multiplier", "retaliation_ratio", "reward_factor",
            "boss", "teams", "events", "rewards_credited",
        ]

    def get_teams(self, obj):
        data = []
        for c in obj.contributions.select_related("group").all():
            data.append({
                "group_id": c.group_id,
                "group_name": c.group.name,
                "base_damage": c.base_damage,
                "battle_damage": c.battle_damage,
                "total_damage": c.total_damage,
                "retaliation_loss": c.retaliation_loss,
                "manual_adjustment": c.manual_adjustment,
                "points": c.points,
                "criteria": c.criteria,
                "wrong_answers": c.wrong_answers,
                "damage_factor": c.damage_factor,
            })
        data.sort(key=lambda t: t["points"], reverse=True)
        for i, t in enumerate(data, 1):
            t["position"] = i
        return data

    def get_events(self, obj):
        return ArenaEventSerializer(
            obj.events.select_related("group").all(), many=True
        ).data


class AttackSerializer(serializers.Serializer):
    group_id = serializers.IntegerField()
    correct = serializers.BooleanField(default=True)
    points = serializers.IntegerField(default=10, min_value=0)


class PerformanceSerializer(serializers.Serializer):
    group_id = serializers.IntegerField(required=False)
    performance = serializers.FloatField(required=False)
    criteria = serializers.DictField(
        child=serializers.IntegerField(),
        required=False,
        help_text="7 notas do rubric ({chave: -1|1|3}) — dispara as habilidades.",
    )

    def validate_criteria(self, value):
        from apps.bosses.engine import CRITERIA_KEYS, SCORES

        missing = [key for key in CRITERIA_KEYS if key not in value]
        if missing:
            raise serializers.ValidationError(
                f"Notas incompletas: faltam {', '.join(missing)}."
            )
        extra = [key for key in value if key not in CRITERIA_KEYS]
        if extra:
            raise serializers.ValidationError(
                f"Critérios desconhecidos: {', '.join(extra)}."
            )
        for key, score in value.items():
            if int(score) not in SCORES:
                raise serializers.ValidationError(
                    f"Nota inválida em '{key}': use 3 (Bom), 1 (Parcial) ou -1."
                )
        return {key: int(score) for key, score in value.items()}

    def validate(self, attrs):
        if attrs.get("criteria") is not None and attrs.get("group_id") is None:
            raise serializers.ValidationError(
                "Notas por critério exigem group_id (registro por equipe)."
            )
        return attrs


class DamageSerializer(serializers.Serializer):
    group_id = serializers.IntegerField()
    damage = serializers.IntegerField(min_value=0)


class OverrideSerializer(serializers.Serializer):
    group_id = serializers.IntegerField()
    amount = serializers.IntegerField()
