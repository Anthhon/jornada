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

    class Meta:
        ordering = ["name"]
        verbose_name = "Chefe"
        verbose_name_plural = "Chefes"

    def __str__(self):
        return self.name

    # Weighted random pick of a spell (the boss 'AI'), none if no spells
    def choose_spell(self):
        links = list(self.boss_spells.select_related("spell").filter(spell__is_active=True))
        if not links:
            return None
        picked = random.choices(links, weights=[l.weight for l in links], k=1)[0]
        return picked.spell


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
