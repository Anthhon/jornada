"""Motor da Arena — raid coletivo do chefe da rodada. PURO, sem Django.

O módulo Arena convive com a batalha 1v1 (``apps.journeys.battle``): aqui
**um** chefe da rodada recebe o dano de **todas** as equipes ao mesmo tempo.

Fluxo de uma raid:
    new_raid()          -> cria o estado (CONFIG) com as equipes registradas.
    start()             -> CONFIG -> RUNNING.
    apply_performance() -> dano base do desempenho (+ notas da rubric ->
                           habilidades do chefe disparam: penalidade, cura,
                           drenagem, corte — ver ``apps.bosses.engine``).
    attack()            -> uma rodada: acerto causa dano e provoca retaliação;
                           erro conta para as habilidades "Perguntas".
                           (o ataque padrão é o **fallback** — sem d20)
    retaliate()         -> retaliação direta do chefe (fora do ataque).
    use_ability()       -> habilidade de equipe com rolagem de d20
                           (crítico/falha — ADR-019/021).
    renew_abilities()   -> professor repõe as cargas da equipe.
    compute_rewards()   -> recompensa final proporcional ao dano total.
    compute_treasure()  -> saque do chefe só na vitória (ADR-018).
    pause()/resume()/end() -> controle do professor (end define o desfecho:
                           VICTORY se o chefe caiu, RETREAT se escapa ferido).

Este arquivo **não importa Django** de propósito: o motor é testável sem banco
e a lógica fica isolada da persistência (regra de fronteira de camadas,
``PLANO.md §4.7``). A orquestração com o ORM vive em ``services.py``. A
avaliação de gatilhos vem de ``apps.bosses.engine`` (também puro) — o
motor da raid só aplica o efeito no estado (ADR-017).
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from apps.bosses import engine as boss_engine
from apps.bosses.engine import Ability

# Estados da raid (espelhados em models.ArenaRound.Status).
STATUS_CONFIG = "CONFIG"
STATUS_RUNNING = "RUNNING"
STATUS_PAUSED = "PAUSED"
STATUS_ENDED = "ENDED"

# Quem causou o evento (espelhados em models.ArenaEvent.Actor).
ACTOR_TEAM = "TEAM"
ACTOR_BOS = "BOS"
ACTOR_SYSTEM = "SYSTEM"

# Tipo do evento (espelhados em models.ArenaEvent.Kind).
KIND_START = "START"
KIND_PAUSE = "PAUSE"
KIND_RESUME = "RESUME"
KIND_DAMAGE = "DAMAGE"
KIND_RETALIATION = "RETALIATION"
KIND_REWARD = "REWARD"
KIND_END = "END"
KIND_ABILITY = "ABILITY"

# Desfecho da raid (espelhado em models.ArenaRound.outcome, ADR-018).
OUTCOME_VICTORY = "VICTORY"
OUTCOME_RETREAT = "RETREAT"

# Fatia do saque que vai para quem desferiu o golpe final (ADR-018).
FINAL_BLOW_SHARE = 0.10

# Efeitos das habilidades de equipe (ADR-021 — polaridade oposta ao chefe).
EFFECT_STRIKE = "STRIKE"
EFFECT_HEAL = "HEAL"
EFFECT_SHIELD = "SHIELD"
EFFECT_BUFF = "BUFF"
TEAM_EFFECTS = (EFFECT_STRIKE, EFFECT_HEAL, EFFECT_SHIELD, EFFECT_BUFF)

# d20: 19–20 crítico (×2), 1–2 falha (×0.5) — ADR-019.
D20_CRIT = 19
D20_FUMBLE = 2


class ArenaError(Exception):
    """Violação de regra de negócio (a view converte em HTTP 400)."""


@dataclass
class RaidConfig:
    """Parâmetros ajustáveis do raid (fórmulas a validar com o professor).

    - ``multiplier``: dano base = desempenho * multiplier.
    - ``retaliation_ratio``: retaliação (em pontos) = dano causado * ratio.
    - ``reward_factor``: recompensa (em pontos) = dano total * reward_factor.
    - ``treasure``: saque do chefe em pontos, rateado só na vitória (ADR-018).
    - ``balance_ref_teams``: escala do bando (0 = desligado; ADR-020).
    """

    multiplier: float = 1.5
    retaliation_ratio: float = 0.25
    reward_factor: float = 1.0
    treasure: int = 0
    balance_ref_teams: int = 0


@dataclass
class TeamAbilityState:
    """Habilidade de equipe atribuída (cópia de ``GroupAbility`` pro motor)."""

    id: int                 # pk de GroupAbility (para persistir as cargas)
    template_id: int
    name: str
    kind: str               # BASIC | ULTIMATE
    effect: str             # STRIKE | HEAL | SHIELD | BUFF
    value: int
    max_charges: int
    charges_left: int = 0


@dataclass
class TeamState:
    """Desempenho de uma equipe dentro da raid."""

    group_id: int
    base_damage: int = 0
    battle_damage: int = 0
    retaliation_loss: int = 0
    manual_adjustment: int = 0
    criteria: Optional[Dict[str, int]] = None  # notas da rubric (uma vez)
    wrong_answers: int = 0                     # erros de pergunta (gatilho)
    damage_factor: float = 1.0                 # corte de habilidade (0.5 = 50%)
    shield: int = 0                            # absorve retaliação/penalidade
    damage_buff: float = 0.0                   # +% no próximo ataque (0.3 = 30%)
    abilities: List[TeamAbilityState] = field(default_factory=list)

    @property
    def total_damage(self) -> int:
        return self.base_damage + self.battle_damage

    def points(self, config: "RaidConfig") -> int:
        """Pontos líquidos: proporcional ao dano, menos a retaliação, mais ajuste."""
        earned = round(self.total_damage * config.reward_factor)
        return max(0, earned - self.retaliation_loss + self.manual_adjustment)


@dataclass
class Event:
    """Um evento do log da raid (vira ArenaEvent ao persistir)."""

    kind: str
    actor: str
    group_id: Optional[int]
    value: int
    message: str
    roll: Optional[int] = None           # d20 no uso de habilidade (ADR-019)
    ability_id: Optional[int] = None     # habilidade executada (ADR-022)
    ability_name: Optional[str] = None


@dataclass
class RaidState:
    """Estado em memória da raid (espelhado nas tabelas ao persistir)."""

    max_hp: int
    hp: int
    status: str = STATUS_CONFIG
    turn: int = 0
    config: RaidConfig = field(default_factory=RaidConfig)
    teams: Dict[int, TeamState] = field(default_factory=dict)
    log: List[Event] = field(default_factory=list)
    abilities: List[Ability] = field(default_factory=list)
    outcome: Optional[str] = None        # VICTORY | RETREAT (ADR-018)
    killing_team: Optional[int] = None   # equipe do golpe final

    @property
    def is_over(self) -> bool:
        return self.hp <= 0


def _log(state, kind, actor, group_id, value, message, roll=None,
         ability_id=None, ability_name=None) -> Event:
    ev = Event(
        kind=kind, actor=actor, group_id=group_id, value=value,
        message=message, roll=roll, ability_id=ability_id,
        ability_name=ability_name,
    )
    state.log.append(ev)
    return ev


def _half_up(x: float) -> int:
    """Arredondamento meio-pra-cima (0.5 → 1), estável para valores ≥ 0."""
    return int(x + 0.5)


def d20_multiplier(roll: int) -> float:
    """Resultado do d20 na habilidade (ADR-019): crítico ×2, falha ×0.5."""
    if roll >= D20_CRIT:
        return 2.0
    if roll <= D20_FUMBLE:
        return 0.5
    return 1.0


def balance_factor_of(ref: int, n: int) -> float:
    """Escala do bando a partir de ``ref`` e nº de equipes (ADR-020)."""
    if ref <= 0 or n <= 0:
        return 1.0
    return max(0.5, min(2.0, ref / n))


def balance_factor(state: "RaidState") -> float:
    """Escala do bando (ADR-020): menos equipes = mais fortes.

    ``clamp(ref / n_equipes, 0.5, 2)``; ``ref <= 0`` desliga (motor puro).
    """
    return balance_factor_of(state.config.balance_ref_teams, len(state.teams))


def scaled_charges(base: int, ref: int, n: int) -> int:
    """Cargas de habilidade por raid com a escala do bando (ADR-020)."""
    if ref <= 0 or n <= 0:
        return base
    return max(1, _half_up(base * ref / n))


def _deal_boss_damage(state: "RaidState", damage: int,
                      team_id: Optional[int] = None) -> None:
    """Reduz o PV do chefe e anota quem desferiu o golpe final (ADR-018)."""
    if damage <= 0:
        return
    before = state.hp
    state.hp = max(0, state.hp - damage)
    if before > 0 and state.hp <= 0 and team_id is not None and state.killing_team is None:
        state.killing_team = team_id


def new_raid(max_hp: int, config: Optional[RaidConfig] = None,
             group_ids=(), abilities=()) -> RaidState:
    """Cria uma raid em CONFIG com as equipes e as habilidades do chefe."""
    state = RaidState(
        max_hp=max_hp,
        hp=max_hp,
        config=config or RaidConfig(),
        abilities=list(abilities),
    )
    for gid in group_ids:
        state.teams[gid] = TeamState(group_id=gid)
    return state


def register_team(state: RaidState, group_id: int) -> None:
    """Garante que a equipe está participando da raid."""
    if group_id not in state.teams:
        state.teams[group_id] = TeamState(group_id=group_id)


def _ensure_running(state: RaidState) -> None:
    if state.status != STATUS_RUNNING:
        raise ArenaError("A batalha não está em andamento.")


def _ensure_team(state: RaidState, group_id: int) -> TeamState:
    team = state.teams.get(group_id)
    if team is None:
        raise ArenaError("Equipe não registrada nesta batalha.")
    return team


def start(state: RaidState) -> List[Event]:
    """CONFIG -> RUNNING."""
    if state.status != STATUS_CONFIG:
        raise ArenaError("A batalha já foi iniciada.")
    state.status = STATUS_RUNNING
    return [_log(state, KIND_START, ACTOR_SYSTEM, None, 0, "Batalha iniciada.")]


def pause(state: RaidState) -> List[Event]:
    """RUNNING -> PAUSED."""
    if state.status != STATUS_RUNNING:
        raise ArenaError("Só é possível pausar uma batalha em andamento.")
    state.status = STATUS_PAUSED
    return [_log(state, KIND_PAUSE, ACTOR_SYSTEM, None, 0, "Batalha pausada.")]


def resume(state: RaidState) -> List[Event]:
    """PAUSED -> RUNNING."""
    if state.status != STATUS_PAUSED:
        raise ArenaError("Só é possível retomar uma batalha pausada.")
    state.status = STATUS_RUNNING
    return [_log(state, KIND_RESUME, ACTOR_SYSTEM, None, 0, "Batalha retomada.")]


def end(state: RaidState) -> List[Event]:
    """RUNNING/PAUSED -> ENDED (ADR-018): vitória ou fuga com o saque."""
    if state.status not in (STATUS_RUNNING, STATUS_PAUSED):
        raise ArenaError("A batalha não está em andamento.")
    state.status = STATUS_ENDED
    if state.hp <= 0:
        state.outcome = OUTCOME_VICTORY
        message = "Chefe derrotado! O saque está ao alcance."
    else:
        state.outcome = OUTCOME_RETREAT
        message = (
            "A batalha acabou: o chefe escapa ferido com o saque! "
            "(chefe em fuga — dá para continuar na próxima rodada)"
        )
    return [_log(state, KIND_END, ACTOR_SYSTEM, None, 0, message)]


def _check_victory(state: RaidState, events: List[Event]) -> None:
    """Se o chefe caiu, encerra a raid e registra a vitória (ADR-018)."""
    if state.is_over and state.status != STATUS_ENDED:
        events.append(_log(state, KIND_END, ACTOR_SYSTEM, None, 0, "Chefe derrotado!"))
        state.status = STATUS_ENDED
        state.outcome = OUTCOME_VICTORY


def _apply_ability(state: RaidState, ability: Ability, team: TeamState,
                   events: List[Event]) -> None:
    """Aplica o efeito da habilidade no estado e registra no log (ADR-017).

    O **escudo** da equipe (ADR-021) absorve primeiro as perdas de Dano
    Base (PENALTY/DRAIN) antes de mexer no dano registrado.
    """
    if not boss_engine.is_executable(ability):
        return  # ex.: PR_COST — informativo, sem sistema de PR na raid
    value = int(ability.value)
    if value <= 0:
        return
    effect = ability.effect
    group_id = team.group_id

    def _absorb(amount: int) -> int:
        """Quanto do escudo cobre dessa perda (0 = sem escudo)."""
        covered = min(team.shield, amount)
        team.shield -= covered
        return covered

    if effect == boss_engine.EFFECT_PENALTY:
        applied = min(team.base_damage, value)
        absorbed = _absorb(applied)
        applied -= absorbed
        team.base_damage -= applied
        message = f"{ability.name}: a equipe perdeu {applied} de Dano Base!"
        if absorbed:
            message += f" Escudo absorveu {absorbed}!"
    elif effect == boss_engine.EFFECT_HEAL:
        before = state.hp
        state.hp = min(state.max_hp, state.hp + value)
        message = f"{ability.name}: o chefe recuperou {state.hp - before} PV!"
    elif effect == boss_engine.EFFECT_DRAIN:
        applied = min(team.base_damage, value)
        absorbed = _absorb(applied)
        applied -= absorbed
        team.base_damage -= applied
        before = state.hp
        state.hp = min(state.max_hp, state.hp + applied)
        message = (
            f"{ability.name}: drenou {applied} de Dano Base e o chefe "
            f"recuperou {state.hp - before} PV!"
        )
        if absorbed:
            message += f" Escudo absorveu {absorbed}!"
    elif effect in (boss_engine.EFFECT_CUT, boss_engine.EFFECT_DISADV):
        cut = min(1.0, value / 100)
        # O corte mais forte vence (não multiplica entre si).
        team.damage_factor = min(team.damage_factor, 1 - cut)
        message = f"{ability.name}: dano de ataque da equipe cortado em {value}%!"
    else:
        return

    events.append(
        _log(state, KIND_ABILITY, ACTOR_BOS, group_id, value, message,
             ability_id=ability.id, ability_name=ability.name)
    )


def _evaluate_criteria_abilities(state: RaidState, team: TeamState,
                                 events: List[Event]) -> None:
    """Avalia os gatilhos por critério no registro do desempenho (com notas)."""
    for ability in state.abilities:
        if not boss_engine.TRIGGER_CRITERIA.get(ability.trigger):
            continue  # PERGUNTAS (attack) e SUPORTE (informativo)
        if ability.scope == boss_engine.SCOPE_ALLIANCE:
            affected_count = sum(
                1 for other in state.teams.values()
                if other.criteria and boss_engine.affected(ability, other.criteria)
            )
            fires = boss_engine.fires_for_alliance(
                ability, team.criteria, affected_count
            )
        else:
            fires = boss_engine.fires_for_team(ability, team.criteria)
        if fires:
            _apply_ability(state, ability, team, events)


def _evaluate_question_abilities(state: RaidState, team: TeamState,
                                 events: List[Event]) -> None:
    """Avalia os gatilhos "Perguntas" a cada ``every`` erros da equipe."""
    for ability in state.abilities:
        if boss_engine.fires_for_questions(ability, team.wrong_answers):
            _apply_ability(state, ability, team, events)


def apply_performance(state: RaidState, group_id: int, performance: float,
                      criteria: Optional[Dict[str, int]] = None) -> List[Event]:
    """Dano base do desempenho da equipe: ``round(performance * multiplier)``.

    ``performance`` é um número (ex.: nota 0-10 * 100) — a escala é definida
    pela camada de serviço. Só conta se a raid estiver em andamento.

    ``criteria`` (opcional) são as 7 notas da rubric da apresentação: com
    elas as **habilidades do chefe** são avaliadas (gatilhos por critério) e
    a equipe fica com as notas registradas (uma vez por raid).
    """
    _ensure_running(state)
    team = _ensure_team(state, group_id)
    if criteria is not None and team.criteria is not None:
        raise ArenaError("Desempenho já registrado para esta equipe.")
    if criteria is not None:
        team.criteria = dict(criteria)

    events: List[Event] = []
    damage = round(performance * state.config.multiplier * balance_factor(state))
    if damage > 0:
        team.base_damage += damage
        _deal_boss_damage(state, damage, team_id=group_id)
        events.append(
            _log(state, KIND_DAMAGE, ACTOR_TEAM, group_id, damage,
                 f"A equipe causou {damage} de dano (desempenho).")
        )
    elif criteria is None:
        return []
    state.turn += 1

    if team.criteria is not None:
        _evaluate_criteria_abilities(state, team, events)
    _check_victory(state, events)
    return events


def add_damage(state: RaidState, group_id: int, damage: int) -> List[Event]:
    """Dano manual do professor (correção/ajuste), sem retaliação.

    Não conta como golpe final (é ajuste do professor, ADR-018).
    """
    _ensure_running(state)
    team = _ensure_team(state, group_id)
    damage = int(damage)
    if damage <= 0:
        return []
    team.battle_damage += damage
    _deal_boss_damage(state, damage)
    state.turn += 1
    events = [
        _log(state, KIND_DAMAGE, ACTOR_SYSTEM, group_id, damage,
             f"Dano manual de {damage}.")
    ]
    _check_victory(state, events)
    return events


def attack(state: RaidState, group_id: int, correct: bool, points: int) -> List[Event]:
    """Uma rodada de ataque (o **ataque padrão** — sem d20, ADR-019).

    - acerto: o dano entra **com o corte** das habilidades do chefe
      (``team.damage_factor``), depois o **bônus do próximo ataque** da
      equipe (``damage_buff``, consome o buff) e a **escala do bando**
      (``balance_factor``); ``battle_damage += dano`` e o chefe perde
      ``dano`` de PV; depois o chefe retalia ``round(dano * retaliation_ratio)``
      (o escudo da equipe absorve primeiro).
    - erro: nenhum dano; o erro **conta** para as habilidades "Perguntas"
      (a cada ``every`` erros o efeito dispara).
    """
    _ensure_running(state)
    team = _ensure_team(state, group_id)
    events: List[Event] = []

    if correct:
        damage = max(0, int(points))
        if team.damage_factor < 1.0:
            damage = max(0, round(damage * team.damage_factor))
        if damage > 0 and team.damage_buff:
            damage = max(0, round(damage * (1 + team.damage_buff)))
            team.damage_buff = 0.0
        damage = max(0, round(damage * balance_factor(state)))
        team.battle_damage += damage
        _deal_boss_damage(state, damage, team_id=group_id)
        state.turn += 1
        events.append(
            _log(state, KIND_DAMAGE, ACTOR_TEAM, group_id, damage,
                 f"A equipe causou {damage} de dano!")
        )
        retaliation = round(damage * state.config.retaliation_ratio)
        events.extend(_retaliate(state, team, retaliation))
    else:
        state.turn += 1
        events.append(
            _log(state, KIND_DAMAGE, ACTOR_TEAM, group_id, 0,
                 "A equipe errou o ataque.")
        )
        team.wrong_answers += 1
        _evaluate_question_abilities(state, team, events)

    _check_victory(state, events)
    return events


def _retaliate(state: RaidState, team: TeamState, retaliation: int) -> List[Event]:
    """Desconta a retaliação, cobrindo primeiro com o escudo (ADR-021)."""
    if retaliation <= 0 and team.shield <= 0:
        return []
    absorbed = min(team.shield, retaliation)
    team.shield -= absorbed
    retaliation -= absorbed
    group_id = team.group_id
    if retaliation > 0:
        team.retaliation_loss += retaliation
        message = f"O chefe retaliou! A equipe perdeu {retaliation} pontos!"
        if absorbed:
            message += f" Escudo absorveu {absorbed}!"
        return [
            _log(state, KIND_RETALIATION, ACTOR_BOS, group_id, retaliation, message)
        ]
    if absorbed > 0:
        return [
            _log(state, KIND_RETALIATION, ACTOR_BOS, group_id, 0,
                 f"O chefe retaliou! O escudo da equipe absorveu {absorbed} pontos!")
        ]
    return []


def retaliate(state: RaidState, group_id: int) -> List[Event]:
    """Retaliação direta do chefe contra uma equipe (fora do ataque).

    ``round(total_damage * retaliation_ratio)`` pontos perdidos — o escudo
    da equipe absorve primeiro (ADR-021).
    """
    _ensure_running(state)
    team = _ensure_team(state, group_id)
    retaliation = round(team.total_damage * state.config.retaliation_ratio)
    return _retaliate(state, team, retaliation)


def adjust_points(state: RaidState, group_id: int, amount: int) -> List[Event]:
    """Ajuste manual do professor nos pontos de uma equipe (ADR-011)."""
    team = _ensure_team(state, group_id)
    team.manual_adjustment += int(amount)
    return [
        _log(state, KIND_REWARD, ACTOR_SYSTEM, group_id, int(amount),
             f"Ajuste manual de {amount} pontos na equipe.")
    ]


def compute_rewards(state: RaidState) -> Dict[int, int]:
    """Recompensa final por equipe: pontos proporcionais ao dano total."""
    return {gid: team.points(state.config) for gid, team in state.teams.items()}


def compute_treasure(state: RaidState) -> Dict[int, int]:
    """Saque do chefe rateado **só na vitória** (ADR-018).

    ``FINAL_BLOW_SHARE`` (10%) vai para a equipe do golpe final; o resto é
    proporcional ao dano de cada equipe (com dano > 0), com a sobra do
    arredondamento também para quem derrubou o chefe. Na fuga (derrota) o
    saque fica com o chefe: ``{}``. A soma das partes é sempre o saque.
    """
    if state.outcome != OUTCOME_VICTORY or state.config.treasure <= 0:
        return {}
    pot = state.config.treasure
    total = sum(t.total_damage for t in state.teams.values())
    if total <= 0:
        return {}
    blow = int(pot * FINAL_BLOW_SHARE)
    rest = pot - blow
    shares = {
        gid: int(rest * team.total_damage / total)
        for gid, team in state.teams.items() if team.total_damage > 0
    }
    if not shares:
        return {}
    remainder = rest - sum(shares.values())
    killer = state.killing_team if state.killing_team in shares else max(
        shares, key=lambda gid: state.teams[gid].total_damage
    )
    shares[killer] += blow + remainder
    return shares


def use_ability(state: RaidState, group_id: int, ability_id: int,
                roll: int) -> List[Event]:
    """Usa uma habilidade de equipe com rolagem de d20 (ADR-019/021).

    O d20 rola **só aqui** (o ataque padrão continua sem dado):
    19–20 crítico (×2), 1–2 falha (×0.5). A carga é gasta e o efeito
    (STRIKE/HEAL/SHIELD/BUFF) entra no estado — o golpe segue a escala
    do bando (ADR-020).
    """
    _ensure_running(state)
    team = _ensure_team(state, group_id)
    ability = next((a for a in team.abilities if a.id == ability_id), None)
    if ability is None:
        raise ArenaError("A equipe não tem essa habilidade.")
    if ability.effect not in TEAM_EFFECTS:
        raise ArenaError(f"Efeito inválido em {ability.name}.")
    if not 1 <= int(roll) <= 20:
        raise ArenaError("Rolagem do d20 fora de 1 a 20.")
    if ability.charges_left <= 0:
        raise ArenaError(
            f"{ability.name} ficou sem cargas — renove as habilidades da equipe."
        )
    roll = int(roll)
    multiplier = d20_multiplier(roll)
    effective = _half_up(ability.value * multiplier)
    ability.charges_left -= 1
    events: List[Event] = []
    verdict = " (crítico!)" if multiplier > 1 else " (falha!)" if multiplier < 1 else ""
    name = ability.name
    group_id = team.group_id

    if ability.effect == EFFECT_STRIKE:
        damage = max(0, _half_up(effective * balance_factor(state)))
        team.battle_damage += damage
        _deal_boss_damage(state, damage, team_id=group_id)
        value = damage
        message = f"{name} (d20: {roll}){verdict}: {damage} de dano direto ao chefe!"
    elif ability.effect == EFFECT_HEAL:
        healed = min(team.retaliation_loss, effective)
        team.retaliation_loss -= healed
        value = healed
        message = (
            f"{name} (d20: {roll}){verdict}: recuperou {healed} pontos perdidos!"
            if healed else
            f"{name} (d20: {roll}){verdict}: não havia pontos a curar."
        )
    elif ability.effect == EFFECT_SHIELD:
        team.shield += effective
        value = effective
        message = f"{name} (d20: {roll}){verdict}: escudo de {effective} pontos!"
    else:  # EFFECT_BUFF
        team.damage_buff += effective / 100
        value = effective
        message = (
            f"{name} (d20: {roll}){verdict}: próximo ataque +{effective}%!"
        )

    events.append(
        _log(state, KIND_ABILITY, ACTOR_TEAM, group_id, value, message,
             roll=roll, ability_id=ability.id, ability_name=ability.name)
    )
    _check_victory(state, events)
    return events


def renew_abilities(state: RaidState, group_id: int) -> List[Event]:
    """Professor renova as cargas da equipe no meio da raid (ADR-021)."""
    if state.status not in (STATUS_RUNNING, STATUS_PAUSED):
        raise ArenaError("A batalha não está em andamento.")
    team = _ensure_team(state, group_id)
    if not team.abilities:
        raise ArenaError("A equipe não tem habilidades para renovar.")
    ref = state.config.balance_ref_teams
    n = len(state.teams)
    for ability in team.abilities:
        ability.charges_left = scaled_charges(ability.max_charges, ref, n)
    return [
        _log(state, KIND_ABILITY, ACTOR_SYSTEM, group_id, 0,
             "Habilidades da equipe renovadas.")
    ]


def is_over(state: RaidState) -> bool:
    return state.is_over
