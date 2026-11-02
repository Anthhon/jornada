"""Serialização do estado da batalha (o que o front desenha a cada rodada).

A alternativa correta NUNCA sai daqui: o front não pode ver o gabarito.
"""

from rest_framework import serializers

from apps.bosses.models import Choice, Question

from . import battle
from .models import BattleEvent


class PublicChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ["id", "text"]  # sem is_correct


class PublicQuestionSerializer(serializers.ModelSerializer):
    choices = PublicChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ["id", "text", "points", "choices"]


class BattleEventLogSerializer(serializers.ModelSerializer):
    spell_name = serializers.CharField(source="spell.name", read_only=True, default=None)

    class Meta:
        model = BattleEvent
        fields = [
            "id", "turn", "actor", "student", "question", "answered_correctly",
            "spell", "spell_name", "value", "created_at",
        ]


def battle_state(progress):
    """Foto completa da batalha (tudo que o front precisa em uma chamada)."""
    gj = progress.group_journey
    hero = battle.hero_of(gj)
    stage = progress.stage
    return {
        "id": progress.id,
        "status": progress.status,
        "turn": progress.turn,
        "score": progress.score,
        "started_at": progress.started_at,
        "finished_at": progress.finished_at,
        "group_journey": {
            "id": gj.id,
            "status": gj.status,
            "group": gj.group_id,
            "group_name": gj.group.name,
            "journey": gj.journey_id,
        },
        "stage": {
            "id": stage.id,
            "order": stage.order,
            "name": stage.name,
            "max_score": stage.max_score,
        },
        "hero": {
            "id": hero.id if hero else None,
            "name": hero.name if hero else None,
            "power_bonus": hero.power_bonus if hero else 0,
            "hp": progress.hp,
            "max_hp": progress.max_hp,
            "shield": progress.shield,
        },
        "boss": {
            "id": progress.boss_id,
            "name": progress.boss.name,
            "hp": progress.boss_hp,
            "max_hp": progress.boss_max_hp,
            "shield": progress.boss_shield,
        },
        "question": (
            PublicQuestionSerializer(progress.current_question).data
            if progress.current_question_id
            else None
        ),
        "spells": [
            {
                "id": item["spell"].id,
                "name": item["spell"].name,
                "description": item["spell"].description,
                "spell_type": item["spell"].spell_type,
                "base_value": item["spell"].base_value,
                "cooldown_turns": item["spell"].cooldown_turns,
                "ready": item["ready"],
                "cooldown_left": item["cooldown_left"],
            }
            for item in battle.available_spells(progress)
        ]
        if progress.status == progress.Status.IN_PROGRESS
        else [],
        "events": BattleEventLogSerializer(
            progress.events.select_related("spell"), many=True
        ).data,
    }


class StartBattleSerializer(serializers.Serializer):
    group_journey = serializers.IntegerField()
    stage = serializers.IntegerField(required=False, allow_null=True)


class AnswerSerializer(serializers.Serializer):
    choice = serializers.IntegerField()
    student = serializers.IntegerField(required=False, allow_null=True)
    spell = serializers.IntegerField(required=False, allow_null=True)
