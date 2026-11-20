"""Motor da Arena — raid coletivo do chefe da rodada. PURO, sem Django.

O módulo Arena convive com a batalha 1v1 (``apps.journeys.battle``): aqui
**um** chefe da rodada recebe o dano de **todas** as equipes ao mesmo tempo.

Fluxo de uma raid:
    new_raid()          -> cria o estado (CONFIG) com as equipes registradas.
    start()             -> CONFIG -> RUNNING.
    apply_performance() -> dano base do desempenho da equipe (nota x multiplicador).
    attack()            -> uma rodada: acerto causa dano e provoca retaliação.
    retaliate()         -> retaliação direta do chefe (fora do ataque).
    compute_rewards()   -> recompensa final proporcional ao dano total.
    pause()/resume()/end() -> controle do professor.

Este arquivo **não importa Django** de propósito: o motor é testável sem banco
e a lógica fica isolada da persistência (regra de fronteira de camadas,
``PLANO.md §4.7``). A orquestração com o ORM vive em ``services.py``.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

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


class ArenaError(Exception):
    """Violação de regra de negócio (a view converte em HTTP 400)."""


@dataclass
class RaidConfig:
    """Parâmetros ajustáveis do raid (fórmulas a validar com o professor).

    - ``multiplier``: dano base = desempenho * multiplier.
    - ``retaliation_ratio``: retaliação (em pontos) = dano causado * ratio.
    - ``reward_factor``: recompensa (em pontos) = dano total * reward_factor.
    """

    multiplier: float = 1.5
    retaliation_ratio: float = 0.25
    reward_factor: float = 1.0


@dataclass
class TeamState:
    """Desempenho de uma equipe dentro da raid."""

    group_id: int
    base_damage: int = 0
    battle_damage: int = 0
    retaliation_loss: int = 0
    manual_adjustment: int = 0

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

    @property
    def is_over(self) -> bool:
        return self.hp <= 0


def _log(state, kind, actor, group_id, value, message) -> Event:
    ev = Event(kind=kind, actor=actor, group_id=group_id, value=value, message=message)
    state.log.append(ev)
    return ev


def new_raid(max_hp: int, config: Optional[RaidConfig] = None,
             group_ids=()) -> RaidState:
    """Cria uma raid em CONFIG com as equipes registradas."""
    state = RaidState(max_hp=max_hp, hp=max_hp, config=config or RaidConfig())
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
    """RUNNING/PAUSED -> ENDED."""
    if state.status not in (STATUS_RUNNING, STATUS_PAUSED):
        raise ArenaError("A batalha não está em andamento.")
    state.status = STATUS_ENDED
    return [_log(state, KIND_END, ACTOR_SYSTEM, None, 0, "Batalha encerrada.")]


def _check_victory(state: RaidState, events: List[Event]) -> None:
    """Se o chefe caiu, encerra a raid e registra a vitória."""
    if state.is_over and state.status != STATUS_ENDED:
        events.append(_log(state, KIND_END, ACTOR_SYSTEM, None, 0, "Chefe derrotado!"))
        state.status = STATUS_ENDED


def apply_performance(state: RaidState, group_id: int, performance: float) -> List[Event]:
    """Dano base do desempenho da equipe: ``round(performance * multiplier)``.

    ``performance`` é um número (ex.: nota 0-10 * 100) — a escala é definida
    pela camada de serviço. Só conta se a raid estiver em andamento.
    """
    _ensure_running(state)
    team = _ensure_team(state, group_id)
    damage = round(performance * state.config.multiplier)
    if damage <= 0:
        return []
    team.base_damage += damage
    state.hp = max(0, state.hp - damage)
    state.turn += 1
    events = [
        _log(state, KIND_DAMAGE, ACTOR_TEAM, group_id, damage,
             f"A equipe causou {damage} de dano (desempenho).")
    ]
    _check_victory(state, events)
    return events


def add_damage(state: RaidState, group_id: int, damage: int) -> List[Event]:
    """Dano manual do professor (correção/ajuste), sem retaliação."""
    _ensure_running(state)
    team = _ensure_team(state, group_id)
    damage = int(damage)
    if damage <= 0:
        return []
    team.battle_damage += damage
    state.hp = max(0, state.hp - damage)
    state.turn += 1
    events = [
        _log(state, KIND_DAMAGE, ACTOR_SYSTEM, group_id, damage,
             f"Dano manual de {damage}.")
    ]
    _check_victory(state, events)
    return events


def attack(state: RaidState, group_id: int, correct: bool, points: int) -> List[Event]:
    """Uma rodada de ataque: acerto causa dano e provoca retaliação.

    - acerto: ``battle_damage += points`` e o chefe perde ``points`` de HP;
      depois o chefe retalia ``round(points * retaliation_ratio)`` pontos.
    - erro: nenhum dano, nenhum HP perdido, sem retaliação.
    """
    _ensure_running(state)
    team = _ensure_team(state, group_id)
    events: List[Event] = []

    if correct:
        damage = max(0, int(points))
        team.battle_damage += damage
        state.hp = max(0, state.hp - damage)
        state.turn += 1
        events.append(
            _log(state, KIND_DAMAGE, ACTOR_TEAM, group_id, damage,
                 f"A equipe causou {damage} de dano!")
        )
        retaliation = round(damage * state.config.retaliation_ratio)
        if retaliation > 0:
            team.retaliation_loss += retaliation
            events.append(
                _log(state, KIND_RETALIATION, ACTOR_BOS, group_id, retaliation,
                     f"O chefe retaliou! A equipe perdeu {retaliation} pontos!")
            )
    else:
        state.turn += 1
        events.append(
            _log(state, KIND_DAMAGE, ACTOR_TEAM, group_id, 0,
                 "A equipe errou o ataque.")
        )

    _check_victory(state, events)
    return events


def retaliate(state: RaidState, group_id: int) -> List[Event]:
    """Retaliação direta do chefe contra uma equipe (fora do ataque).

    ``round(total_damage * retaliation_ratio)`` pontos perdidos.
    """
    _ensure_running(state)
    team = _ensure_team(state, group_id)
    retaliation = round(team.total_damage * state.config.retaliation_ratio)
    if retaliation <= 0:
        return []
    team.retaliation_loss += retaliation
    return [
        _log(state, KIND_RETALIATION, ACTOR_BOS, group_id, retaliation,
             f"O chefe retaliou! A equipe perdeu {retaliation} pontos!")
    ]


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


def is_over(state: RaidState) -> bool:
    return state.is_over
