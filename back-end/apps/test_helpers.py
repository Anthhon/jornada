"""Helpers compartilhados dos testes de API.

Descoberto pelo runner como ``test*.py`` (não contém TestCase, então nada é
executado aqui — só funções auxiliares importadas pelos ``tests.py`` dos apps).
"""

import itertools

from django.contrib.auth.models import User
from rest_framework.test import APIClient

# Faixa exclusiva dos helpers (000001, 000002, ...); os testes manuais usam
# matrículas explícitas em outras faixas (8xxxxx/9xxxxx) para nunca colidir.
_MATRICULAS = itertools.count(1)


def next_matricula():
    """Matrícula sintética única para testes — exatamente 6 dígitos."""
    return f"{next(_MATRICULAS):06d}"


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
    Student.objects.get_or_create(
        user=user,
        defaults={"name": username, "matricula": next_matricula()},
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def anon_client():
    """Client sem autenticação — visitante."""
    return APIClient()
