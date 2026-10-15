from django.db import models


class Combatant(models.Model):
    # Abstract base for anything that battles.
    # Ex.: Hero and bosses inherit it, so any Spell can
    # target any of them through the same interface.
    max_hp = models.PositiveIntegerField(
            default=100,
            verbose_name="HP máximo"
            )
    hp = models.PositiveIntegerField(
            default=100,
            verbose_name="HP atual"
            )
    shield = models.PositiveIntegerField(
            default=0,
            verbose_name="Escudo"
            )

    class Meta:
        abstract = True

    @property
    # Check if entity still alive
    def is_alive(self):
        return self.hp > 0

    # Damage entity 
    def take_damage(self, amount):
        amount = max(0, int(amount))

        # Shield absorbs damage
        absorbed = min(self.shield, amount)
        self.shield -= absorbed

        hp_loss = min(self.hp, amount - absorbed)
        self.hp -= hp_loss
        self.save(update_fields=["hp", "shield"])
        return absorbed + hp_loss

    # Heal entity
    def heal(self, amount):
        amount = max(0, int(amount))
        healed = min(self.max_hp - self.hp, amount) # Avoid healing above max_hp

        self.hp += healed
        self.save(update_fields=["hp"])
        return healed

    # Shield entity
    def add_shield(self, amount):
        amount = max(0, int(amount))
        self.shield += amount
        self.save(update_fields=["shield"])
        return amount

    # Restore entity HP
    def restore_full(self):
        self.hp = self.max_hp
        self.shield = 0
        self.save(update_fields=["hp", "shield"])


class Spell(models.Model):
    class SpellType(models.TextChoices):
        # DB value -> label shown in UI
        NONE = "NONE", "Indefinido"
        DAMAGE = "DMGE", "Dano"
        HEAL = "HEAL", "Cura"
        SHIELD = "SHLD", "Escudo"

    name = models.CharField(
            max_length=100,
            unique=True,
            verbose_name="Nome",
            )
    description = models.TextField(
            blank=True,
            verbose_name="Descrição"
            )
    spell_type = models.CharField(
            max_length=4,
            choices=SpellType.choices,
            default=SpellType.NONE,
            verbose_name="Tipo do feitiço",
            )
    base_value = models.PositiveIntegerField(
            default=0,
            verbose_name="Valor base",
            help_text="Dano, cura ou escudo base.",
            )
    max_value = models.PositiveIntegerField(
            null=True,
            blank=True,
            verbose_name="Valor máximo",
            help_text="Teto do efeito (inclui bônus). Vazio = sem limite.",
            )
    cooldown_turns = models.PositiveSmallIntegerField(
            default=0,
            verbose_name="Recarga (turnos)",
            )
    is_active = models.BooleanField(
            default=True,
            verbose_name="Ativo"
            )

    class Meta:
        ordering = ["name"]
        verbose_name = "Feitiço"
        verbose_name_plural = "Feitiços"

    def __str__(self):
        return f"Feitiço: {self.name}"

    def compute_value(self, power_bonus=0):
        value = self.base_value + max(0, int(power_bonus))

        if self.max_value is not None:
            value = min(value, self.max_value)

        return value

    # Apply effect to target (Combatant) and returns 
    # the effective amount done (damage, HP healed or shield added)
    def cast(self, target, power_bonus=0):
        value = self.compute_value(power_bonus)

        if self.spell_type == self.SpellType.DAMAGE:
            return target.take_damage(value)
        if self.spell_type == self.SpellType.HEAL:
            return target.heal(value)
        if self.spell_type == self.SpellType.SHIELD:
            return target.add_shield(value)

        return 0
