from django.conf import settings
from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

class Profile(models.Model):
    created_at = models.DateTimeField(
            auto_now_add=True,
            blank=True,
            null=True,
            )
    updated_at = models.DateTimeField(
            auto_now=True,
            blank=True,
            null=True,
            )
    user = models.OneToOneField(
            User,
            related_name='profile',
            on_delete=models.CASCADE,
            )

    def __str__(self):
        return self.user.username

class Student(models.Model):
    name = models.CharField(
            max_length=100,
            verbose_name="Nome do estudante",
            )
    # Should be linked manually by an admin, a User only counts
    # as a student once a Student row points at it.
    user = models.OneToOneField(
            settings.AUTH_USER_MODEL,
            related_name="student",
            on_delete=models.SET_NULL,
            null=True,
            blank=True,
            verbose_name="Usuário",
            )
    # Nullable: student exists before being placed in a group.
    group = models.ForeignKey(
            "groups.Group",
            related_name="students",
            on_delete=models.SET_NULL,
            null=True,
            blank=True,
            verbose_name="Grupo",
            )
    grade = models.DecimalField(
            max_digits=4,
            decimal_places=2,
            null=True,
            blank=True,
            validators=[MinValueValidator(0), MaxValueValidator(10)],
            verbose_name="Nota individual",
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
        verbose_name = "Estudante"
        verbose_name_plural = "Estudantes"

    def __str__(self):
        return self.name
