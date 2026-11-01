# `tools/` — scripts de validação do backend

Pasta de gates reexecutáveis do backend (Jornada). Cada script testa um
bloco de trabalho do `PLANO.md` e **sai com código de saída 0/1**, então
serve de regressão manual e de check para CI no futuro.

| script | o que valida | quando rodar |
|---|---|---|
| `validar_fundacao.sh` | gate da **fundação** (Fase 0): `.gitignore`, dependências, `check`, drift de migrations, `migrate` do zero, schema, testes Django | antes de commitar qualquer mudança de base; depois de mexer em `requirements.txt`, `.gitignore` ou models |
| `validar_crud.sh` | gate do **CRUD** (Fase 1): `check`, drift, 14 models no admin, suíte (50+ casos) e **fumaça HTTP real** (runserver + ciclo JWT/POST/PATCH/DELETE + placar `/api/leaderboard/` via curl) | depois de mexer em serializers, views, urls, permissões ou admin |
| `checar_schema.py` | regressões de **schema** do banco (chamado pelo gate) | sozinho, contra um `.sqlite3` específico |

## Como rodar

```bash
# prerequisite: venv criado (uma vez só)
python3 -m venv back-end/.venv
back-end/.venv/bin/pip install -r back-end/requirements.txt

# gate da fundação
bash tools/validar_fundacao.sh
```

Saída esperada: linhas `[PASS]` e `RESULTADO: N pass, 0 fail` + `FUNDACAO OK ✔`.

## O que cada check prova (e por quê)

Os checks são **regressões de bugs reais** encontrados neste repositório
(ver `DOCUMENTACAO.md`):

1. **Pré-requisitos** — sem `back-end/.venv` ou sem `requirements.txt` nenhum
   outro check é confiável; o gate aborta cedo.
2. **`.gitignore` versiona migrations** — o template ignorava a pasta
   `migrations/`, então nenhuma migration nova seria versionada
   (`git check-ignore` em cada um dos 6 apps).
3. **Dependências pinadas** — compara `requirements.txt` (`nome==versão`) com o
   que está instalado, sem rede; pins fora do lugar = ambiente não reproduzível.
4. **`manage.py check`** — erros de configuração/imports do Django.
5. **`models ≡ migrations`** — `makemigrations --check` falha se alguém alterou
   um `models.py` sem gerar a migration.
6. **`migrate` do zero** — roda num SQLite **temporário** (`DB_NAME` no
   `settings.py`), nunca toca no `db.sqlite3` de desenvolvimento; prova que um
   colega recém-clonado consegue subir o banco.
7. **`checar_schema.py`** — as 4 regressões de modelo:
   - tabelas dos 6 apps existem (4 apps não tinham migrations);
   - `Student` está em `users` (não existe `groups_student`);
   - `groups_group` tem `points` e `created_at` (faltavam);
   - FK `users_student.group_id → groups_group` existe de verdade.
8. **`manage.py test`** — roda a suíte Django (hoje vazia; os testes de fórmula
   do motor de RPG entram aqui na Fase 2).

## Convenção

- Gates são **só leitura** sobre o ambiente de dev: criam banco temporário,
  apagam no `EXIT`, e não alteram código.
- Novo bloco de trabalho no `PLANO.md`? Crie o gate correspondente
  (`validar_<bloco>.sh`) junto com a tarefa — o critério de aceite do bloco é
  o gate passar.
