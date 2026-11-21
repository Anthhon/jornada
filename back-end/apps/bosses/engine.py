"""Motor de habilidades do chefe — PURO, sem Django.

Aqui mora o **sistema de chefe**: quando uma habilidade dispara e com que
força. O motor **não aplica efeitos** (ele não conhece a raid); ele responde
duas perguntas para a Arena:

    affected(ability, criteria)          -> a equipe está afetada?
    fires_for_team(...) / fires_for_alliance(...)
    fires_for_questions(ability, n_erros)-> dispara no n-ésimo erro?

A aplicação (penalidade de Dano Base, cura do chefe, drenagem, corte) vive em
``apps.arena.engine`` — a raid é quem tem PV, dano e log. Este módulo não
importa Django de propósito (regra de fronteira, ``PLANO.md §4.7``): os dados
chegam como dicionário/instância "patito" e os testes rodam sem banco.

Gatilhos e critérios (a rubric das missões, ``constants/evaluation.ts``):
    TEMPO        -> tempo
    CONCEITO     -> paradigma, caracteristicas
    FUNDAMENTOS  -> historico, paradigma
    DEMONSTRACAO -> usos, codigo
    GERAL        -> todos os critérios
    SUPORTE      -> sem critério (informativo nesta raid)
    PERGUNTAS    -> contador de erros (avaliado na Arena)
"""

from dataclasses import dataclass
from typing import Mapping, Optional, Sequence, Tuple

# Chaves das notas da rubric (mesmas do front).
CRITERIA_KEYS: Tuple[str, ...] = (
    "tempo",
    "historico",
    "paradigma",
    "caracteristicas",
    "usos",
    "codigo",
    "criatividade",
)

# Qual gatilho observa quais critérios.
TRIGGER_CRITERIA: Mapping[str, Tuple[str, ...]] = {
    "TEMPO": ("tempo",),
    "CONCEITO": ("paradigma", "caracteristicas"),
    "FUNDAMENTOS": ("historico", "paradigma"),
    "DEMONSTRACAO": ("usos", "codigo"),
    "GERAL": CRITERIA_KEYS,
    "SUPORTE": (),
    "PERGUNTAS": (),
}

# Efeitos que a raid sabe aplicar (os demais são ignorados sem erro).
EFFECT_PENALTY = "PENALTY"
EFFECT_HEAL = "HEAL"
EFFECT_DRAIN = "DRAIN"
EFFECT_CUT = "CUT"
EFFECT_DISADV = "DISADV"
EFFECT_PR_COST = "PR_COST"  # informativo: sem sistema de PR na raid

MODE_ANY = "ANY"
MODE_AVERAGE = "AVERAGE"
MODE_SPREAD = "SPREAD"

SCOPE_TEAM = "TEAM"
SCOPE_ALLIANCE = "ALLIANCE"

# Notas do rubric: Ausente -1 · Parcial 1 · Bom 3.
SCORE_MAX = 3
SCORES = (-1, 1, 3)


@dataclass(frozen=True)
class Ability:
    """Habilidade executável (cópia de ``BossAbility`` pronta pro motor)."""

    name: str
    trigger: str
    effect: str
    value: int = 0
    every: int = 1
    threshold: int = SCORE_MAX
    mode: str = MODE_ANY
    scope: str = SCOPE_TEAM
    min_count: int = 1
    description: str = ""
    id: Optional[int] = None  # pk de BossAbility (eventos estruturados, ADR-022)

    @classmethod
    def from_model(cls, obj) -> "Ability":
        """Converte uma linha ``BossAbility`` (patito — sem importar Django)."""
        return cls(
            id=getattr(obj, "id", None),
            name=obj.name,
            trigger=obj.trigger,
            effect=obj.effect,
            value=obj.value,
            every=obj.every,
            threshold=obj.threshold,
            mode=obj.mode,
            scope=obj.scope,
            min_count=obj.min_count,
            description=obj.description or "",
        )


def _mapped_scores(
    ability: Ability, criteria: Optional[Mapping[str, int]]
) -> Sequence[int]:
    """Notas dos critérios observados pelo gatilho (vazio se nada registrado)."""
    if not criteria:
        return ()
    keys = TRIGGER_CRITERIA.get(ability.trigger, ())
    return tuple(int(criteria[k]) for k in keys if k in criteria)


def affected(ability: Ability, criteria: Optional[Mapping[str, int]]) -> bool:
    """A condição da habilidade vale para esse conjunto de notas?

    - ANY:      algum critério mapeado **abaixo** da nota de corte.
    - AVERAGE:  a **média** dos critérios mapeados fica abaixo do corte.
    - SPREAD:   a **variação** (máx − mín) dos critérios chega ao corte
                (``threshold`` é o tamanho mínimo da variação).
    """
    if ability.trigger == "PERGUNTAS" or not TRIGGER_CRITERIA.get(ability.trigger):
        return False
    scores = _mapped_scores(ability, criteria)
    if not scores:
        return False
    threshold = ability.threshold
    if ability.mode == MODE_AVERAGE:
        return (sum(scores) / len(scores)) < threshold
    if ability.mode == MODE_SPREAD:
        return (max(scores) - min(scores)) >= threshold
    return any(score < threshold for score in scores)


def fires_for_team(ability: Ability, criteria: Optional[Mapping[str, int]]) -> bool:
    """Escopo EQUIPE: dispara no registro da própria equipe."""
    return ability.scope == SCOPE_TEAM and affected(ability, criteria)


def fires_for_alliance(
    ability: Ability,
    criteria: Optional[Mapping[str, int]],
    affected_count: int,
) -> bool:
    """Escopo ALIANÇA: a equipe é afetada **e** há equipes afetadas suficientes.

    A contagem usa as equipes com nota registrada até o momento (o professor
    registra uma a uma) — a primeira afetada pode não disparar quando o
    ``min_count`` > 1 (documentado no ADR-017).
    """
    if ability.scope != SCOPE_ALLIANCE:
        return False
    if not affected(ability, criteria):
        return False
    return affected_count >= max(1, ability.min_count)


def fires_for_questions(ability: Ability, wrong_answers: int) -> bool:
    """Escopo PERGUNTAS: dispara a cada ``every`` erros (no n-ésimo erro)."""
    if ability.trigger != "PERGUNTAS" or wrong_answers <= 0:
        return False
    every = max(1, ability.every)
    return wrong_answers % every == 0


def is_executable(ability: Ability) -> bool:
    """O efeito tem efeito real na raid? (PR_COST é só exibição.)"""
    return ability.effect in {
        EFFECT_PENALTY,
        EFFECT_HEAL,
        EFFECT_DRAIN,
        EFFECT_CUT,
        EFFECT_DISADV,
    }
