from django.db import models
from apps.spells.models import Combatant


# In-game representative of a group through a stage in journey
class Hero(Combatant):
    name = models.CharField(
            max_length=100,
            unique=True,
            verbose_name="Nome"
            )
    group = models.OneToOneField(
            "groups.Group",
            related_name="hero",
            on_delete=models.CASCADE,
            verbose_name="Grupo",
            )
    spells = models.ManyToManyField(
            "spells.Spell",
            related_name="heroes",
            blank=True,
            verbose_name="Feitiços",
            )
    power_bonus = models.PositiveIntegerField(
            default=0,
            verbose_name="Bônus de poder",
            help_text="Somado ao valor base de cada feitiço lançado.",
            )
    created_at = models.DateTimeField(
            auto_now_add=True,
            blank=True,
            null=True,
            )

    class Meta:
        ordering = ["name"]
        verbose_name = "Herói"
        verbose_name_plural = "Heróis"

    def __str__(self):
        return self.name

    # Uses Spell interface to cast spell
    def cast(self, spell, target):
        if not self.spells.filter(pk=spell.pk).exists():
            raise ValueError(f"{self.name} não foi capaz de usar {spell.name}.")
        return spell.cast(target, power_bonus=self.power_bonus)
