#!/usr/bin/env python3
"""checar_schema.py — regressões de schema do banco do backend (Jornada).

Uso:
    python tools/checar_schema.py caminho/do/banco.sqlite3

O gate `tools/validar_fundacao.sh` chama este script num SQLite temporário
(DB_NAME), mas ele roda sozinho em qualquer banco do projeto.

O que prova (bugs reais já encontrados no repositório):
  1. existem as tabelas dos 6 apps (users, groups, spells, heroes, bosses,
     journeys) — as 4 apps que nem tinham pasta de migrations;
  2. `Student` vive no app `users` (não existe `groups_student` — a migração
     antiga do groups criava Student no app errado);
  3. `groups_group` tem as colunas `points` e `created_at` (faltavam na
     migração antiga);
  4. a FK `users_student.group_id` referencia `groups_group` (integridade
     referencial real, não só nome de coluna).

Sai com 0 se tudo ok, 1 caso contrário (CI-friendly).
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

TABELAS_ESPERADAS = (
    # users
    "users_profile",
    "users_student",
    # groups
    "groups_group",
    # spells
    "spells_spell",
    # heroes
    "heroes_hero",
    # bosses
    "bosses_boss",
    "bosses_bossspell",
    "bosses_question",
    "bosses_choice",
    # journeys
    "journeys_journey",
    "journeys_stage",
    "journeys_groupjourney",
    "journeys_stageprogress",
    "journeys_battleevent",
)

# Colunas que a migração antiga não criava (regressão obrigatória).
COLUNAS_ESPERADAS = {
    "groups_group": {"name", "points", "created_at"},
    "users_student": {"name", "user_id", "group_id", "created_at"},
}

# Tabelas que NÃO podem existir (Student no app errado).
TABELAS_PROIBIDAS = ("groups_student",)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2

    db_path = Path(sys.argv[1])
    if not db_path.is_file():
        print(f"[FAIL] banco não encontrado: {db_path}")
        return 1

    problems: list[str] = []
    oks: list[str] = []

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        existentes = {
            row[0]
            for row in cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }

        # 1. tabelas dos 6 apps
        faltantes = [t for t in TABELAS_ESPERADAS if t not in existentes]
        if faltantes:
            problems.append(f"tabelas ausentes: {', '.join(faltantes)}")
        else:
            oks.append(f"{len(TABELAS_ESPERADAS)} tabelas dos 6 apps criadas")

        # 2. Student no app errado
        proibidas = [t for t in TABELAS_PROIBIDAS if t in existentes]
        if proibidas:
            problems.append(
                f"tabela no app errado existe: {', '.join(proibidas)} "
                "(Student deve estar em users)"
            )
        else:
            oks.append("Student em users (nenhuma tabela groups_student)")

        # 3. colunas obrigatórias
        for tabela, esperadas in COLUNAS_ESPERADAS.items():
            if tabela not in existentes:
                continue  # já reportada como ausente no passo 1
            colunas = {
                row[1] for row in cur.execute(f"PRAGMA table_info({tabela})")
            }
            faltam = esperadas - colunas
            if faltam:
                problems.append(
                    f"{tabela} sem colunas: {', '.join(sorted(faltam))}"
                )
            else:
                oks.append(
                    f"{tabela} com {', '.join(sorted(esperadas))}"
                )

        # 4. FK users_student.group_id -> groups_group
        if {"users_student", "groups_group"} <= existentes:
            fks = list(
                cur.execute("PRAGMA foreign_key_list(users_student)")
            )
            ok_fk = any(
                row[2] == "groups_group" and row[3] == "group_id"
                for row in fks  # (id, seq, table, from, to, ...)
            )
            if ok_fk:
                oks.append("FK users_student.group_id -> groups_group")
            else:
                problems.append(
                    "users_student.group_id não referencia groups_group"
                )
    finally:
        conn.close()

    for line in oks:
        print(f"[PASS] {line}")
    for line in problems:
        print(f"[FAIL] {line}")

    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
