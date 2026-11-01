#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# tools/setup_dev.sh — prepara o back-end para rodar na SUA máquina
#
# As migrations NÃO ficam no repositório (cada dev gera as suas — evita conflito
# entre desenvolvedores). Este script faz o passo-a-passo inteiro:
#   1. cria back-end/.venv (se não existir) e instala requirements.txt
#   2. gera as migrations dos 6 apps
#   3. aplica no banco local (back-end/db.sqlite3)
#
# Depois de `git pull` que mudou algum models.py, rode de novo — ou, se o banco
# local ficar inconsistente: apague back-end/db.sqlite3 e back-end/apps/*/migrations
# e rode este script outra vez.
#
# Uso: bash tools/setup_dev.sh
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BE="$ROOT/back-end"
APPS="users groups spells heroes bosses journeys"

if [ ! -x "$BE/.venv/bin/python" ]; then
    echo "→ criando venv em back-end/.venv"
    python3 -m venv "$BE/.venv"
fi
echo "→ instalando dependências"
"$BE/.venv/bin/pip" install -q -r "$BE/requirements.txt"

cd "$BE"
echo "→ gerando migrations ($APPS)"
.venv/bin/python manage.py makemigrations $APPS
echo "→ aplicando no banco local"
.venv/bin/python manage.py migrate

echo
echo "Pronto. Crie um professor:   back-end/.venv/bin/python back-end/manage.py createsuperuser"
echo "Suba a API:                  back-end/.venv/bin/python back-end/manage.py runserver"
