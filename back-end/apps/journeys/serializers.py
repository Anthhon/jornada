from rest_framework import serializers, validators

from .models import BattleEvent, GroupJourney, Journey, Stage, StageProgress


class JourneySerializer(serializers.ModelSerializer):
    class Meta:
        model = Journey
        fields = [
            "id",
            "name",
            "description",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class StageSerializer(serializers.ModelSerializer):
    """CRUD de etapas de uma jornada.

    O model usa ``UniqueConstraint(journey, order)`` (o DRF não deriva
    validador de ``Meta.constraints``), então o validador é explícito — sem
    ele, duplicidade daria 500 em vez de 400.
    """

    journey_name = serializers.SerializerMethodField()
    boss_names = serializers.StringRelatedField(
        source="boss_pool", many=True, read_only=True
    )

    class Meta:
        model = Stage
        fields = [
            "id",
            "journey",
            "journey_name",
            "order",
            "name",
            "description",
            "max_score",
            "boss_pool",
            "boss_names",
        ]
        validators = [
            validators.UniqueTogetherValidator(
                queryset=Stage.objects.all(),
                fields=["journey", "order"],
                message="Esta jornada já tem uma etapa com esta ordem.",
            )
        ]

    def get_journey_name(self, obj):
        return obj.journey.name if obj.journey else None


class GroupJourneySerializer(serializers.ModelSerializer):
    total_score = serializers.IntegerField(read_only=True)
    group_name = serializers.SerializerMethodField()
    journey_name = serializers.SerializerMethodField()

    class Meta:
        model = GroupJourney
        fields = [
            "id",
            "group",
            "group_name",
            "journey",
            "journey_name",
            "status",
            "current_stage",
            "started_at",
            "finished_at",
            "total_score",
        ]
        read_only_fields = ["started_at"]
        validators = [
            validators.UniqueTogetherValidator(
                queryset=GroupJourney.objects.all(),
                fields=["group", "journey"],
                message="Este grupo já está vinculado a esta jornada.",
            )
        ]

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None

    def get_journey_name(self, obj):
        return obj.journey.name if obj.journey else None


class StageProgressSerializer(serializers.ModelSerializer):
    """Progresso de um grupo numa etapa (herda HP/escudo do Combatant)."""

    stage_name = serializers.SerializerMethodField()

    class Meta:
        model = StageProgress
        fields = [
            "id",
            "group_journey",
            "stage",
            "stage_name",
            "boss",
            "max_hp",
            "hp",
            "shield",
            "score",
            "status",
            "started_at",
            "finished_at",
        ]
        read_only_fields = ["started_at"]
        validators = [
            validators.UniqueTogetherValidator(
                queryset=StageProgress.objects.all(),
                fields=["group_journey", "stage"],
                message="Este grupo já tem progresso nesta etapa.",
            )
        ]

    def get_stage_name(self, obj):
        return str(obj.stage) if obj.stage else None


class BattleEventSerializer(serializers.ModelSerializer):
    """Evento de batalha (log append-only — ver BattleEventViewSet)."""

    class Meta:
        model = BattleEvent
        fields = [
            "id",
            "progress",
            "turn",
            "actor",
            "student",
            "question",
            "answered_correctly",
            "spell",
            "value",
            "created_at",
        ]
        read_only_fields = ["created_at"]
