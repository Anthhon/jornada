from django.db import models
from django.db.models import Sum
from apps.spells.models import Combatant


class Journey(models.Model):
    name = models.CharField(
            max_length=100,
            unique=True,
            verbose_name="Nome"
            )
    description = models.TextField(
            blank=True,
            verbose_name="Descrição"
            )
    is_active = models.BooleanField(
            default=True,
            verbose_name="Ativa"
            )
    created_at = models.DateTimeField(
            auto_now_add=True,
            blank=True,
            null=True,
            )

    class Meta:
        verbose_name = "Jornada"
        verbose_name_plural = "Jornadas"

    def __str__(self):
        return self.name


class Stage(models.Model):
    journey = models.ForeignKey(
            Journey,
            related_name="stages",
            on_delete=models.CASCADE
            )
    order = models.PositiveSmallIntegerField(
            verbose_name="Ordem"
            )
    name = models.CharField(
            max_length=100,
            verbose_name="Nome"
            )
    description = models.TextField(
            blank=True,
            verbose_name="Descrição"
            )
    max_score = models.PositiveIntegerField(
            default=100,
            verbose_name="Pontuação máxima"
            )
    # Boss is randomly drawn from this pool when a group reaches the stage.
    boss_pool = models.ManyToManyField(
            "bosses.Boss", related_name="stages", verbose_name="Chefes possíveis"
            )

    class Meta:
        ordering = ["journey", "order"]
        constraints = [
                models.UniqueConstraint(fields=["journey", "order"], name="unique_stage_order")
                ]
        verbose_name = "Etapa"
        verbose_name_plural = "Etapas"

    def __str__(self):
        return f"{self.journey} #{self.order} - {self.name}"


class GroupJourney(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "PROG", "Em andamento"
        COMPLETED = "DONE", "Concluída"
        FAILED = "FAIL", "Falhou"

    group = models.ForeignKey(
            "groups.Group",
            related_name="journeys",
            on_delete=models.CASCADE
            )
    journey = models.ForeignKey(
            Journey,
            related_name="group_runs",
            on_delete=models.CASCADE
            )
    status = models.CharField(
            max_length=4,
            choices=Status.choices,
            default=Status.IN_PROGRESS
            )
    current_stage = models.ForeignKey(
            Stage,
            null=True,
            blank=True,
            related_name="+",
            on_delete=models.SET_NULL
            )
    started_at = models.DateTimeField(
            auto_now_add=True,
            blank=True,
            null=True,
            )
    finished_at = models.DateTimeField(
            null=True,
            blank=True
            )

    class Meta:
        constraints = [
                models.UniqueConstraint(fields=["group", "journey"], name="unique_group_journey")
                ]
        verbose_name = "Jornada do grupo"
        verbose_name_plural = "Jornadas dos grupos"

    def __str__(self):
        return f"{self.group} @ {self.journey}"

    @property
    def total_score(self):
        return self.stage_progress.aggregate(t=Sum("score"))["t"] or 0


# State of a groups fight in one stage.
class StageProgress(Combatant):
    class Status(models.TextChoices):
        IN_PROGRESS = "PROG", "Em andamento"
        COMPLETED = "DONE", "Concluída"
        FAILED = "FAIL", "Falhou"

    group_journey = models.ForeignKey(
            GroupJourney,
            related_name="stage_progress",
            on_delete=models.CASCADE
            )
    stage = models.ForeignKey(
            Stage,
            related_name="progress",
            on_delete=models.PROTECT
            )
    boss = models.ForeignKey(
            "bosses.Boss",
            related_name="battles",
            on_delete=models.PROTECT
            )
    score = models.PositiveIntegerField(
            default=0,
            verbose_name="Pontuação"
            )
    status = models.CharField(
            max_length=4,
            choices=Status.choices,
            default=Status.IN_PROGRESS
            )
    started_at = models.DateTimeField(
            auto_now_add=True,
            blank=True,
            null=True,
            )
    finished_at = models.DateTimeField(
            null=True,
            blank=True
            )

    class Meta:
        constraints = [
                models.UniqueConstraint(
                    fields=["group_journey", "stage"], name="unique_progress_stage"
                    )
                ]
        ordering = ["stage__order"]

    def __str__(self):
        return f"{self.group_journey} / {self.stage}"


# Append-only log of everything that happens in a battle
class BattleEvent(models.Model):
    class Actor(models.TextChoices):
        STUDENT = "STU", "Estudante"
        BOSS = "BOS", "Chefe"

    progress = models.ForeignKey(
            StageProgress,
            related_name="events",
            on_delete=models.CASCADE
            )
    turn = models.PositiveIntegerField()
    actor = models.CharField(
            max_length=3,
            choices=Actor.choices
            )
    student = models.ForeignKey(
            "users.Student",
            null=True,
            blank=True,
            on_delete=models.SET_NULL
            )
    question = models.ForeignKey(
            "bosses.Question",
            null=True,
            blank=True,
            on_delete=models.SET_NULL
            )
    answered_correctly = models.BooleanField(
            null=True,
            blank=True
            )
    spell = models.ForeignKey(
            "spells.Spell",
            null=True,
            blank=True,
            on_delete=models.SET_NULL
            )
    value = models.IntegerField(
            default=0,
            help_text="Dano/cura/escudo/pontos efetivos."
            )
    created_at = models.DateTimeField(
            auto_now_add=True,
            blank=True,
            null=True,
            )

    class Meta:
        ordering = ["progress", "turn", "id"]

    def __str__(self):
        return f"T: {self.turn} {self.actor} ({self.progress_id})"
