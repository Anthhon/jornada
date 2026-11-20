from rest_framework import serializers

from .models import ArenaEvent, ArenaRound, TeamContribution


class BossBriefSerializer(serializers.ModelSerializer):
    """Resumo do chefe exibido no estado da raid."""

    class Meta:
        from apps.bosses.models import Boss

        model = Boss
        fields = ["id", "name", "max_hp"]


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


class DamageSerializer(serializers.Serializer):
    group_id = serializers.IntegerField()
    damage = serializers.IntegerField(min_value=0)


class OverrideSerializer(serializers.Serializer):
    group_id = serializers.IntegerField()
    amount = serializers.IntegerField()
