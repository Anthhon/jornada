"""Carrega o catálogo de habilidades de equipe por tema/tribo (idempotente).

O professor escolhe **3 básicas + 1 ultimate** de um mesmo tema na criação da
equipe (ADR-021); as habilidades são usadas **só na Arena**, com d20 no uso
(ADR-019) e cargas escaladas pelo bando (ADR-020). Rodar de novo não
duplica nem apaga templates customizados do professor (upsert por tema+nome).

Também **atribui** o 3+1 do tema às equipes ativas que ainda não têm
nenhuma habilidade (as que já têm são respeitadas — escolha do professor).
As cargas nascem com a escala do bando pela referência padrão (4 equipes) e
o `start` da raid reajusta com o `balance_ref_teams` da rodada.

Uso:
    manage.py seed_habilidades_equipe                  # templates + atribui 3+1
    manage.py seed_habilidades_equipe --theme=Vulcão   # atribui outro tema
    manage.py seed_habilidades_equipe --no-assign      # só os templates
"""

from django.core.management.base import BaseCommand

from apps.arena.engine import scaled_charges
from apps.groups.models import Group, GroupAbility, TeamAbilityTemplate

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
    help = (
        "Seed idempotente do catálogo de habilidades de equipe (2 temas, 3+1 cada) "
        "e atribuição do 3+1 às equipes ativas sem habilidades."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--theme",
            default=None,
            help="Tema a atribuir às equipes (padrão: primeiro tema do catálogo).",
        )
        parser.add_argument(
            "--no-assign",
            action="store_true",
            help="Só cria os templates; não atribui habilidades às equipes.",
        )

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
        # order_by() zera o Meta.ordering: sem isso o DISTINCT herda
        # (theme, kind, name) e os temas saem repetidos no select.
        themes = sorted(
            TeamAbilityTemplate.objects.order_by()
            .values_list("theme", flat=True)
            .distinct()
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"seed_habilidades_equipe: {created} criados "
                f"(total: {TeamAbilityTemplate.objects.count()} em {len(themes)} temas "
                f"– {', '.join(themes)})."
            )
        )
        if not options["no_assign"]:
            atribuidas = self._atribuir_equipes(options["theme"], themes)
            if atribuidas:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"seed_habilidades_equipe: 3+1 atribuído a {atribuidas} "
                        f"equipe(s) sem habilidades."
                    )
                )

    def _atribuir_equipes(self, tema_escolhido, themes):
        """Atribui o 3+1 do tema às equipes ativas que não têm habilidade."""
        if not themes:
            return 0
        tema = tema_escolhido or themes[0]
        templates = list(
            TeamAbilityTemplate.objects.filter(theme=tema).order_by("kind", "name")
        )
        if len(templates) != 4:
            self.stderr.write(
                f"Tema {tema!r} com {len(templates)} template(s) — esperado 3+1. "
                f"Nada atribuído (temas: {', '.join(themes)})."
            )
            return 0

        ativos = Group.objects.filter(is_active=True).prefetch_related("abilities")
        sem_habilidades = [g for g in ativos if not g.abilities.exists()]
        # Referência padrão de escala (ArenaRound.balance_ref_teams = 4); o
        # start da raid reajusta com o valor real da rodada.
        n = ativos.count()
        for grupo in sem_habilidades:
            for template in templates:
                GroupAbility.objects.create(
                    group=grupo,
                    template=template,
                    charges_left=scaled_charges(template.max_charges, 4, n),
                )
        return len(sem_habilidades)
