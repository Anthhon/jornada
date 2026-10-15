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

    # Add points to respective group
    def add_points(self, amount):
        self.points += int(amount)
        self.save(update_fields=["points"])
