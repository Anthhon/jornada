"""Carrega o catálogo de habilidades de equipe por tema/tribo (idempotente).

O professor escolhe **3 básicas + 1 ultimate** de um mesmo tema na criação da
equipe (ADR-021); as habilidades são usadas **só na Arena**, com d20 no uso
(ADR-019) e cargas escaladas pelo bando (ADR-020). Rodar de novo não
duplica nem apaga templates customizados do professor (upsert por tema+nome).

Uso:
    manage.py seed_habilidades_equipe
"""

from django.core.management.base import BaseCommand

from apps.groups.models import TeamAbilityTemplate

TEMPLATES = [
    # --- Guardiões da Floresta -------------------------------------------
    {
        "theme": "Floresta",
        "name": "Golpe de Raiz",
        "kind": "BASIC",
        "effect": "STRIKE",
        "value": 150,
        "max_charges": 2,
        "description": "Raízes irrompem sob o chefe: 150 de dano direto (antes do d20).",
    },
    {
        "theme": "Floresta",
        "name": "Seiva Restauradora",
        "kind": "BASIC",
        "effect": "HEAL",
        "value": 40,
        "max_charges": 2,
        "description": "Recupera até 40 pontos perdidos em retaliações do chefe.",
    },
    {
        "theme": "Floresta",
        "name": "Fúria Verde",
        "kind": "BASIC",
        "effect": "BUFF",
        "value": 30,
        "max_charges": 2,
        "description": "O próximo ataque da equipe vale +30%.",
    },
    {
        "theme": "Floresta",
        "name": "Tempestade de Espinhos",
        "kind": "ULTIMATE",
        "effect": "STRIKE",
        "value": 500,
        "max_charges": 1,
        "description": "Chuva de espinhos: 500 de dano direto ao chefe (antes do d20).",
    },
    # --- Legião do Vulcão -------------------------------------------------
    {
        "theme": "Vulcão",
        "name": "Lança de Magma",
        "kind": "BASIC",
        "effect": "STRIKE",
        "value": 150,
        "max_charges": 2,
        "description": "Uma lança de rocha derretida: 150 de dano direto (antes do d20).",
    },
    {
        "theme": "Vulcão",
        "name": "Escudo de Basalto",
        "kind": "BASIC",
        "effect": "SHIELD",
        "value": 60,
        "max_charges": 2,
        "description": "Escudo de 60 pontos: absorve retaliações e penalidades.",
    },
    {
        "theme": "Vulcão",
        "name": "Ebulição",
        "kind": "BASIC",
        "effect": "BUFF",
        "value": 30,
        "max_charges": 2,
        "description": "O próximo ataque da equipe vale +30%.",
    },
    {
        "theme": "Vulcão",
        "name": "Erupção",
        "kind": "ULTIMATE",
        "effect": "STRIKE",
        "value": 500,
        "max_charges": 1,
        "description": "O caldeirão explode: 500 de dano direto ao chefe (antes do d20).",
    },
]


class Command(BaseCommand):
    help = "Seed idempotente do catálogo de habilidades de equipe (2 temas, 3+1 cada)."

    def handle(self, *args, **options):
        created = 0
        for spec in TEMPLATES:
            _, was_created = TeamAbilityTemplate.objects.update_or_create(
                theme=spec["theme"],
                name=spec["name"],
                defaults={
                    "kind": spec["kind"],
                    "effect": spec["effect"],
                    "value": spec["value"],
                    "max_charges": spec["max_charges"],
                    "description": spec["description"],
                },
            )
            created += int(was_created)
        themes = sorted(
            TeamAbilityTemplate.objects.values_list("theme", flat=True).distinct()
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"seed_habilidades_equipe: {created} criados "
                f"(total: {TeamAbilityTemplate.objects.count()} em {len(themes)} temas "
                f"– {', '.join(themes)})."
            )
        )
