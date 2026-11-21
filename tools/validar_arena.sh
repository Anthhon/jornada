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
#   7. fumaça do desfecho/progressão (ADR-018..021): saque na vitória,
#      fuga sem saque, escala do bando, initial_hp (chefe em fuga),
#      habilidade de equipe com d20 + cargas + renovação
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

    # seed: professor + chefe (com habilidade) + equipe
    if ! out=$(DB_NAME="$TMP_DB" "$PY" "$BE/manage.py" shell -c "
from django.contrib.auth.models import User
from apps.bosses.models import Boss, BossAbility
from apps.groups.models import Group
User.objects.filter(username='prof_arena').delete()
User.objects.create_user('prof_arena', 'prof_arena@jornada.dev', 'senha-gate-123', is_staff=True)
Boss.objects.filter(name='Chefe Gate').delete()
b = Boss.objects.create(name='Chefe Gate', max_hp=15000)
BossAbility.objects.create(boss=b, name='Olhar do Gate', trigger='TEMPO', effect='PENALTY', value=10, description='Nota abaixo do máximo em Tempo custa 10 de Dano Base.')
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

                # cria a rodada (201) — escala do bando desligada (ADR-020)
                # para os valores exatos desta fumaça
                rid=$(curl -s -X POST "$BASE/api/arena/rounds/" \
                        -H "$AUTH" -H 'Content-Type: application/json' \
                        -d "{\"name\":\"Rodada Gate\",\"boss\":$BOSS_ID,\"max_hp\":15000,\"balance_ref_teams\":0}" \
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

                    # --- habilidades do chefe (ADR-017) ---------------------
                    rid2=$(curl -s -X POST "$BASE/api/arena/rounds/" \
                            -H "$AUTH" -H 'Content-Type: application/json' \
                            -d "{\"name\":\"Rodada Gate 2\",\"boss\":$BOSS_ID,\"max_hp\":15000,\"balance_ref_teams\":0}" \
                        | "$PY" -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
                    if [ -n "$rid2" ]; then
                        code=$(http_code -X POST "$BASE/api/arena/rounds/$rid2/start/" -H "$AUTH")
                        [ "$code" = "200" ] && ok "2ª rodada .../start/ → 200" \
                                            || bad "2ª rodada .../start/ → $code (esperado 200)"

                        # notas por critério: Tempo=1 (abaixo do máximo) → penalidade de 10
                        code=$(http_code -X POST "$BASE/api/arena/rounds/$rid2/apply-performance/" \
                               -H "$AUTH" -H 'Content-Type: application/json' \
                               -d "{\"group_id\":$GROUP_ID,\"criteria\":{\"tempo\":1,\"historico\":3,\"paradigma\":3,\"caracteristicas\":3,\"usos\":3,\"codigo\":3,\"criatividade\":3}}")
                        [ "$code" = "200" ] && ok "POST .../apply-performance/ (notas) → 200" \
                                            || bad "apply-performance com notas → $code (esperado 200)"

                        # estado: dano derivado 1500 − 10 da habilidade + evento ABILITY
                        hab_ok=$(curl -s "$BASE/api/arena/rounds/$rid2/state/" | "$PY" -c '
import sys, json
d = json.load(sys.stdin)
t = next((x for x in d["teams"] if x["group_name"] == "Equipe Arena"), None)
ability = any(e["kind"] == "ABILITY" for e in d["events"])
good = (t is not None and t["base_damage"] == 1490 and t["criteria"]["tempo"] == 1
        and ability and len(d["boss"]["abilities"]) == 1 and d["hp"] == 13500)
print("1" if good else "0")' 2>/dev/null)
                        [ "$hab_ok" = "1" ] && ok "habilidade disparou: base 1490 (1500−10), evento ABILITY, hp 13500" \
                                            || bad "estado das habilidades fora do esperado" "$(curl -s "$BASE/api/arena/rounds/$rid2/state/")"

                        # registro duplo com notas → 400 (uma vez por equipe)
                        code=$(http_code -X POST "$BASE/api/arena/rounds/$rid2/apply-performance/" \
                               -H "$AUTH" -H 'Content-Type: application/json' \
                               -d "{\"group_id\":$GROUP_ID,\"criteria\":{\"tempo\":3,\"historico\":3,\"paradigma\":3,\"caracteristicas\":3,\"usos\":3,\"codigo\":3,\"criatividade\":3}}")
                        [ "$code" = "400" ] && ok "2º apply-performance (notas) → 400 (uma vez por equipe)" \
                                            || bad "2º apply-performance → $code (esperado 400)"
                    else
                        bad "2ª rodada não foi criada"
                    fi
                fi
            else
                bad "login JWT falhou" "$(curl -s -X POST "$BASE/api/token/" -H 'Content-Type: application/json' -d '{"username":"prof_arena","password":"senha-gate-123"}')"
            fi
        fi
    fi
fi

# --- 7. fumaça: saque, escala e habilidades de equipe ------------------------
title "7. Saque + escala do bando + habilidades de equipe (ADR-018..021)"
if [ -n "${AUTH:-}" ] && [ -n "${BOSS_ID:-}" ] && [ -n "${GROUP_ID:-}" ]; then
    # seed: um template e a habilidade atribuída à equipe do gate
    if ! out=$(DB_NAME="$TMP_DB" "$PY" "$BE/manage.py" shell -c "
from apps.groups.models import Group, GroupAbility, TeamAbilityTemplate
g = Group.objects.get(name='Equipe Arena')
t, _ = TeamAbilityTemplate.objects.get_or_create(
    theme='Gate', name='Golpe Gate', defaults=dict(
        kind='BASIC', effect='STRIKE', value=100, max_charges=2))
GroupAbility.objects.filter(group=g).delete()
ga = GroupAbility.objects.create(group=g, template=t)
print(f'abilities ok id={ga.id}')" 2>&1); then
        bad "seed de habilidade de equipe falhou" "$out"
    else
        ok "template + habilidade atribuída à equipe"
        AB_ID=$(printf '%s' "$out" | grep -o 'id=[0-9]*' | grep -o '[0-9]*')

        # 7a. saque na vitória: 100 PV, saque 500, escala desligada
        rid3=$(curl -s -X POST "$BASE/api/arena/rounds/" \
                -H "$AUTH" -H 'Content-Type: application/json' \
                -d "{\"name\":\"Rodada Saque\",\"boss\":$BOSS_ID,\"max_hp\":100,\"treasure\":500,\"balance_ref_teams\":0}" \
            | "$PY" -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
        curl -s -X POST "$BASE/api/arena/rounds/$rid3/start/" -H "$AUTH" > /dev/null
        curl -s -X POST "$BASE/api/arena/rounds/$rid3/attack/" -H "$AUTH" \
             -H 'Content-Type: application/json' \
             -d "{\"group_id\":$GROUP_ID,\"correct\":true,\"points\":60}" > /dev/null
        curl -s -X POST "$BASE/api/arena/rounds/$rid3/attack/" -H "$AUTH" \
             -H 'Content-Type: application/json' \
             -d "{\"group_id\":$GROUP_ID,\"correct\":true,\"points\":50}" > /dev/null
        saque_ok=$(curl -s "$BASE/api/arena/rounds/$rid3/state/" | "$PY" -c '
import sys, json
d = json.load(sys.stdin)
saque = [e for e in d["events"] if "Saque do Chefe" in e["message"]]
good = (d["outcome"] == "VICTORY" and d["treasure"] == 500
        and len(saque) == 1 and "golpe final" in saque[0]["message"]
        and "golpe final" in saque[0]["message"])
print("1" if good else "0")' 2>/dev/null)
        [ "$saque_ok" = "1" ] && ok "vitória → outcome VICTORY + saque 500 rateado (golpe final)" \
                             || bad "saque na vitória fora do esperado" "$(curl -s "$BASE/api/arena/rounds/$rid3/state/")"

        # placar: 75 (seção 6) + 83 proporcional (110 − 27) + 500 do saque
        lb_ok=$(curl -s "$BASE/api/leaderboard/" | "$PY" -c '
import sys, json
data = json.load(sys.stdin)
row = next((r for r in data if r["name"] == "Equipe Arena"), None)
print("1" if row and row["points"] == 658 else "0")' 2>/dev/null)
        [ "$lb_ok" = "1" ] && ok "placar = 658 (75 + 83 + 500 de saque)" \
                           || bad "saque não entrou no placar" "$(curl -s "$BASE/api/leaderboard/")"

        # 7b. escala do bando: ref=4 com 1 equipe → dano ×2
        rid4=$(curl -s -X POST "$BASE/api/arena/rounds/" \
                -H "$AUTH" -H 'Content-Type: application/json' \
                -d "{\"name\":\"Rodada Escala\",\"boss\":$BOSS_ID,\"max_hp\":15000,\"balance_ref_teams\":4}" \
            | "$PY" -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
        curl -s -X POST "$BASE/api/arena/rounds/$rid4/start/" -H "$AUTH" > /dev/null
        curl -s -X POST "$BASE/api/arena/rounds/$rid4/attack/" -H "$AUTH" \
             -H 'Content-Type: application/json' \
             -d "{\"group_id\":$GROUP_ID,\"correct\":true,\"points\":100}" > /dev/null
        escala_ok=$(curl -s "$BASE/api/arena/rounds/$rid4/state/" | "$PY" -c '
import sys, json
d = json.load(sys.stdin)
t = d["teams"][0]
good = (d["balance"] == 2.0 and t["battle_damage"] == 200
        and t["retaliation_loss"] == 50 and d["hp"] == 14800)
print("1" if good else "0")' 2>/dev/null)
        [ "$escala_ok" = "1" ] && ok "escala ×2 (ref 4 ÷ 1 equipe): dano 200, retaliação 50" \
                              || bad "escala do bando fora do esperado" "$(curl -s "$BASE/api/arena/rounds/$rid4/state/")"

        # 7c. fuga: encerra com PV > 0 → RETREAT, sem saque
        rid5=$(curl -s -X POST "$BASE/api/arena/rounds/" \
                -H "$AUTH" -H 'Content-Type: application/json' \
                -d "{\"name\":\"Rodada Fuga\",\"boss\":$BOSS_ID,\"max_hp\":15000,\"treasure\":500,\"balance_ref_teams\":0}" \
            | "$PY" -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
        curl -s -X POST "$BASE/api/arena/rounds/$rid5/start/" -H "$AUTH" > /dev/null
        curl -s -X POST "$BASE/api/arena/rounds/$rid5/attack/" -H "$AUTH" \
             -H 'Content-Type: application/json' \
             -d "{\"group_id\":$GROUP_ID,\"correct\":true,\"points\":40}" > /dev/null
        curl -s -X POST "$BASE/api/arena/rounds/$rid5/end/" -H "$AUTH" > /dev/null
        fuga_ok=$(curl -s "$BASE/api/arena/rounds/$rid5/state/" | "$PY" -c '
import sys, json
d = json.load(sys.stdin)
saque = [e for e in d["events"] if "Saque do Chefe" in e["message"]]
print("1" if d["outcome"] == "RETREAT" and not saque else "0")' 2>/dev/null)
        [ "$fuga_ok" = "1" ] && ok "derrota → RETREAT (chefe escapa com o saque)" \
                             || bad "fuga sem desfecho/saque correto" "$(curl -s "$BASE/api/arena/rounds/$rid5/state/")"

        # 7d. rematch: initial_hp (chefe em fuga continua do dano)
        hp_echo=$(curl -s -X POST "$BASE/api/arena/rounds/" \
                -H "$AUTH" -H 'Content-Type: application/json' \
                -d "{\"name\":\"Rodada Rematch\",\"boss\":$BOSS_ID,\"max_hp\":15000,\"initial_hp\":9000,\"balance_ref_teams\":0}" \
            | "$PY" -c 'import sys,json; d=json.load(sys.stdin); print("1" if d.get("hp")==9000 else "0")' 2>/dev/null)
        [ "$hp_echo" = "1" ] && ok "initial_hp=9000 → nasce ferido (chefe em fuga)" \
                             || bad "initial_hp não respeitado"

        # 7e. habilidade de equipe com d20 + renovação (ADR-019/021)
        rid6=$(curl -s -X POST "$BASE/api/arena/rounds/" \
                -H "$AUTH" -H 'Content-Type: application/json' \
                -d "{\"name\":\"Rodada Habilidades\",\"boss\":$BOSS_ID,\"max_hp\":15000,\"balance_ref_teams\":0}" \
            | "$PY" -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
        curl -s -X POST "$BASE/api/arena/rounds/$rid6/start/" -H "$AUTH" > /dev/null
        ab_id="$AB_ID"
        curl -s -X POST "$BASE/api/arena/rounds/$rid6/use-ability/" -H "$AUTH" \
             -H 'Content-Type: application/json' \
             -d "{\"group_id\":$GROUP_ID,\"ability_id\":$ab_id}" > /dev/null
        uso_ok=$(curl -s "$BASE/api/arena/rounds/$rid6/state/" | "$PY" -c '
import sys, json
d = json.load(sys.stdin)
t = d["teams"][0]
ev = next((e for e in d["events"] if e["kind"] == "ABILITY"), None)
good = (t["abilities"] and t["abilities"][0]["charges_left"] == 1
        and t["battle_damage"] in (50, 100, 200)   # d20: falha/normal/crítico
        and ev is not None and ev["actor"] == "TEAM"
        and ev["roll"] and 1 <= ev["roll"] <= 20
        and ev["ability_name"] == "Golpe Gate")
print("1" if good else "0")' 2>/dev/null)
        [ "$uso_ok" = "1" ] && ok "use-ability: d20 1..20 no evento, carga 1, dano conforme rolou" \
                            || bad "uso de habilidade fora do esperado" "$(curl -s "$BASE/api/arena/rounds/$rid6/state/")"

        # 2º uso ok (carga 1→0), 3º uso sem carga → 400; renovação volta p/ 2
        code2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/arena/rounds/$rid6/use-ability/" \
                -H "$AUTH" -H 'Content-Type: application/json' \
                -d "{\"group_id\":$GROUP_ID,\"ability_id\":$ab_id}")
        code3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/arena/rounds/$rid6/use-ability/" \
                -H "$AUTH" -H 'Content-Type: application/json' \
                -d "{\"group_id\":$GROUP_ID,\"ability_id\":$ab_id}")
        if [ "$code2" = "200" ] && [ "$code3" = "400" ]; then
            ok "2º use-ability → 200; 3º → 400 (cargas esgotadas)"
        else
            bad "bloqueio de cargas errado (2º=$code2, 3º=$code3)"
        fi
        curl -s -X POST "$BASE/api/arena/rounds/$rid6/renew-abilities/" -H "$AUTH" \
             -H 'Content-Type: application/json' \
             -d "{\"group_id\":$GROUP_ID}" > /dev/null
        renew_ok=$(curl -s "$BASE/api/arena/rounds/$rid6/state/" | "$PY" -c '
import sys, json
d = json.load(sys.stdin)
t = d["teams"][0]
print("1" if t["abilities"] and t["abilities"][0]["charges_left"] == 2 else "0")' 2>/dev/null)
        [ "$renew_ok" = "1" ] && ok "renew-abilities → cargas de volta em 2" \
                              || bad "renovação não repos as cargas"
    fi
else
    bad "sem token/ids para a fumaça 7 (veja a seção 6)"
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
