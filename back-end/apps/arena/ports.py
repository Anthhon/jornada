"""Portas do módulo Arena — o ÚNICO ponto de contato com o resto do sistema.

O motor (``engine.py``) não conhece Django nem os models. Estas interfaces
são a fronteira: se um dia a Arena virar um serviço separado, só se trocam
as implementações concretas (em ``services.py``).
"""

from typing import List, Protocol, runtime_checkable


@runtime_checkable
class TeamPort(Protocol):
    """Lê as equipes ativas que participam da raid."""

    def get_active_team_ids(self) -> List[int]: ...


@runtime_checkable
class BossPort(Protocol):
    """Lê o chefe da rodada."""

    def get_boss(self, boss_id: int): ...


@runtime_checkable
class PerformancePort(Protocol):
    """Desempenho de uma equipe na rodada (fonte do dano base)."""

    def get_performance(self, group_id: int) -> float: ...


@runtime_checkable
class PointsPort(Protocol):
    """Creditar pontos na equipe (o alvo da recompensa)."""

    def add_points(self, group_id: int, amount: int) -> None: ...
