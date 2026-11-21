"""Carrega os 7 chefes da landing com as habilidades executáveis (idempotente).

Os chefes da landing page (``front-end/mocks/landing-personagens.ts``) já vêm
pré-criados: este comando espelha esse catálogo no banco — nome, PV, descrição
e as 3 habilidades de cada chefe com os parâmetros que o motor executa
(``apps.bosses.engine``). Rodar de novo não duplica nem apaga habilidades
customizadas do professor (upsert por nome).

Uso:
    manage.py seed_chefes
"""

from django.core.management.base import BaseCommand

from apps.bosses.models import Boss, BossAbility

# Nomes antigos de demonstração -> nome canônico da landing.
LEGACY_ALIASES = {
    "Mothman": "Mothman, o Sábio",
    "O Rei Rato": "Rei Rato",
}

CHEFES = [
    {
        "name": "Mothman, o Sábio",
        "max_hp": 150,
        "description": (
            "Enfraquece o dano da Aliança diante de falhas em tempo, "
            "conceitos e perguntas."
        ),
        "is_active": True,
        "abilities": [
            {
                "name": "Olhar Hipnótico",
                "trigger": "TEMPO",
                "effect": "PENALTY",
                "value": 10,
                "description": (
                    "Se a equipe não atingir a nota máxima em Tempo, a "
                    "Aliança perde 10 pontos de Dano Base."
                ),
            },
            {
                "name": "Asas de Sombras",
                "trigger": "CONCEITO",
                "effect": "CUT",
                "value": 50,
                "threshold": 2,
                "scope": "ALLIANCE",
                "min_count": 2,
                "description": (
                    "Se mais de uma equipe tirar Parcial ou Ausente em "
                    "Paradigma ou Características, o dano extra dela é "
                    "cortado pela metade."
                ),
            },
            {
                "name": "Enxame Noturno",
                "trigger": "PERGUNTAS",
                "effect": "PENALTY",
                "value": 10,
                "every": 2,
                "description": (
                    "A cada duas perguntas erradas, a Aliança perde 10 "
                    "pontos de Dano Base."
                ),
            },
        ],
    },
    {
        "name": "Rei Rato",
        "max_hp": 150,
        "description": (
            "Penaliza falhas de tempo, conceitos e respostas durante a "
            "apresentação e a arguição."
        ),
        "is_active": True,
        "abilities": [
            {
                "name": "Olhar Hipnótico",
                "trigger": "TEMPO",
                "effect": "PENALTY",
                "value": 10,
                "description": (
                    "Se a equipe não atingir a nota máxima em Tempo, a "
                    "Aliança perde 10 pontos de Dano Base."
                ),
            },
            {
                "name": "Asas de Sombras",
                "trigger": "CONCEITO",
                "effect": "CUT",
                "value": 50,
                "threshold": 2,
                "scope": "ALLIANCE",
                "min_count": 1,
                "description": (
                    "Se ao menos uma equipe tirar Parcial ou Ausente em "
                    "Paradigma ou Características, o dano extra dela é "
                    "cortado pela metade."
                ),
            },
            {
                "name": "Enxame Noturno",
                "trigger": "PERGUNTAS",
                "effect": "PENALTY",
                "value": 7,
                "every": 1,
                "description": (
                    "A cada pergunta errada, a Aliança perde 7 pontos de "
                    "Dano Base."
                ),
            },
        ],
    },
    {
        "name": "Leshy",
        "max_hp": 130,
        "description": (
            "Recupera vida com falhas em fundamentos e perguntas erradas; "
            "confunde quem erra a demonstração."
        ),
        "is_active": True,
        "abilities": [
            {
                "name": "Raízes do Passado",
                "trigger": "FUNDAMENTOS",
                "effect": "HEAL",
                "value": 5,
                "description": (
                    "Se a equipe tirar menos que a nota máxima em Histórico "
                    "ou Paradigma, Leshy ganha imediatamente +5 PV."
                ),
            },
            {
                "name": "Esporos Confusos",
                "trigger": "DEMONSTRACAO",
                "effect": "DISADV",
                "value": 50,
                "description": (
                    "Sem a nota máxima em Principais Usos ou código, o dano "
                    "extra dessa equipe é reduzido em 50% (desvantagem)."
                ),
            },
            {
                "name": "Fungo do Dreno",
                "trigger": "PERGUNTAS",
                "effect": "HEAL",
                "value": 5,
                "every": 1,
                "description": (
                    "A cada pergunta errada na Fase 2, Leshy recupera 5 PV."
                ),
            },
        ],
    },
    {
        "name": "A Sombra Espreitadora",
        "max_hp": 130,
        "description": (
            "Drena dano da Aliança, ganha vida com falhas e enfraquece os "
            "dados extras de quem erra a demonstração."
        ),
        "is_active": True,
        "abilities": [
            {
                "name": "Dreno de Vitalidade",
                "trigger": "FUNDAMENTOS",
                "effect": "HEAL",
                "value": 5,
                "description": (
                    "Se a equipe tirar menos que a nota máxima em Histórico "
                    "ou Paradigma, a Sombra recupera +5 PV."
                ),
            },
            {
                "name": "Emboscada nas Sombras",
                "trigger": "DEMONSTRACAO",
                "effect": "CUT",
                "value": 50,
                "description": (
                    "Sem a nota máxima em Principais Usos ou código, o dano "
                    "extra dessa equipe é cortado pela metade."
                ),
            },
            {
                "name": "Ataque do Saqueador",
                "trigger": "PERGUNTAS",
                "effect": "DRAIN",
                "value": 5,
                "every": 1,
                "description": (
                    "A cada pergunta errada, drena 5 de Dano Base da "
                    "Aliança e soma ao próprio HP."
                ),
            },
        ],
    },
    {
        "name": "O Colecionador de Ossos",
        "max_hp": 130,
        "description": (
            "Reduz o Dano Base da Aliança com notas baixas e impõe "
            "desvantagem no Tempo; pune cada erro."
        ),
        "is_active": True,
        "abilities": [
            {
                "name": "Sopro de Ácido",
                "trigger": "GERAL",
                "effect": "PENALTY",
                "value": 5,
                "mode": "AVERAGE",
                "threshold": 1,
                "description": (
                    "Se a média dos critérios ficar abaixo de Satisfatório, "
                    "a Aliança perde 5 pontos de Dano Base."
                ),
            },
            {
                "name": "Rajada de Vento",
                "trigger": "TEMPO",
                "effect": "DISADV",
                "value": 50,
                "description": (
                    "Se a equipe não atingir a nota máxima em Tempo, seus "
                    "dados extras de dano são reduzidos em 50% "
                    "(desvantagem)."
                ),
            },
            {
                "name": "Rugido do Medo",
                "trigger": "PERGUNTAS",
                "effect": "PENALTY",
                "value": 10,
                "every": 1,
                "description": (
                    "A cada pergunta errada, a Aliança perde 10 pontos de "
                    "Dano Base."
                ),
            },
        ],
    },
    {
        "name": "O Colecionador de Faces",
        "max_hp": 130,
        "description": (
            "Castiga notas variadas e cada pergunta errada; encarece o "
            "suporte da Aliança."
        ),
        "is_active": True,
        "abilities": [
            {
                "name": "Máscara da Confusão",
                "trigger": "GERAL",
                "effect": "PENALTY",
                "value": 5,
                "mode": "SPREAD",
                "threshold": 2,
                "description": (
                    "Com notas muito variadas (2 níveis ou mais de "
                    "diferença), a Aliança perde 5 pontos de Dano Base."
                ),
            },
            {
                "name": "Máscara da Discórdia",
                "trigger": "SUPORTE",
                "effect": "PR_COST",
                "value": 2,
                "description": (
                    "Habilidades de suporte custam 2 PR a mais (informativo: "
                    "a raid ainda não usa o sistema de PR)."
                ),
            },
            {
                "name": "Máscara do Silêncio",
                "trigger": "PERGUNTAS",
                "effect": "PENALTY",
                "value": 5,
                "every": 1,
                "description": (
                    "A cada pergunta errada, a Aliança perde 5 pontos de "
                    "Dano Base."
                ),
            },
        ],
    },
    {
        "name": "O Mago Corrompido",
        "max_hp": 200,
        "description": (
            "Boss especial: surge quando os heróis repetem a mesma classe "
            "4 vezes seguidas. Distorce os dados de dano e pune erros."
        ),
        "is_active": False,
        "abilities": [
            {
                "name": "Distorção Temporal",
                "trigger": "TEMPO",
                "effect": "DISADV",
                "value": 50,
                "scope": "ALLIANCE",
                "min_count": 1,
                "description": (
                    "Se a média de Tempo das equipes ficar abaixo da nota "
                    "máxima, todas afetadas sofrem desvantagem no dano extra."
                ),
            },
            {
                "name": "Cegueira das Sombras",
                "trigger": "CONCEITO",
                "effect": "DISADV",
                "value": 50,
                "description": (
                    "Sem a nota máxima em Paradigma ou Características, o "
                    "dano extra da equipe é reduzido em 50%."
                ),
            },
            {
                "name": "Aniquilação da Alma",
                "trigger": "PERGUNTAS",
                "effect": "DRAIN",
                "value": 5,
                "every": 1,
                "description": (
                    "A cada pergunta errada, drena 5 de Dano Base e soma ao "
                    "próprio HP."
                ),
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Carrega os 7 chefes da landing com as habilidades executáveis."

    def _get_boss(self, spec: dict) -> tuple[Boss, bool]:
        name = spec["name"]
        boss = Boss.objects.filter(name=name).first()
        if boss is None:
            # Renomeia a demo antiga, se existir (evita duplicar o chefe).
            legacy = next(
                (old for old, new in LEGACY_ALIASES.items()
                 if new == name and Boss.objects.filter(name=old).exists()),
                None,
            )
            if legacy:
                boss = Boss.objects.get(name=legacy)
                boss.name = name
            else:
                boss = Boss(name=name)
        boss.max_hp = spec["max_hp"]
        boss.description = spec["description"]
        boss.is_active = spec["is_active"]
        boss.save()
        return boss, True

    def _sync_abilities(self, boss: Boss, specs: list) -> int:
        created = 0
        for spec in specs:
            _, was_created = BossAbility.objects.update_or_create(
                boss=boss,
                name=spec["name"],
                defaults={
                    "trigger": spec["trigger"],
                    "effect": spec["effect"],
                    "value": spec.get("value", 0),
                    "every": spec.get("every", 1),
                    "threshold": spec.get("threshold", 3),
                    "mode": spec.get("mode", "ANY"),
                    "scope": spec.get("scope", "TEAM"),
                    "min_count": spec.get("min_count", 1),
                    "description": spec.get("description", ""),
                },
            )
            created += int(was_created)
        return created

    def handle(self, *args, **options):
        bosses = 0
        abilities = 0
        for spec in CHEFES:
            boss, _ = self._get_boss(spec)
            bosses += 1
            abilities += self._sync_abilities(boss, spec["abilities"])
        self.stdout.write(
            self.style.SUCCESS(
                f"seed_chefes: {bosses} chefes e {abilities} habilidades "
                f"(total no banco: {BossAbility.objects.count()})."
            )
        )
