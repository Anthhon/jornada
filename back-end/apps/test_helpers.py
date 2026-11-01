"""Helpers compartilhados dos testes de API.

Descoberto pelo runner como ``test*.py`` (não contém TestCase, então nada é
executado aqui — só funções auxiliares importadas pelos ``tests.py`` dos apps).
"""

from django.contrib.auth.models import User
from rest_framework.test import APIClient


def staff_client(username="professor"):
    """Client autenticado como professor (is_staff) — tem permissão de escrita."""
    user, _ = User.objects.get_or_create(
        username=username, defaults={"is_staff": True}
    )
    if not user.is_staff:
        user.is_staff = True
        user.save(update_fields=["is_staff"])
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def user_client(username="aluno"):
    """Client autenticado como aluno (tem registro de Student, não é staff)."""
    from apps.users.models import Student

    user, _ = User.objects.get_or_create(username=username, defaults={})
    Student.objects.get_or_create(user=user, defaults={"name": username})
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def anon_client():
    """Client sem autenticação — visitante."""
    return APIClient()
