import random
from django.db import models


class Boss(models.Model):
    name = models.CharField(
            max_length=100,
            unique=True,
            verbose_name="Nome"
            )
    description = models.TextField(
            blank=True,
            verbose_name="Descrição"
            )
    max_hp = models.PositiveIntegerField(
            default=100,
            verbose_name="HP máximo"
            )
    spells = models.ManyToManyField(
            "spells.Spell",
            through="BossSpell",
            related_name="bosses",
            blank=True,
            verbose_name="Feitiços",
            )
    is_active = models.BooleanField(
            default=True,
            verbose_name="Ativo"
            )

    class Meta:
        ordering = ["name"]
        verbose_name = "Chefe"
        verbose_name_plural = "Chefes"

    def __str__(self):
        return self.name

    # Weighted random pick of a spell (the boss 'AI'), none if no spells
    def choose_spell(self, rng=random):
        links = list(self.boss_spells.select_related("spell").filter(spell__is_active=True))
        if not links:
            return None
        picked = rng.choices(links, weights=[l.weight for l in links], k=1)[0]
        return picked.spell


class BossAbility(models.Model):
    """Habilidade punitiva do chefe (sistema de chefe — Fase E).

    Dados EXECUTÁVEIS: o motor puro ``apps.bosses.engine`` avalia o gatilho
    (notas da rubrica ou erros de pergunta) e a raid da Arena aplica o efeito.
    O texto da landing fica em ``description`` (exibição); os campos ao lado
    são os parâmetros que o motor usa.

    - ``trigger``: quando dispara (mapeado para critérios no motor).
    - ``effect``: o que faz (penalidade, cura, drenagem, corte…).
    - ``value``: magnitude (pontos, PV ou % de corte).
    - ``every``: só PERGUNTAS — a cada N erros da equipe.
    - ``threshold``: nota de corte (dispara com ``nota < threshold``).
    - ``mode``: ANY (algum critério) · AVERAGE (média) · SPREAD (variação).
    - ``scope``: TEAM (a equipe registrada) · ALLIANCE (equipes afetadas).
    - ``min_count``: só ALLIANCE — mínimo de equipes afetadas para disparar.
    """

    class Trigger(models.TextChoices):
        TEMPO = "TEMPO", "Tempo"
        CONCEITO = "CONCEITO", "Conceito"
        FUNDAMENTOS = "FUNDAMENTOS", "Fundamentos"
        DEMONSTRACAO = "DEMONSTRACAO", "Demonstração"
        SUPORTE = "SUPORTE", "Suporte"
        GERAL = "GERAL", "Geral"
        PERGUNTAS = "PERGUNTAS", "Perguntas"

    class Effect(models.TextChoices):
        PENALTY = "PENALTY", "Perde Dano Base"
        HEAL = "HEAL", "Cura do chefe"
        DRAIN = "DRAIN", "Drenagem (dano + cura)"
        CUT = "CUT", "Corte de dano"
        DISADV = "DISADV", "Desvantagem nos dados"
        PR_COST = "PR_COST", "Custo de PR (informativo)"

    class Mode(models.TextChoices):
        ANY = "ANY", "Algum critério abaixo"
        AVERAGE = "AVERAGE", "Média abaixo"
        SPREAD = "SPREAD", "Notas variadas"

    class Scope(models.TextChoices):
        TEAM = "TEAM", "Equipe que registrou"
        ALLIANCE = "ALLIANCE", "Todas as equipes afetadas"

    boss = models.ForeignKey(
            Boss,
            related_name="abilities",
            on_delete=models.CASCADE,
            verbose_name="Chefe",
            )
    name = models.CharField(
            max_length=100,
            verbose_name="Nome",
            help_text="Ex.: Olhar Hipnótico.",
            )
    trigger = models.CharField(
            max_length=12,
            choices=Trigger.choices,
            default=Trigger.GERAL,
            verbose_name="Gatilho",
            )
    effect = models.CharField(
            max_length=8,
            choices=Effect.choices,
            default=Effect.PENALTY,
            verbose_name="Efeito",
            )
    value = models.IntegerField(
            default=0,
            verbose_name="Valor",
            help_text="Pontos, PV ou % conforme o efeito.",
            )
    every = models.PositiveSmallIntegerField(
            default=1,
            verbose_name="A cada N erros",
            help_text="Só gatilho Perguntas: repete a cada N erros da equipe.",
            )
    threshold = models.SmallIntegerField(
            default=3,
            verbose_name="Nota de corte",
            help_text="Dispara com nota < corte (3 = nota máxima do rubric).",
            )
    mode = models.CharField(
            max_length=8,
            choices=Mode.choices,
            default=Mode.ANY,
            verbose_name="Modo",
            )
    scope = models.CharField(
            max_length=8,
            choices=Scope.choices,
            default=Scope.TEAM,
            verbose_name="Escopo",
            )
    min_count = models.PositiveSmallIntegerField(
            default=1,
            verbose_name="Mínimo de equipes",
            help_text="Só escopo Aliança: equipes afetadas necessárias.",
            )
    description = models.TextField(
            blank=True,
            verbose_name="Descrição",
            help_text="Texto de exibição (a regra como escrita na landing).",
            )

    class Meta:
        ordering = ["id"]
        verbose_name = "Habilidade do chefe"
        verbose_name_plural = "Habilidades do chefe"
        constraints = [
                models.UniqueConstraint(
                    fields=["boss", "name"], name="unique_boss_ability"
                    ),
                ]

    def __str__(self):
        return f"{self.boss}: {self.name} ({self.get_trigger_display()})"


class BossSpell(models.Model):
    boss = models.ForeignKey(
            Boss,
            related_name="boss_spells",
            on_delete=models.CASCADE
            )
    spell = models.ForeignKey(
            "spells.Spell",
            related_name="boss_links",
            on_delete=models.CASCADE
            )
    weight = models.PositiveSmallIntegerField(
            default=1,
            verbose_name="Peso",
            help_text="Chance relativa de ser escolhido pela IA do chefe.",
            )

    class Meta:
        constraints = [
                models.UniqueConstraint(fields=["boss", "spell"], name="unique_boss_spell")
                ]

    def __str__(self):
        return f"{self.boss} -> {self.spell.name} (x{self.weight})"


class Question(models.Model):
    boss = models.ForeignKey(
            Boss,
            related_name="questions",
            on_delete=models.CASCADE
            )
    text = models.TextField(
            verbose_name="Pergunta"
            )
    points = models.PositiveIntegerField(
            default=10,
            verbose_name="Pontos",
            help_text="Pontos ganhos e dano ao chefe se acertar.",
            )

    class Meta:
        verbose_name = "Pergunta"
        verbose_name_plural = "Perguntas"

    def __str__(self):
        return self.text[:60]


class Choice(models.Model):
    question = models.ForeignKey(
            Question, related_name="choices", on_delete=models.CASCADE
            )
    text = models.CharField(max_length=255, verbose_name="Alternativa")
    is_correct = models.BooleanField(default=False, verbose_name="Correta")

    class Meta:
        verbose_name = "Alternativa"
        verbose_name_plural = "Alternativas"

    def __str__(self):
        return self.text
