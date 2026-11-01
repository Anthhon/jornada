#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# tools/validar_fundacao.sh — gate de regressão da FUNDação do backend
# (PLANO.md §8, Fase 0 — tarefas de base: .gitignore, migrations, deps)
#
# O que valida (cada check = uma regressão já vista no projeto):
#   1. pré-requisitos      venv + requirements.txt existem
#   2. .gitignore          NÃO ignora migrations (bug da linha 'migrations/')
#   3. dependências        pins do requirements.txt instaladas na versão exata
#   4. manage.py check     0 issues
#   5. models ≡ migrations makemigrations --check não acha drift
#   6. migrate do zero     aplica tudo num SQLite TEMPORÁRIO (dev db intocado)
#   7. schema              tools/checar_schema.py (tabelas/FKs/colunas)
#   8. manage.py test      runner Django verde
#
# Uso:   bash tools/validar_fundacao.sh
# Exit:  0 = tudo verde | 1 = falhou algum check (CI-friendly)
# -----------------------------------------------------------------------------

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BE="$ROOT/back-end"
PY="$BE/.venv/bin/python"
REQ="$BE/requirements.txt"
TMP_DB="validacao_tmp.sqlite3"   # relativo a BASE_DIR (back-end/)

pass=0
fail=0

ok()   { pass=$((pass + 1)); printf '  [PASS] %s\n' "$1"; }
bad()  {
    fail=$((fail + 1))
    printf '  [FAIL] %s\n' "$1"
    if [ $# -gt 1 ]; then
        printf '%s\n' "$2" | sed 's/^/         ↳ /'
    fi
}
title() { printf '\n== %s ==\n' "$1"; }

trap 'rm -f "$BE/$TMP_DB"' EXIT

printf 'gate de fundação — Jornada | %s\n' "$(date '+%Y-%m-%d %H:%M')"

# --- 1. pré-requisitos -------------------------------------------------------
title "1. Pré-requisitos"
if [ -x "$PY" ]; then
    ok "venv: $($PY --version 2>&1)"
else
    bad "venv back-end/.venv ausente" \
        "python3 -m venv back-end/.venv && back-end/.venv/bin/pip install -r back-end/requirements.txt"
    printf '\nRESULTADO: %d pass, %d fail — abortado (sem venv nada é validável).\n' "$pass" "$fail"
    exit 1
fi
if [ -f "$REQ" ]; then
    ok "requirements.txt presente"
else
    bad "requirements.txt ausente" "fixe as dependências do backend"
    printf '\nRESULTADO: %d pass, %d fail — abortado.\n' "$pass" "$fail"
    exit 1
fi

# --- 2. .gitignore versiona migrations --------------------------------------
title "2. .gitignore versiona migrations"
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    for app in users groups spells heroes bosses journeys; do
        p="back-end/apps/$app/migrations/0001_initial.py"
        if git -C "$ROOT" check-ignore -q "$p" 2>/dev/null; then
            bad ".gitignore IGNORA $p" "remova a linha 'migrations/' do .gitignore"
        else
            ok "versionável: $p"
        fi
    done
else
    bad "não é um repositório git: $ROOT"
fi

# --- 3. dependências pinadas e instaladas -----------------------------------
title "3. Dependências (pins == instaladas)"
if dep_out=$(cd "$BE" && "$PY" - <<'PYEOF'
import re
import sys
from pathlib import Path

def installed_version(want: str) -> str | None:
    from importlib.metadata import distributions
    target = want.replace("-", "_").lower()
    for dist in distributions():
        name = dist.metadata.get("Name") or ""
        if name.replace("-", "_").lower() == target:
            return dist.version
    return None

problems = []
for raw in Path("requirements.txt").read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    m = re.fullmatch(r"([A-Za-z0-9_.\-]+)==([A-Za-z0-9_.]+)", line)
    if not m:
        problems.append(f"linha fora do formato nome==versão: {line!r}")
        continue
    name, wanted = m.group(1), m.group(2)
    got = installed_version(name)
    if got is None:
        problems.append(f"{name}=={wanted} → não instalada")
    elif got != wanted:
        problems.append(f"{name} → instalada {got}, pin {wanted}")

if problems:
    print("\n".join(problems))
    sys.exit(1)
print("pins do requirements.txt 100% satisfeitas")
PYEOF
); then
    ok "$dep_out"
else
    bad "dependências fora do pin" "$dep_out"
fi

# --- 4. manage.py check ------------------------------------------------------
title "4. manage.py check"
if out=$("$PY" "$BE/manage.py" check 2>&1); then
    ok "0 issues"
else
    bad "manage.py check com erros" "$out"
fi

# --- 5. models ≡ migrations --------------------------------------------------
title "5. models ≡ migrations (sem drift)"
if out=$("$PY" "$BE/manage.py" makemigrations --check --dry-run 2>&1); then
    ok "makemigrations --check: nada pendente"
else
    bad "model alterado sem migration" "$out"
fi

# --- 6. migrate do zero (banco temporário) -----------------------------------
title "6. migrate do zero (banco temporário, dev db intocado)"
rm -f "$BE/$TMP_DB"
if out=$(DB_NAME="$TMP_DB" "$PY" "$BE/manage.py" migrate --noinput 2>&1); then
    applied=$(printf '%s\n' "$out" | grep -c 'Applying .* OK$')
    ok "migrate aplicou $applied migrations do zero"
else
    bad "migrate falhou" "$out"
fi

# --- 7. schema (regressões de modelo) ----------------------------------------
title "7. Schema do banco (tools/checar_schema.py)"
if [ -f "$BE/$TMP_DB" ]; then
    schema_out=$("$PY" "$ROOT/tools/checar_schema.py" "$BE/$TMP_DB" 2>&1)
    schema_rc=$?
    printf '%s\n' "$schema_out" | sed 's/^/         · /'
    if [ "$schema_rc" -eq 0 ]; then
        ok "schema íntegro (tabelas, colunas, FK)"
    else
        bad "schema com problemas (ver acima)"
    fi
else
    bad "banco temporário não foi criado (passo 6 falhou?)"
fi

# --- 8. testes Django --------------------------------------------------------
title "8. manage.py test (runner Django)"
if out=$(cd "$BE" && "$PY" manage.py test --verbosity 1 2>&1); then
    ran=$(printf '%s\n' "$out" | grep -o 'Ran [0-9]* test[s]*' | tail -1)
    ok "runner verde${ran:+ ($ran)}"
else
    bad "manage.py test falhou" "$out"
fi

# --- resumo ------------------------------------------------------------------
printf '\n---------------------------------------------\n'
printf 'RESULTADO: %d pass, %d fail\n' "$pass" "$fail"
if [ "$fail" -eq 0 ]; then
    printf 'FUNDACAO OK ✔\n'
    exit 0
fi
printf 'FUNDACAO COM FALHAS ✘\n'
exit 1
