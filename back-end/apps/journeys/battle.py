"""Motor de batalha (regras de negócio) — sem HTTP aqui, só regras.

Fluxo de uma etapa:
    start_stage()  -> sorteia o chefe do ``Stage.boss_pool``, cria o
                      ``StageProgress`` e sorteia a primeira pergunta.
    answer()       -> uma rodada: o grupo responde (e opcionalmente lança um
                      feitiço do herói), depois o chefe age. Termina quando o
                      chefe ou o herói chega a 0 de HP (ou estoura MAX_TURNS).
    journey_summary() -> notas/pontuação finais de uma jornada.

Regras de dano/cura/escudo vivem em ``apps.spells.models`` (CombatMixin/Spell).
Aqui os dois lados da luta são embrulhados em ``_Side`` para que ``Spell.cast``
funcione igual para herói e chefe (interface única, ver Combatant).
"""

import random
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.bosses.models import Choice, Question
from apps.heroes.models import Hero
from apps.spells.models import CombatMixin, Spell

from .models import BattleEvent, GroupJourney, Stage, StageProgress

# Trava de segurança: luta que não termina em N rodadas conta como derrota.
MAX_TURNS = 50


class BattleError(Exception):
    """Violação de regra de negócio (a view converte em HTTP 400)."""


class _Side(CombatMixin):
    """Um lado da luta (herói ou chefe) lendo/escrevendo no StageProgress.

    ``prefix`` = "" para o herói (hp/max_hp/shield) e "boss_" para o chefe
    (boss_hp/boss_max_hp/boss_shield). Não grava sozinho: o motor salva o
    progresso uma vez no fim da rodada.
    """

    def __init__(self, progress, prefix=""):
        self._p = progress
        self._prefix = prefix

    def _get(self, name):
        return getattr(self._p, self._prefix + name)

    def _set(self, name, value):
        setattr(self._p, self._prefix + name, value)

    hp = property(lambda s: s._get("hp"), lambda s, v: s._set("hp", v))
    max_hp = property(lambda s: s._get("max_hp"), lambda s, v: s._set("max_hp", v))
    shield = property(lambda s: s._get("shield"), lambda s, v: s._set("shield", v))

    def _commit(self, fields):
        pass


def hero_of(group_journey):
    """Herói ativo do grupo nesta jornada (ou None)."""
    return Hero.objects.filter(
        group_id=group_journey.group_id,
        journey_id=group_journey.journey_id,
        is_active=True,
    ).first()


def _valid_questions(boss):
    """Perguntas jogáveis: ao menos 2 alternativas e 1 correta."""
    return [
        q
        for q in boss.questions.prefetch_related("choices")
        if len(q.choices.all()) >= 2 and any(c.is_correct for c in q.choices.all())
    ]


def _draw_question(progress, rng):
    """Sorteia uma pergunta ainda não feita; se acabaram, reaproveita."""
    questions = _valid_questions(progress.boss)
    asked = set(
        progress.events.exclude(question__isnull=True).values_list("question_id", flat=True)
    )
    fresh = [q for q in questions if q.id not in asked]
    return rng.choice(fresh or questions)


@transaction.atomic
def start_stage(group_journey, stage=None, rng=random):
    """Abre a batalha da próxima etapa do grupo. Retorna o StageProgress."""
    group_journey = GroupJourney.objects.select_for_update().get(pk=group_journey.pk)

    if group_journey.status != GroupJourney.Status.IN_PROGRESS:
        raise BattleError("Esta jornada do grupo não está em andamento.")
    if not group_journey.group.is_active:
        raise BattleError("O grupo está desativado.")
    if group_journey.stage_progress.filter(status=StageProgress.Status.IN_PROGRESS).exists():
        raise BattleError("Já existe uma batalha em andamento para este grupo.")

    done = set(group_journey.stage_progress.values_list("stage_id", flat=True))
    pending = [s for s in group_journey.journey.stages.order_by("order") if s.id not in done]
    if not pending:
        raise BattleError("O grupo já passou por todas as etapas desta jornada.")
    target = pending[0]
    if stage is not None and stage.id != target.id:
        raise BattleError(
            f"Etapa fora de ordem: a próxima etapa é #{target.order} ({target.name})."
        )

    hero = hero_of(group_journey)
    if hero is None:
        raise BattleError("O grupo não tem herói ativo nesta jornada.")

    bosses = [b for b in target.boss_pool.filter(is_active=True) if _valid_questions(b)]
    if not bosses:
        raise BattleError(
            "A etapa não tem chefe jogável (precisa de chefe ativo com perguntas "
            "de ao menos 2 alternativas e 1 correta)."
        )
    boss = rng.choice(bosses)

    progress = StageProgress.objects.create(
        group_journey=group_journey,
        stage=target,
        boss=boss,
        max_hp=hero.max_hp,
        hp=hero.max_hp,
        shield=0,
        boss_max_hp=boss.max_hp,
        boss_hp=boss.max_hp,
        boss_shield=0,
    )
    progress.current_question = _draw_question(progress, rng)
    progress.save(update_fields=["current_question"])

    group_journey.current_stage = target
    group_journey.save(update_fields=["current_stage"])
    return progress


def spell_cooldown_left(progress, spell, turn):
    """Turnos que faltam para ``spell`` voltar a ficar disponível no ``turn``."""
    if not spell.cooldown_turns:
        return 0
    last = (
        progress.events.filter(actor=BattleEvent.Actor.STUDENT, spell=spell)
        .order_by("-turn")
        .first()
    )
    if last is None:
        return 0
    return max(0, spell.cooldown_turns - (turn - last.turn - 1))


def available_spells(progress):
    """Feitiços do herói com a situação de recarga no próximo turno."""
    hero = hero_of(progress.group_journey)
    if hero is None:
        return []
    turn = progress.turn + 1
    out = []
    for spell in hero.spells.filter(is_active=True):
        left = spell_cooldown_left(progress, spell, turn)
        out.append({"spell": spell, "ready": left == 0, "cooldown_left": left})
    return out


def _log(progress, turn, actor, **kw):
    return BattleEvent.objects.create(progress=progress, turn=turn, actor=actor, **kw)


@transaction.atomic
def answer(progress, choice_id, student=None, spell_id=None, rng=random):
    """Resolve uma rodada. Retorna ``(progress, correct, events)``."""
    progress = (
        StageProgress.objects.select_for_update()
        .select_related("group_journey__group", "group_journey__journey", "stage", "boss")
        .get(pk=progress.pk)
    )
    if progress.status != StageProgress.Status.IN_PROGRESS:
        raise BattleError("Esta batalha já terminou.")
    question = progress.current_question
    if question is None:
        raise BattleError("Não há pergunta pendente nesta batalha.")
    choice = Choice.objects.filter(pk=choice_id, question=question).first()
    if choice is None:
        raise BattleError("A alternativa não pertence à pergunta atual.")
    if student is not None and student.group_id != progress.group_journey.group_id:
        raise BattleError("O estudante não pertence ao grupo desta batalha.")

    hero = hero_of(progress.group_journey)
    if hero is None:
        raise BattleError("O grupo não tem herói ativo nesta jornada.")

    turn = progress.turn + 1
    spell = None
    if spell_id is not None:
        spell = hero.spells.filter(pk=spell_id, is_active=True).first()
        if spell is None:
            raise BattleError("O herói não possui esse feitiço (ou ele está inativo).")
        left = spell_cooldown_left(progress, spell, turn)
        if left:
            raise BattleError(f"O feitiço está em recarga por mais {left} turno(s).")

    hero_side = _Side(progress, "")
    boss_side = _Side(progress, "boss_")
    events = []
    correct = bool(choice.is_correct)

    # --- ação do grupo ------------------------------------------------------
    if correct:
        progress.score += question.points
        damage = boss_side.take_damage(question.points)
        events.append(
            _log(
                progress, turn, BattleEvent.Actor.STUDENT,
                student=student, question=question, answered_correctly=True, value=damage,
            )
        )
        if spell is not None:
            target = boss_side if spell.spell_type == Spell.SpellType.DAMAGE else hero_side
            value = spell.cast(target, power_bonus=hero.power_bonus)
            events.append(
                _log(
                    progress, turn, BattleEvent.Actor.STUDENT,
                    student=student, spell=spell, value=value,
                )
            )
    else:
        events.append(
            _log(
                progress, turn, BattleEvent.Actor.STUDENT,
                student=student, question=question, answered_correctly=False, value=0,
            )
        )

    # --- ação do chefe (só se ainda estiver de pé) -------------------------
    if boss_side.is_alive:
        boss_spell = progress.boss.choose_spell(rng)
        if boss_spell is not None:
            target = hero_side if boss_spell.spell_type == Spell.SpellType.DAMAGE else boss_side
            value = boss_spell.cast(target)
            events.append(_log(progress, turn, BattleEvent.Actor.BOSS, spell=boss_spell, value=value))

    # --- desfecho -----------------------------------------------------------
    progress.turn = turn
    victory = not boss_side.is_alive
    defeat = not hero_side.is_alive or (not victory and turn >= MAX_TURNS)
    if victory or defeat:
        progress.current_question = None
        _finish_stage(progress, victory=victory and hero_side.is_alive)
    else:
        progress.current_question = _draw_question(progress, rng)
        progress.save()
    return progress, correct, events


def _finish_stage(progress, victory):
    """Fecha a etapa: status, pontos do grupo e avanço da jornada."""
    now = timezone.now()
    stage = progress.stage
    progress.score = min(progress.score, stage.max_score)
    progress.status = StageProgress.Status.COMPLETED if victory else StageProgress.Status.FAILED
    progress.finished_at = now
    progress.save()

    gj = progress.group_journey
    gj.group.add_points(progress.score)

    next_stage = gj.journey.stages.filter(order__gt=stage.order).order_by("order").first()
    if next_stage is None:
        gj.status = GroupJourney.Status.COMPLETED
        gj.finished_at = now
        gj.current_stage = None
    else:
        gj.current_stage = next_stage
    gj.save(update_fields=["status", "finished_at", "current_stage"])


def journey_summary(group_journey):
    """Resumo/nota final de uma jornada do grupo (nota é SUGESTÃO ao professor)."""
    stages = list(group_journey.journey.stages.order_by("order"))
    progress = {p.stage_id: p for p in group_journey.stage_progress.all()}
    max_total = sum(s.max_score for s in stages)
    total = sum(p.score for p in progress.values())
    suggested = (
        (Decimal(total) / Decimal(max_total) * 10).quantize(Decimal("0.01"))
        if max_total
        else Decimal("0.00")
    )

    events = BattleEvent.objects.filter(
        progress__group_journey=group_journey,
        actor=BattleEvent.Actor.STUDENT,
        question__isnull=False,
    ).select_related("question")
    per_student = {}
    for ev in events:
        row = per_student.setdefault(ev.student_id, {"answered": 0, "correct": 0, "points": 0})
        row["answered"] += 1
        if ev.answered_correctly:
            row["correct"] += 1
            row["points"] += ev.question.points

    students = [
        {
            "id": st.id,
            "name": st.name,
            "grade": st.grade,
            **per_student.get(st.id, {"answered": 0, "correct": 0, "points": 0}),
        }
        for st in group_journey.group.students.all()
    ]
    return {
        "group_journey": group_journey.id,
        "status": group_journey.status,
        "total_score": total,
        "max_score": max_total,
        "suggested_grade": suggested,
        "stages": [
            {
                "stage": s.id,
                "order": s.order,
                "name": s.name,
                "max_score": s.max_score,
                "score": progress[s.id].score if s.id in progress else None,
                "status": progress[s.id].status if s.id in progress else None,
            }
            for s in stages
        ],
        "students": students,
    }
