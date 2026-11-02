from django.db import models
from apps.spells.models import Combatant


# In-game representative of a group through a journey (1 hero per group
# per journey). The HP of a fight lives in StageProgress, each stage starts
# with the hero at max_hp.
class Hero(Combatant):
    name = models.CharField(
            max_length=100,
            verbose_name="Nome"
            )
    group = models.ForeignKey(
            "groups.Group",
            related_name="heroes",
            on_delete=models.CASCADE,
            verbose_name="Grupo",
            )
    journey = models.ForeignKey(
            "journeys.Journey",
            related_name="heroes",
            on_delete=models.CASCADE,
            verbose_name="Jornada",
            )
    is_active = models.BooleanField(
            default=True,
            verbose_name="Ativo"
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
        constraints = [
                models.UniqueConstraint(fields=["group", "journey"], name="unique_hero_group_journey")
                ]
        verbose_name = "Herói"
        verbose_name_plural = "Heróis"

    def __str__(self):
        return self.name

    # Uses Spell interface to cast spell
    def cast(self, spell, target):
        if not self.spells.filter(pk=spell.pk).exists():
            raise ValueError(f"{self.name} não foi capaz de usar {spell.name}.")
        return spell.cast(target, power_bonus=self.power_bonus)
