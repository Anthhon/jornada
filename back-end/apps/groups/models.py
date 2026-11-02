from django.db import models

class Group(models.Model):
    name = models.CharField(
            max_length=100,
            unique=True,
            verbose_name="Nome",
            )
    points = models.IntegerField(
            default=0,
            verbose_name="Qtd. de pontos",
            )
    extra_points = models.IntegerField(
            default=0,
            verbose_name="Pontos extras",
            help_text="Lançados manualmente pelo professor.",
            )
    is_active = models.BooleanField(
            default=True,
            verbose_name="Ativo"
            )
    created_at = models.DateTimeField(
            auto_now_add=True,
            blank=True,
            null=True,
            )

    class Meta:
        ordering = ["name"]
        verbose_name = "Grupo"
        verbose_name_plural = "Grupos"

    def __str__(self):
        return self.name

    @property
    def member_count(self):
        return self.students.count()

    @property
    def total_points(self):
        return self.points + self.extra_points

    # Add points (earned in battles) to respective group
    def add_points(self, amount):
        self.points = models.F("points") + int(amount)
        self.save(update_fields=["points"])
        self.refresh_from_db(fields=["points"])

    # Add extra points (given by the teacher) to respective group
    def add_extra_points(self, amount):
        self.extra_points = models.F("extra_points") + int(amount)
        self.save(update_fields=["extra_points"])
        self.refresh_from_db(fields=["extra_points"])
