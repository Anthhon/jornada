"""Orquestração da Arena: liga o motor PURO ao ORM (aqui mora o Django).

O motor (``engine.py``) não conhece Django. Este módulo carrega o estado das
tabelas para o motor, roda a regra e persiste o resultado (e o log).
"""

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.groups.models import Group
from apps.users.models import Student

from . import engine
from .models import ArenaEvent, ArenaRound


def build_state(round_obj: ArenaRound) -> engine.RaidState:
    """Carrega o estado da raid do banco para a memória (o motor)."""
    config = engine.RaidConfig(
        multiplier=round_obj.multiplier,
        retaliation_ratio=round_obj.retaliation_ratio,
        reward_factor=round_obj.reward_factor,
    )
    state = engine.RaidState(
        max_hp=round_obj.max_hp,
        hp=round_obj.hp,
        status=round_obj.status,
        turn=round_obj.turn,
        config=config,
    )
    for c in round_obj.contributions.all():
        state.teams[c.group_id] = engine.TeamState(
            group_id=c.group_id,
            base_damage=c.base_damage,
            battle_damage=c.battle_damage,
            retaliation_loss=c.retaliation_loss,
            manual_adjustment=c.manual_adjustment,
        )
    return state


def default_performance(group_id: int) -> float:
    """Desempenho padrão: média das notas ativas da equipe x 100 (nota 8 -> 800)."""
    grades = [
        g for g in Student.objects.filter(
            group_id=group_id, is_active=True
        ).values_list("grade", flat=True)
        if g is not None
    ]
    if not grades:
        return 0.0
    return (sum(grades) / len(grades)) * 100


def _credit_rewards(round_obj: ArenaRound, state: engine.RaidState, events: list) -> None:
    """Se a raid terminou, credita a recompensa proporcional UMA única vez."""
    if state.status != engine.STATUS_ENDED or round_obj.rewards_credited:
        return
    for gid, pts in engine.compute_rewards(state).items():
        if pts:
            Group.objects.filter(id=gid).update(points=F("points") + pts)
            events.append(engine.Event(
                kind=engine.KIND_REWARD,
                actor=engine.ACTOR_SYSTEM,
                group_id=gid,
                value=pts,
                message=f"Recompensa: {pts} pontos para a equipe.",
            ))
    round_obj.rewards_credited = True


@transaction.atomic
def _persist(round_obj: ArenaRound, state: engine.RaidState, events: list) -> None:
    """Grava o estado do motor e os eventos novos no banco."""
    round_obj.hp = state.hp
    round_obj.status = state.status
    round_obj.turn = state.turn
    round_obj.save()

    for gid, team in state.teams.items():
        contrib, _ = round_obj.contributions.get_or_create(group_id=gid)
        changed = []
        for field in ("base_damage", "battle_damage", "retaliation_loss", "manual_adjustment"):
            if getattr(contrib, field) != getattr(team, field):
                setattr(contrib, field, getattr(team, field))
                changed.append(field)
        if changed:
            contrib.save(update_fields=changed)

    for ev in events:
        ArenaEvent.objects.create(
            round=round_obj,
            actor=ev.actor,
            group_id=ev.group_id,
            kind=ev.kind,
            value=ev.value,
            message=ev.message,
        )


def _run(round_obj, mutate):
    """Carrega, aplica ``mutate(state)``, credita recompensas se terminou, persiste."""
    state = build_state(round_obj)
    events = mutate(state)
    _credit_rewards(round_obj, state, events)
    _persist(round_obj, state, events)
    round_obj.refresh_from_db()
    return state, events


def start_round(round_obj):
    def mutate(state):
        for gid in Group.objects.filter(is_active=True).values_list("id", flat=True):
            engine.register_team(state, gid)
        if round_obj.started_at is None:
            round_obj.started_at = timezone.now()
        return engine.start(state)
    return _run(round_obj, mutate)


def pause_round(round_obj):
    return _run(round_obj, engine.pause)


def resume_round(round_obj):
    return _run(round_obj, engine.resume)


def end_round(round_obj):
    return _run(round_obj, engine.end)


def attack(round_obj, group_id, correct, points):
    return _run(round_obj, lambda st: engine.attack(st, group_id, correct, points))


def add_damage(round_obj, group_id, damage):
    return _run(round_obj, lambda st: engine.add_damage(st, group_id, damage))


def apply_performance(round_obj, group_id=None, performance=None):
    def mutate(state):
        if group_id is not None:
            perf = performance if performance is not None else default_performance(group_id)
            targets = [(group_id, perf)]
        else:
            targets = [(gid, default_performance(gid)) for gid in state.teams]
        events = []
        for gid, perf in targets:
            events.extend(engine.apply_performance(state, gid, perf))
        return events
    return _run(round_obj, mutate)


def adjust_points(round_obj, group_id, amount):
    return _run(round_obj, lambda st: engine.adjust_points(st, group_id, amount))
