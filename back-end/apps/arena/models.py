from django.db import models


class ArenaRound(models.Model):
    """Uma raid: o chefe da rodada contra todas as equipes ao mesmo tempo.

    Convive com a batalha 1v1 (``journeys.StageProgress``) — não a substitui.
    """

    class Status(models.TextChoices):
        CONFIG = "CONFIG", "Em configuração"
        RUNNING = "RUNNING", "Em andamento"
        PAUSED = "PAUSED", "Pausada"
        ENDED = "ENDED", "Encerrada"

    name = models.CharField(
            max_length=100,
            verbose_name="Nome",
            help_text="Ex.: Rodada 2.",
            )
    journey = models.ForeignKey(
            "journeys.Journey",
            null=True,
            blank=True,
            related_name="arena_rounds",
            on_delete=models.SET_NULL,
            verbose_name="Jornada",
            )
    boss = models.ForeignKey(
            "bosses.Boss",
            related_name="arena_rounds",
            on_delete=models.PROTECT,
            verbose_name="Chefe da rodada",
            )
    level = models.PositiveIntegerField(
            default=1,
            verbose_name="Nível",
            )
    max_hp = models.PositiveIntegerField(
            default=15000,
            verbose_name="PV máximo",
            )
    hp = models.PositiveIntegerField(
            default=15000,
            verbose_name="PV atual",
            )
    turn = models.PositiveIntegerField(
            default=0,
            verbose_name="Turno atual",
            )
    multiplier = models.FloatField(
            default=1.5,
            verbose_name="Multiplicador de pontos",
            )
    retaliation_ratio = models.FloatField(
            default=0.25,
            verbose_name="Taxa de retaliação",
            help_text="Pontos perdidos = dano causado x taxa.",
            )
    reward_factor = models.FloatField(
            default=1.0,
            verbose_name="Fator de recompensa",
            help_text="Pontos ganhos = dano total x fator.",
            )
    status = models.CharField(
            max_length=7,
            choices=Status.choices,
            default=Status.CONFIG,
            verbose_name="Status",
            )
    date = models.DateField(
            null=True,
            blank=True,
            verbose_name="Data da rodada",
            )
    deadline = models.DateField(
            null=True,
            blank=True,
            verbose_name="Prazo de entrega",
            )
    started_at = models.DateTimeField(
            null=True,
            blank=True,
            verbose_name="Início",
            )
    finished_at = models.DateTimeField(
            null=True,
            blank=True,
            verbose_name="Fim",
            )
    rewards_credited = models.BooleanField(
            default=False,
            verbose_name="Recompensas creditadas",
            help_text="Evita creditar a recompensa duas vezes.",
            )
    created_at = models.DateTimeField(
            auto_now_add=True,
            blank=True,
            null=True,
            )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Rodada da Arena"
        verbose_name_plural = "Rodadas da Arena"

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        """Rodada nova nasce com PV cheio: ``hp`` acompanha ``max_hp`` (M-41)."""
        if self._state.adding:
            self.hp = self.max_hp
        super().save(*args, **kwargs)


class TeamContribution(models.Model):
    """Desempenho de uma equipe dentro de uma raid."""

    round = models.ForeignKey(
            ArenaRound,
            related_name="contributions",
            on_delete=models.CASCADE,
            )
    group = models.ForeignKey(
            "groups.Group",
            related_name="arena_contributions",
            on_delete=models.CASCADE,
            )
    base_damage = models.IntegerField(
            default=0,
            verbose_name="Dano base (desempenho)",
            )
    battle_damage = models.IntegerField(
            default=0,
            verbose_name="Dano de batalha (acertos)",
            )
    retaliation_loss = models.IntegerField(
            default=0,
            verbose_name="Pontos perdidos (retaliação)",
            )
    manual_adjustment = models.IntegerField(
            default=0,
            verbose_name="Ajuste manual do professor",
            )

    class Meta:
        constraints = [
                models.UniqueConstraint(
                    fields=["round", "group"], name="unique_arena_contribution"
                    ),
                ]
        verbose_name = "Contribuição de equipe"
        verbose_name_plural = "Contribuições de equipes"

    def __str__(self):
        return f"{self.group} @ {self.round}"

    @property
    def total_damage(self):
        return self.base_damage + self.battle_damage

    @property
    def points(self):
        """Pontos líquidos: dano total x fator, menos retaliação, + ajuste."""
        earned = round(self.total_damage * self.round.reward_factor)
        return max(0, earned - self.retaliation_loss + self.manual_adjustment)


class ArenaEvent(models.Model):
    """Log append-only de tudo que acontece na raid (auditoria, como BattleEvent)."""

    class Actor(models.TextChoices):
        TEAM = "TEAM", "Equipe"
        BOS = "BOS", "Chefe"
        SYSTEM = "SYSTEM", "Sistema"

    class Kind(models.TextChoices):
        START = "START", "Início"
        PAUSE = "PAUSE", "Pausa"
        RESUME = "RESUME", "Retomada"
        DAMAGE = "DAMAGE", "Dano"
        RETALIATION = "RETALIATION", "Retaliação"
        REWARD = "REWARD", "Recompensa"
        END = "END", "Fim"

    round = models.ForeignKey(
            ArenaRound,
            related_name="events",
            on_delete=models.CASCADE,
            )
    created_at = models.DateTimeField(
            auto_now_add=True,
            blank=True,
            null=True,
            )
    actor = models.CharField(
            max_length=6,
            choices=Actor.choices,
            )
    group = models.ForeignKey(
            "groups.Group",
            null=True,
            blank=True,
            related_name="+",
            on_delete=models.SET_NULL,
            )
    kind = models.CharField(
            max_length=12,
            choices=Kind.choices,
            )
    value = models.IntegerField(
            default=0,
            help_text="Dano/pontos efetivos.",
            )
    message = models.CharField(
            max_length=255,
            help_text="Texto exibido no registro da batalha.",
            )

    class Meta:
        ordering = ["round", "created_at", "id"]

    def __str__(self):
        return f"{self.kind} ({self.round_id})"
