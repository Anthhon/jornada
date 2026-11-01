# API do back-end (Jornada)

Back-end **somente API JSON** (Django + DRF). Nenhuma página é renderizada;
toda visualização é do front-end React. Contrato completo e sempre atualizado:
`GET /api/schema/` (OpenAPI) — o front pode gerar tipos a partir dele.

## Rodar

```bash
bash tools/setup_dev.sh   # venv, dependências, migrations (não versionadas), migrate
back-end/.venv/bin/python back-end/manage.py createsuperuser   # primeiro professor
back-end/.venv/bin/python back-end/manage.py runserver
```

Produção (variáveis de ambiente): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`,
`DJANGO_ALLOWED_HOSTS=api.exemplo.com`, `CORS_ALLOWED_ORIGINS=https://front.exemplo.com`.

## Autenticação e papéis

- `POST /api/token/` `{username, password}` → `{access, refresh}`; `POST /api/token/refresh/`.
- Enviar `Authorization: Bearer <access>`.
- `GET /api/me/` → `{..., role: "teacher" | "student", student: {...} | null}`.
- **Professor/admin** = usuário que não tem registro de aluno (ou é staff): acesso total.
- **Aluno**: lê o conteúdo do jogo, vê só o **próprio** perfil (`/api/students/`), joga a batalha do **próprio grupo**.
- Visitante: só leitura pública (conteúdo, placar, estado da batalha).

## Recursos (CRUD: GET/POST/PUT/PATCH/DELETE; escrita só professor)

`users` (DELETE desativa) · `students` · `groups` · `spells` · `heroes` · `bosses` ·
`boss-spells` · `questions` · `choices` · `journeys` · `stages` · `group-journeys` ·
`stage-progress` · `battle-events` (somente leitura/criação — log append-only).
"Desativar" = `PATCH {"is_active": false}` (aluno desativado também perde o login).

| Endpoint | Para quê |
|---|---|
| `POST /api/students/bulk/` `{names:[...], group?}` | cria N alunos; devolve `[{id,name,username,password}]` (senha só aparece aqui) |
| `POST /api/groups/{id}/set-members/` `{students:[ids]}` | define de uma vez os membros do grupo |
| `POST /api/groups/{id}/add-extra-points/` `{amount}` | pontos extras da equipe (negativo desconta) |
| `PATCH /api/students/{id}/` `{grade}` | nota individual (0–10) |
| `GET /api/group-journeys/?group=&journey=&status=&student=` | histórico de jornadas (status `PROG`/`DONE`/`FAIL`) |
| `GET /api/group-journeys/{id}/summary/` | pontuação final, nota **sugerida** (pontos/máximo × 10) e desempenho por aluno |
| `GET /api/leaderboard/` | placar público (pontos de batalha + extras) |
| `GET /api/heroes/?group=&journey=` | herói do grupo (1 por grupo **por jornada**) |

## Batalha

Pré-requisitos: `GroupJourney` (grupo na jornada), `Hero` do grupo naquela jornada,
etapas com `boss_pool`, chefes com perguntas (≥2 alternativas, 1 correta).

1. `POST /api/battle/start/` `{group_journey, stage?}` → 201 com o **estado**.
   Sorteia o chefe do `boss_pool` da próxima etapa e a primeira pergunta.
2. `GET /api/battle/{id}/` → estado (público; use polling para o placar ao vivo).
3. `POST /api/battle/{id}/answer/` `{choice, student?, spell?}` →
   `{correct, finished, victory, state}`.

Regras de uma rodada:
- **Acertou**: ganha `question.points` de pontuação e causa esse dano ao chefe; se mandou
  `spell`, o feitiço também vale (dano no chefe; cura/escudo no herói; `power_bonus` do herói soma).
- **Errou**: sem dano e sem pontos (feitiço não é usado nem entra em recarga).
- Se o chefe sobreviveu, ele lança um feitiço (sorteado por peso) — dano no herói, cura/escudo nele mesmo.
- Feitiço com `cooldown_turns = N` fica indisponível por N turnos após o uso (`spells[].ready`).
- **Vitória** = HP do chefe 0 → etapa `DONE`. **Derrota** = HP do herói 0 (ou 50 turnos) → etapa `FAIL`.
- Em ambos os casos os pontos da etapa (limitados a `stage.max_score`) vão para o grupo e o grupo
  segue para a próxima etapa; ao fim da última, a jornada do grupo vira `DONE`.
- A alternativa correta **nunca** aparece no estado.

Estado: `{id, status, turn, score, group_journey, stage, hero{hp,max_hp,shield,...},
boss{hp,max_hp,shield,...}, question{id,text,points,choices[{id,text}]}|null, spells[], events[]}`.

Erros de regra: HTTP 400 `{"detail": "..."}`; sem login 401; sem permissão 403.
