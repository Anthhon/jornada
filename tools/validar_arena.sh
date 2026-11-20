#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# tools/validar_arena.sh — gate do módulo Arena (raid do chefe da rodada)
#
# O que valida:
#   1. pré-requisitos (venv + requirements)
#   2. manage.py check = 0 issues
#   3. models ≡ migrations (arena não pode driftar)
#   4. admin: models da Arena registrados
#   5. suíte de testes (motor puro + API)
#   6. fumaça HTTP REAL: ciclo completo da raid (criar → start → attack →
#      state público → end → recompensa no /api/leaderboard/ → sem duplicar)
#
# Uso:   bash tools/validar_arena.sh
# Exit:  0 = tudo verde | 1 = falhou algum check
# -----------------------------------------------------------------------------

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BE="$ROOT/back-end"
PY="$BE/.venv/bin/python"
TMP_DB="arena_gate.sqlite3"
PORT=8793
BASE="http://127.0.0.1:$PORT"
SRV_LOG="$(mktemp "${TMPDIR:-/tmp}/gate_srv.XXXXXX")"
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

printf 'gate da Arena — Jornada | %s\n' "$(date '+%Y-%m-%d %H:%M')"

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
title "3. models da Arena geram migrations consistentes"
if out=$("$PY" "$BE/manage.py" makemigrations arena --check --dry-run 2>&1); then
    ok "models ≡ migrations (arena)"
else
    bad "models e migrations da Arena inconsistentes" "$out"
fi

# --- 4. admin ----------------------------------------------------------------
title "4. Django admin (models da Arena registrados)"
n_arena=$(grep -h '^[[:space:]]*@admin\.register' "$BE"/apps/arena/admin.py 2>/dev/null | wc -l)
if [ "$n_arena" -ge 2 ]; then
    ok "$n_arena models da Arena no admin (ArenaRound + ArenaEvent)"
else
    bad "só $n_arena models da Arena no admin (esperado ≥ 2)"
fi

# --- 5. suíte de testes ------------------------------------------------------
title "5. Suíte de testes (motor puro + API da Arena)"
if out=$(cd "$BE" && "$PY" manage.py test apps.arena --verbosity 1 2>&1); then
    ran=$(printf '%s\n' "$out" | grep -o 'Ran [0-9]* test[s]*' | tail -1)
    n_ran=$(printf '%s' "$ran" | grep -o '[0-9]*')
    if [ "${n_ran:-0}" -ge 1 ] && printf '%s' "$out" | grep -q '^OK'; then
        ok "$ran — OK"
    else
        bad "suíte da Arena sem testes executados" "$ran"
    fi
else
    bad "manage.py test apps.arena falhou" "$out"
fi

# --- 6. fumaça HTTP ----------------------------------------------------------
title "6. Fumaça HTTP (ciclo completo da raid via curl)"
rm -f "$BE/$TMP_DB"
if ! out=$(DB_NAME="$TMP_DB" "$PY" "$BE/manage.py" migrate --noinput 2>&1); then
    bad "migrate do banco temporário falhou" "$out"
else
    ok "banco temporário migrado"

    # seed: professor + chefe + equipe
    if ! out=$(DB_NAME="$TMP_DB" "$PY" "$BE/manage.py" shell -c "
from django.contrib.auth.models import User
from apps.bosses.models import Boss
from apps.groups.models import Group
User.objects.filter(username='prof_arena').delete()
User.objects.create_user('prof_arena', 'prof_arena@jornada.dev', 'senha-gate-123', is_staff=True)
Boss.objects.filter(name='Chefe Gate').delete()
b = Boss.objects.create(name='Chefe Gate', max_hp=15000)
Group.objects.filter(name='Equipe Arena').delete()
g = Group.objects.create(name='Equipe Arena')
print(f'seed ok boss={b.id} group={g.id}')" 2>&1); then
        bad "seed (professor/chefe/equipe) falhou" "$out"
    else
        ok "professor, chefe e equipe criados"
        BOSS_ID=$(printf '%s' "$out" | grep -o 'boss=[0-9]*' | grep -o '[0-9]*')
        GROUP_ID=$(printf '%s' "$out" | grep -o 'group=[0-9]*' | grep -o '[0-9]*')

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

            # login JWT do professor
            token=$(curl -s -X POST "$BASE/api/token/" \
                    -H 'Content-Type: application/json' \
                    -d '{"username":"prof_arena","password":"senha-gate-123"}' \
                | "$PY" -c 'import sys,json; print(json.load(sys.stdin).get("access",""))' 2>/dev/null)
            if [ -n "$token" ]; then
                ok "login JWT → access token"
                AUTH="Authorization: Bearer $token"

                # cria a rodada (201)
                rid=$(curl -s -X POST "$BASE/api/arena/rounds/" \
                        -H "$AUTH" -H 'Content-Type: application/json' \
                        -d "{\"name\":\"Rodada Gate\",\"boss\":$BOSS_ID,\"max_hp\":15000}" \
                    | "$PY" -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
                if [ -n "$rid" ]; then
                    ok "POST /api/arena/rounds/ → id $rid"
                else
                    bad "criação da rodada falhou"
                fi

                if [ -n "$rid" ]; then
                    # start
                    code=$(http_code -X POST "$BASE/api/arena/rounds/$rid/start/" -H "$AUTH")
                    [ "$code" = "200" ] && ok "POST .../start/ → 200" \
                                        || bad "POST .../start/ → $code (esperado 200)"

                    # attack (acerto 100 → dano 100, retaliação 25)
                    code=$(http_code -X POST "$BASE/api/arena/rounds/$rid/attack/" \
                           -H "$AUTH" -H 'Content-Type: application/json' \
                           -d "{\"group_id\":$GROUP_ID,\"correct\":true,\"points\":100}")
                    [ "$code" = "200" ] && ok "POST .../attack/ → 200" \
                                        || bad "POST .../attack/ → $code (esperado 200)"

                    # state público (anônimo): hp 14900 + equipe com dano/retaliação
                    state_ok=$(curl -s "$BASE/api/arena/rounds/$rid/state/" | "$PY" -c '
import sys, json
d = json.load(sys.stdin)
t = next((x for x in d["teams"] if x["group_name"] == "Equipe Arena"), None)
good = (d["hp"] == 14900 and t is not None
        and t["battle_damage"] == 100 and t["retaliation_loss"] == 25)
print("1" if good else "0")' 2>/dev/null)
                    [ "$state_ok" = "1" ] && ok "GET anônimo .../state/ → hp 14900, dano 100, retaliação 25" \
                                         || bad "state fora do esperado" "$(curl -s "$BASE/api/arena/rounds/$rid/state/")"

                    # end (recompensa = 100 - 25 = 75)
                    code=$(http_code -X POST "$BASE/api/arena/rounds/$rid/end/" -H "$AUTH")
                    [ "$code" = "200" ] && ok "POST .../end/ → 200" \
                                        || bad "POST .../end/ → $code (esperado 200)"

                    # placar público: equipe com 75 pontos
                    lb_ok=$(curl -s "$BASE/api/leaderboard/" | "$PY" -c '
import sys, json
data = json.load(sys.stdin)
row = next((r for r in data if r["name"] == "Equipe Arena"), None)
print("1" if row and row["points"] == 75 else "0")' 2>/dev/null)
                    [ "$lb_ok" = "1" ] && ok "GET público /api/leaderboard/ → Equipe Arena com 75 pontos" \
                                       || bad "recompensa não creditada no placar" "$(curl -s "$BASE/api/leaderboard/")"

                    # recompensa não duplica
                    code=$(http_code -X POST "$BASE/api/arena/rounds/$rid/end/" -H "$AUTH")
                    [ "$code" = "400" ] && ok "2º .../end/ → 400 (sem duplicar recompensa)" \
                                        || bad "2º .../end/ → $code (esperado 400)"
                fi
            else
                bad "login JWT falhou" "$(curl -s -X POST "$BASE/api/token/" -H 'Content-Type: application/json' -d '{"username":"prof_arena","password":"senha-gate-123"}')"
            fi
        fi
    fi
fi

# --- resumo ------------------------------------------------------------------
printf '\n---------------------------------------------\n'
printf 'RESULTADO: %d pass, %d fail\n' "$pass" "$fail"
if [ "$fail" -eq 0 ]; then
    printf 'ARENA OK ✔\n'
    exit 0
fi
printf 'ARENA COM FALHAS ✘\n'
exit 1
