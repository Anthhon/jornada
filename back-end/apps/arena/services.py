"""Orquestração da Arena: liga o motor PURO ao ORM (aqui mora o Django).

O motor (``engine.py``) não conhece Django. Este módulo carrega o estado das
tabelas para o motor, roda a regra e persiste o resultado (e o log).
"""

import random

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.groups.models import Group, GroupAbility
from apps.users.models import Student

from apps.bosses.engine import Ability

from . import engine
from .models import ArenaEvent, ArenaRound


def build_state(round_obj: ArenaRound) -> engine.RaidState:
    """Carrega o estado da raid do banco para a memória (o motor)."""
    config = engine.RaidConfig(
        multiplier=round_obj.multiplier,
        retaliation_ratio=round_obj.retaliation_ratio,
        reward_factor=round_obj.reward_factor,
        treasure=round_obj.treasure,
        balance_ref_teams=round_obj.balance_ref_teams,
    )
    abilities = [
        Ability.from_model(a) for a in round_obj.boss.abilities.all()
    ]
    state = engine.RaidState(
        max_hp=round_obj.max_hp,
        hp=round_obj.hp,
        status=round_obj.status,
        turn=round_obj.turn,
        config=config,
        abilities=abilities,
        outcome=round_obj.outcome or None,
    )
    contributions = list(round_obj.contributions.all())
    team_abilities = _team_abilities_by_group(
        [c.group_id for c in contributions]
    )
    for c in contributions:
        state.teams[c.group_id] = engine.TeamState(
            group_id=c.group_id,
            base_damage=c.base_damage,
            battle_damage=c.battle_damage,
            retaliation_loss=c.retaliation_loss,
            manual_adjustment=c.manual_adjustment,
            criteria=c.criteria,
            wrong_answers=c.wrong_answers,
            damage_factor=c.damage_factor,
            shield=c.shield,
            damage_buff=c.damage_buff,
            abilities=team_abilities.get(c.group_id, []),
        )
    return state


def _team_abilities_by_group(group_ids) -> dict:
    """Habilidades atribuídas (`GroupAbility`) agrupadas por equipe (ADR-021)."""
    mapping = {gid: [] for gid in group_ids}
    if not group_ids:
        return mapping
    rows = (
        GroupAbility.objects.filter(group_id__in=group_ids)
        .select_related("template")
        .order_by("template__kind", "template__name")
    )
    for row in rows:
        mapping[row.group_id].append(engine.TeamAbilityState(
            id=row.id,
            template_id=row.template_id,
            name=row.template.name,
            kind=row.template.kind,
            effect=row.template.effect,
            value=row.template.value,
            max_charges=row.template.max_charges,
            charges_left=row.charges_left,
        ))
    return mapping


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
    """Se a raid terminou, credita a recompensa proporcional UMA única vez.

    Na vitória (ADR-018) o **saque do chefe** é rateado por cima: golpe
    final para quem derrubou + resto proporcional ao dano.
    """
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
    if state.outcome == engine.OUTCOME_VICTORY:
        for gid, pts in engine.compute_treasure(state).items():
            if pts:
                Group.objects.filter(id=gid).update(points=F("points") + pts)
                note = " (golpe final!)" if gid == state.killing_team else ""
                events.append(engine.Event(
                    kind=engine.KIND_REWARD,
                    actor=engine.ACTOR_SYSTEM,
                    group_id=gid,
                    value=pts,
                    message=f"Saque do Chefe: {pts} pontos para a equipe{note}.",
                ))
    round_obj.rewards_credited = True


@transaction.atomic
def _persist(round_obj: ArenaRound, state: engine.RaidState, events: list) -> None:
    """Grava o estado do motor e os eventos novos no banco."""
    round_obj.hp = state.hp
    round_obj.status = state.status
    round_obj.turn = state.turn
    round_obj.outcome = state.outcome or ""
    round_obj.save()

    for gid, team in state.teams.items():
        contrib, _ = round_obj.contributions.get_or_create(group_id=gid)
        changed = []
        for field in (
            "base_damage", "battle_damage", "retaliation_loss",
            "manual_adjustment", "criteria", "wrong_answers", "damage_factor",
            "shield", "damage_buff",
        ):
            if getattr(contrib, field) != getattr(team, field):
                setattr(contrib, field, getattr(team, field))
                changed.append(field)
        if changed:
            contrib.save(update_fields=changed)
        # Cargas das habilidades de equipe (ADR-021) — só o que mudou.
        for ability in team.abilities:
            GroupAbility.objects.filter(pk=ability.id).exclude(
                charges_left=ability.charges_left
            ).update(charges_left=ability.charges_left)

    for ev in events:
        ArenaEvent.objects.create(
            round=round_obj,
            actor=ev.actor,
            group_id=ev.group_id,
            kind=ev.kind,
            value=ev.value,
            message=ev.message,
            roll=ev.roll,
            ability_id=ev.ability_id,
            ability_name=ev.ability_name,
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
        # Equipes recém-registradas ainda não têm linha de contribuição:
        # carrega as habilidades atribuídas (ADR-021) direto do catálogo.
        pending = [gid for gid, team in state.teams.items() if not team.abilities]
        if pending:
            abilities_map = _team_abilities_by_group(pending)
            for gid in pending:
                state.teams[gid].abilities = abilities_map.get(gid, [])
        # Cargas das habilidades de equipe repostas com a escala do bando
        # (ADR-020/021): menos equipes = mais cargas por equipe.
        ref = state.config.balance_ref_teams
        n = len(state.teams)
        for team in state.teams.values():
            for ability in team.abilities:
                ability.charges_left = engine.scaled_charges(
                    ability.max_charges, ref, n
                )
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


def _d20_roll() -> int:
    """Rolagem do d20 no servidor (ADR-019 — nunca no cliente)."""
    return random.randint(1, 20)


def use_ability(round_obj, group_id, ability_id):
    """Uso de habilidade de equipe com d20 (o roll vem do servidor)."""
    roll = _d20_roll()
    return _run(
        round_obj,
        lambda st: engine.use_ability(st, group_id, ability_id, roll),
    )


def renew_abilities(round_obj, group_id):
    return _run(round_obj, lambda st: engine.renew_abilities(st, group_id))


def performance_from_criteria(criteria: dict) -> float:
    """Desempenho derivado das notas do rubric (fórmula do front, ADR-017).

    Ignora Tempo (como ``presentationGrade``): soma dos outros 6 critérios
    ``x10/18``, limitada a 0..10, ``x100`` para a escala da raid (nota 8 -> 800).
    """
    total = sum(int(v) for key, v in criteria.items() if key != "tempo")
    grade = (total * 10) / 18
    return max(0.0, min(10.0, grade)) * 100


def apply_performance(round_obj, group_id=None, performance=None, criteria=None):
    def mutate(state):
        if group_id is not None:
            if criteria is not None and performance is None:
                perf = performance_from_criteria(criteria)
            else:
                perf = (
                    performance if performance is not None
                    else default_performance(group_id)
                )
            return engine.apply_performance(state, group_id, perf, criteria=criteria)
        # Modo em lote (sem notas): não avalia habilidades por critério.
        events = []
        for gid in state.teams:
            events.extend(
                engine.apply_performance(state, gid, default_performance(gid))
            )
        return events
    return _run(round_obj, mutate)


def adjust_points(round_obj, group_id, amount):
    return _run(round_obj, lambda st: engine.adjust_points(st, group_id, amount))
