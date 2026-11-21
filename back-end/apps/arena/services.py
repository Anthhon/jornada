"""Orquestração da Arena: liga o motor PURO ao ORM (aqui mora o Django).

O motor (``engine.py``) não conhece Django. Este módulo carrega o estado das
tabelas para o motor, roda a regra e persiste o resultado (e o log).
"""

import random
from datetime import datetime

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
        killing_team=round_obj.killing_team,
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


def _snapshot(round_obj: ArenaRound, state: engine.RaidState) -> dict:
    """Checkpoint do estado ANTES da ação (base do desfazer, M-50).

    Só o estado de batalha: datas e parâmetros ficam de fora — o professor
    pode remarcá-los sem que um desfazer os volte atrás.
    """
    return {
        "hp": state.hp,
        "turn": state.turn,
        "status": state.status,
        "outcome": state.outcome or "",
        "killing_team": state.killing_team,
        "started_at": (
            round_obj.started_at.isoformat() if round_obj.started_at else None
        ),
        "finished_at": (
            round_obj.finished_at.isoformat() if round_obj.finished_at else None
        ),
        "rewards_credited": round_obj.rewards_credited,
        "teams": [
            {
                "group_id": team.group_id,
                "base_damage": team.base_damage,
                "battle_damage": team.battle_damage,
                "retaliation_loss": team.retaliation_loss,
                "manual_adjustment": team.manual_adjustment,
                "criteria": team.criteria,
                "wrong_answers": team.wrong_answers,
                "damage_factor": team.damage_factor,
                "shield": team.shield,
                "damage_buff": team.damage_buff,
                "abilities": [
                    {"id": ab.id, "charges_left": ab.charges_left}
                    for ab in team.abilities
                ],
            }
            for team in state.teams.values()
        ],
    }


def _parse_dt(value):
    return datetime.fromisoformat(value) if value else None


def _restore(round_obj: ArenaRound, data: dict) -> None:
    """Regrava um checkpoint: campos da rodada + contribuições + cargas.

    Contribuições criadas depois do checkpoint (ex.: registro no start)
    são removidas — o estado volta exatamente ao ponto salvo.
    """
    round_obj.hp = data["hp"]
    round_obj.turn = data["turn"]
    round_obj.status = data["status"]
    round_obj.outcome = data["outcome"]
    round_obj.killing_team = data.get("killing_team")
    round_obj.started_at = _parse_dt(data.get("started_at"))
    round_obj.finished_at = _parse_dt(data.get("finished_at"))
    round_obj.rewards_credited = data["rewards_credited"]
    round_obj.save()

    keep = set()
    for team in data["teams"]:
        gid = team["group_id"]
        keep.add(gid)
        contrib, _ = round_obj.contributions.get_or_create(group_id=gid)
        for field in (
            "base_damage", "battle_damage", "retaliation_loss",
            "manual_adjustment", "criteria", "wrong_answers",
            "damage_factor", "shield", "damage_buff",
        ):
            setattr(contrib, field, team[field])
        contrib.save()
        for ability in team.get("abilities", []):
            GroupAbility.objects.filter(pk=ability["id"]).update(
                charges_left=ability["charges_left"]
            )
    round_obj.contributions.exclude(group_id__in=keep).delete()


@transaction.atomic
def _persist(round_obj: ArenaRound, state: engine.RaidState, events: list,
             checkpoint: dict = None) -> None:
    """Grava o estado do motor e os eventos novos no banco."""
    round_obj.hp = state.hp
    round_obj.status = state.status
    round_obj.turn = state.turn
    round_obj.outcome = state.outcome or ""
    round_obj.killing_team = state.killing_team
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

    for index, ev in enumerate(events):
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
            # Checkpoint no primeiro evento da ação (M-50): o desfazer
            # regrava este estado e apaga o lote da ação inteiro.
            snapshot=(
                checkpoint
                if checkpoint is not None and index == 0
                else None
            ),
        )


def _run(round_obj, mutate, snapshot=True):
    """Carrega, aplica ``mutate(state)``, credita recompensas se terminou, persiste.

    Com ``snapshot`` (padrão), o estado **antes** da ação vira checkpoint no
    primeiro evento gerado — é o que ``undo_round`` restaura (M-50). Ações de
    ciclo e liquidação (``end``, ``reopen``, ``undo``) passam ``False``: elas
    nunca são reversíveis por desfazer (o fim tem o ``reopen``, que estorna
    as recompensas).
    """
    state = build_state(round_obj)
    checkpoint = _snapshot(round_obj, state) if snapshot else None
    events = mutate(state)
    _credit_rewards(round_obj, state, events)
    _persist(round_obj, state, events, checkpoint)
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
    if round_obj.finished_at is None:
        round_obj.finished_at = timezone.now()
    # O fim nunca vira checkpoint do desfazer: o caminho de volta é o
    # ``reopen_round`` (que estorna recompensa e saque).
    return _run(round_obj, engine.end, snapshot=False)


@transaction.atomic
def reopen_round(round_obj):
    """ENDED -> RUNNING desfazendo a liquidação (M-50).

    Estorna recompensa **e** saque creditados: o cálculo roda de novo sobre
    o mesmo estado — seguro porque ``adjust_points`` recusa placar em ENDED
    (o encerramento não pode ter mudado). Sem checkpoint: o ``undo_round``
    atravessa o fim só quando já não há recompensa em pé.
    """
    if round_obj.status != ArenaRound.Status.ENDED:
        raise engine.ArenaError("Só é possível reabrir uma disputa encerrada.")
    if round_obj.rewards_credited:
        state = build_state(round_obj)
        for gid, pts in engine.compute_rewards(state).items():
            if pts:
                Group.objects.filter(id=gid).update(points=F("points") - pts)
        if state.outcome == engine.OUTCOME_VICTORY:
            for gid, pts in engine.compute_treasure(state).items():
                if pts:
                    Group.objects.filter(id=gid).update(points=F("points") - pts)
        round_obj.rewards_credited = False

    def mutate(state):
        round_obj.finished_at = None
        return engine.reopen(state)

    return _run(round_obj, mutate, snapshot=False)


def set_hp_round(round_obj, value):
    """Ajuste do PV do chefe pelo professor — restaurar manda o máximo (M-50)."""
    return _run(round_obj, lambda st: engine.set_hp(st, value))


@transaction.atomic
def undo_round(round_obj):
    """Desfaz a última ação com checkpoint e trunca o log (M-50).

    Uma ação por vez (encadeia): o checkpoint mais recente define o ponto
    de volta, e os eventos de status depois dele caem junto — o status vem
    do próprio checkpoint. O fim da disputa só é atravessado se as
    recompensas já saíram do pé (``reopen``), senão o estorno fica torto.
    """
    checkpoint = (
        round_obj.events.filter(snapshot__isnull=False)
        .order_by("-id")
        .first()
    )
    if checkpoint is None:
        raise engine.ArenaError("Nada para desfazer.")
    crosses_end = round_obj.events.filter(
        id__gt=checkpoint.id, kind=ArenaEvent.Kind.END
    ).exists()
    if crosses_end and round_obj.rewards_credited:
        raise engine.ArenaError(
            "Não dá para desfazer: a disputa foi encerrada com recompensas "
            "creditadas. Reabra a disputa para voltar atrás."
        )
    _restore(round_obj, checkpoint.snapshot)
    round_obj.events.filter(id__gte=checkpoint.id).delete()
    ArenaEvent.objects.create(
        round=round_obj,
        actor=engine.ACTOR_SYSTEM,
        kind=engine.KIND_EDIT,
        value=0,
        message="Última ação desfeita.",
    )
    round_obj.refresh_from_db()


def duplicate_round(round_obj) -> ArenaRound:
    """Cópia da rodada em CONFIG, sem histórico (M-50).

    Mesmos parâmetros, datas e PV cheio; placar, log e marcações de tempo
    ficam na original — a cópia começa do zero.
    """
    return ArenaRound.objects.create(
        name=f"{round_obj.name} (cópia)",
        journey=round_obj.journey,
        boss=round_obj.boss,
        level=round_obj.level,
        max_hp=round_obj.max_hp,
        multiplier=round_obj.multiplier,
        retaliation_ratio=round_obj.retaliation_ratio,
        reward_factor=round_obj.reward_factor,
        balance_ref_teams=round_obj.balance_ref_teams,
        treasure=round_obj.treasure,
        date=round_obj.date,
        deadline=round_obj.deadline,
    )


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
    """Ajuste manual do professor nos pontos de uma equipe (ADR-011).

    Em ``CONFIG`` a equipe ativa é registrada em bloco: o placar da
    rodada pode ser lançado **antes** de a batalha começar (tela de
    Configuração da Rodada, M-49). Fora do CONFIG, só quem já está
    na batalha pode ser ajustado.
    """
    def mutate(state):
        if round_obj.status == ArenaRound.Status.ENDED:
            raise engine.ArenaError(
                "A disputa está encerrada — reabra para ajustar o placar."
            )
        if group_id not in state.teams:
            ativo = Group.objects.filter(
                id=group_id, is_active=True
            ).exists()
            if round_obj.status != ArenaRound.Status.CONFIG or not ativo:
                raise engine.ArenaError(
                    "Equipe não registrada nesta batalha."
                )
            engine.register_team(state, group_id)
        return engine.adjust_points(state, group_id, amount)
    return _run(round_obj, mutate)
