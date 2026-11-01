#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# tools/validar_crud.sh — gate do bloco CRUD (PLANO.md §8, Fase 1)
#
# O que valida:
#   1. pré-requisitos (venv + requirements)
#   2. manage.py check = 0 issues
#   3. models ≡ migrations (camada de API não pode driftar o model)
#   4. admin: os 14 models registrados
#   5. suíte de testes Django (45+ casos: CRUD, permissões, validações)
#   6. fumaça HTTP REAL: sobe o runserver num SQLite temporário e faz um
#      ciclo completo via curl (token JWT → POST/PATCH/DELETE → leitura
#      pública → placar GET /api/leaderboard/)
#
# Uso:   bash tools/validar_crud.sh
# Exit:  0 = tudo verde | 1 = falhou algum check
# -----------------------------------------------------------------------------

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BE="$ROOT/back-end"
PY="$BE/.venv/bin/python"
TMP_DB="crud_gate.sqlite3"
PORT=8791
BASE="http://127.0.0.1:$PORT"
SRV_LOG="$(mktemp /tmp/opencode/gate_srv.XXXXXX)"
SERVER_PID=""

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

cleanup() {
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null
        wait "$SERVER_PID" 2>/dev/null
    fi
    rm -f "$BE/$TMP_DB" "$SRV_LOG"
}
trap cleanup EXIT

http_code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

printf 'gate de CRUD — Jornada | %s\n' "$(date '+%Y-%m-%d %H:%M')"

# --- 1. pré-requisitos -------------------------------------------------------
title "1. Pré-requisitos"
if [ -x "$PY" ] && [ -f "$BE/requirements.txt" ]; then
    ok "venv: $($PY --version 2>&1)"
else
    bad "venv ou requirements.txt ausentes em back-end/"
    printf '\nRESULTADO: %d pass, %d fail — abortado.\n' "$pass" "$fail"
    exit 1
fi

# --- 2. manage.py check ------------------------------------------------------
title "2. manage.py check"
if out=$("$PY" "$BE/manage.py" check 2>&1); then
    ok "0 issues"
else
    bad "manage.py check com erros" "$out"
fi

# --- 3. models ≡ migrations --------------------------------------------------
title "3. models ≡ migrations (sem drift)"
if out=$("$PY" "$BE/manage.py" makemigrations --check --dry-run 2>&1); then
    ok "makemigrations --check: nada pendente"
else
    bad "model alterado sem migration" "$out"
fi

# --- 4. admin ----------------------------------------------------------------
title "4. Django admin (models registrados)"
# Ancora no início da linha: comentários (# @admin.register) não contam.
n_admin=$(grep -h '^[[:space:]]*@admin\.register' "$BE"/apps/*/admin.py 2>/dev/null | wc -l)
if [ "$n_admin" -ge 14 ]; then
    ok "$n_admin models registrados no admin (esperado ≥ 14)"
else
    bad "só $n_admin models no admin (esperado ≥ 14)" \
        "registrar: Profile, Student, Group, Spell, Hero, Boss, BossSpell, Question, Choice, Journey, Stage, GroupJourney, StageProgress, BattleEvent"
fi

# --- 5. suíte de testes ------------------------------------------------------
title "5. Suíte de testes (CRUD, permissões, validações)"
if out=$(cd "$BE" && "$PY" manage.py test --verbosity 1 2>&1); then
    ran=$(printf '%s\n' "$out" | grep -o 'Ran [0-9]* test[s]*' | tail -1)
    n_ran=$(printf '%s' "$ran" | grep -o '[0-9]*')
    if [ "${n_ran:-0}" -ge 1 ] && printf '%s' "$out" | grep -q '^OK'; then
        ok "$ran — OK"
    else
        bad "suíte sem testes executados" "$ran"
    fi
else
    bad "manage.py test falhou" "$out"
fi

# --- 6. fumaça HTTP ----------------------------------------------------------
title "6. Fumaça HTTP (runserver real + ciclo CRUD via curl)"
rm -f "$BE/$TMP_DB"
if ! out=$(DB_NAME="$TMP_DB" "$PY" "$BE/manage.py" migrate --noinput 2>&1); then
    bad "migrate do banco temporário falhou" "$out"
else
    ok "banco temporário migrado"

    # seed do professor (is_staff)
    if ! out=$(DB_NAME="$TMP_DB" "$PY" "$BE/manage.py" shell -c "
from django.contrib.auth.models import User
User.objects.filter(username='prof_gate').delete()
User.objects.create_user('prof_gate', 'prof_gate@jornada.dev', 'senha-gate-123', is_staff=True)
print('seed ok')" 2>&1); then
        bad "seed do usuário professor falhou" "$out"
    else
        ok "professor de teste criado"

        # sobe o servidor
        DB_NAME="$TMP_DB" "$PY" "$BE/manage.py" runserver "127.0.0.1:$PORT" --noreload \
            >"$SRV_LOG" 2>&1 &
        SERVER_PID=$!

        ready=""
        for _ in $(seq 1 40); do
            if [ "$(http_code "$BASE/api/groups/")" = "200" ]; then
                ready="sim"
                break
            fi
            sleep 0.25
        done

        if [ -z "$ready" ]; then
            bad "servidor não subiu em ${BASE}/api/groups/" "$(tail -15 "$SRV_LOG")"
        else
            ok "servidor no ar em $BASE"

            # a) leitura pública
            code=$(http_code "$BASE/api/groups/")
            [ "$code" = "200" ] && ok "GET anônimo /api/groups/ → 200" \
                                || bad "GET anônimo /api/groups/ → $code (esperado 200)"

            # b) escrita anônima negada
            code=$(http_code -X POST "$BASE/api/groups/" \
                   -H 'Content-Type: application/json' -d '{"name":"Intruso"}')
            case "$code" in
                401|403) ok "POST anônimo → $code (negado)" ;;
                *) bad "POST anônimo → $code (esperado 401/403)" ;;
            esac

            # c) token JWT do professor
            token=$(curl -s -X POST "$BASE/api/token/" \
                    -H 'Content-Type: application/json' \
                    -d '{"username":"prof_gate","password":"senha-gate-123"}' \
                | "$PY" -c 'import sys,json; print(json.load(sys.stdin).get("access",""))' 2>/dev/null)
            if [ -n "$token" ]; then
                ok "login JWT → access token"
            else
                bad "login JWT falhou" "$(curl -s -X POST "$BASE/api/token/" -H 'Content-Type: application/json' -d '{"username":"prof_gate","password":"senha-gate-123"}')"
            fi

            if [ -n "$token" ]; then
                AUTH="Authorization: Bearer $token"

                # d) cria (201)
                code=$(http_code -X POST "$BASE/api/groups/" \
                       -H "$AUTH" -H 'Content-Type: application/json' \
                       -d '{"name":"Equipe Gate","points":7}')
                [ "$code" = "201" ] && ok "POST autenticado → 201 (criado)" \
                                    || bad "POST autenticado → $code (esperado 201)"

                # e) lista pública contém o registro
                if curl -s "$BASE/api/groups/" | grep -q 'Equipe Gate'; then
                    ok "GET público lista o registro criado"
                else
                    bad "GET público não retornou o registro criado"
                fi

                # f) atualiza (200)
                id=$(curl -s "$BASE/api/groups/" \
                     | "$PY" -c 'import sys,json; d=json.load(sys.stdin); print(d[0]["id"] if d else "")')
                code=$(http_code -X PATCH "$BASE/api/groups/$id/" \
                       -H "$AUTH" -H 'Content-Type: application/json' \
                       -d '{"points":9}')
                [ "$code" = "200" ] && ok "PATCH autenticado → 200" \
                                    || bad "PATCH autenticado → $code (esperado 200)"

                # g) placar público: posição 1 + pontos 9 (épico Lista 1-2)
                placar=$(curl -s "$BASE/api/leaderboard/")
                if printf '%s' "$placar" | grep -q '"position":1' \
                   && printf '%s' "$placar" | grep -q '"points":9'; then
                    ok "GET público /api/leaderboard/ → posição 1, pontos 9"
                else
                    bad "placar fora do esperado" "$placar"
                fi

                # h) apaga (204)
                code=$(http_code -X DELETE "$BASE/api/groups/$id/" -H "$AUTH")
                [ "$code" = "204" ] && ok "DELETE autenticado → 204" \
                                    || bad "DELETE autenticado → $code (esperado 204)"

                # i) lista vazia de novo
                restante=$(curl -s "$BASE/api/groups/")
                [ "$restante" = "[]" ] && ok "lista vazia após DELETE" \
                                       || bad "lista não vazia após DELETE: $restante"
            fi
        fi
    fi
fi

# --- resumo ------------------------------------------------------------------
printf '\n---------------------------------------------\n'
printf 'RESULTADO: %d pass, %d fail\n' "$pass" "$fail"
if [ "$fail" -eq 0 ]; then
    printf 'CRUD OK ✔\n'
    exit 0
fi
printf 'CRUD COM FALHAS ✘\n'
exit 1
