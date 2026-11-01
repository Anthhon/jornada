# Jornada — D&D: Debugs and Developers

> Plataforma de gamificação educacional que transforma atividades de aprendizagem em jornadas com temática de RPG, permitindo que professores organizem grupos, acompanhem o desempenho dos estudantes e conduzam desafios por meio de batalhas contra chefes.

**Status:** em desenvolvimento  
**Repositório:** [Anthhon/jornada](https://github.com/Anthhon/jornada)

---

## Sumário

- [Visão geral](#visão-geral)
- [Objetivos](#objetivos)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como executar](#como-executar)
- [API](#api)
- [Motor de batalha](#motor-de-batalha)
- [Validação e testes](#validação-e-testes)
- [Documentação complementar](#documentação-complementar)
- [Estado atual e próximos passos](#estado-atual-e-próximos-passos)

## Visão geral

O **Jornada** é um sistema de apoio à gamificação de atividades educacionais. A proposta é organizar uma turma em grupos e representar o avanço dos estudantes por meio de jornadas compostas por etapas. Em cada etapa, o grupo enfrenta um chefe, responde a perguntas e pode utilizar habilidades associadas ao herói escolhido para a jornada.

A aplicação é dividida em um back-end responsável pelas regras de negócio e persistência dos dados e um front-end web responsável pela experiência de uso. O projeto também contém scripts para preparar o ambiente e executar verificações automatizadas do back-end.

## Objetivos

- Apoiar professores na organização de turmas, grupos e jornadas.
- Tornar o acompanhamento do desempenho dos estudantes mais claro.
- Associar perguntas e atividades a uma dinâmica de progressão inspirada em RPGs.
- Registrar as ações realizadas durante as batalhas para permitir auditoria e geração de resumos.
- Manter separadas as regras de negócio do motor de batalha e a camada HTTP da API.

## Funcionalidades

A tabela abaixo diferencia recursos identificados no código atual de funcionalidades que ainda dependem de integração ou implementação adicional.

| Área | Funcionalidade | Situação observada |
|---|---|---|
| Usuários | Modelo de usuário e autenticação baseada em JWT | Implementação no back-end |
| Grupos | Cadastro e gerenciamento de grupos | Implementação no back-end |
| Estudantes | Associação de estudantes a grupos | Modelo e relacionamento no back-end |
| Pontuação | Acúmulo de pontos do grupo | Regra presente no back-end |
| Heróis | Cadastro de heróis e associação à jornada/grupo | Implementação no back-end |
| Feitiços | Tipos de feitiço, efeitos de combate e recarga | Regras presentes no back-end |
| Chefes | Cadastro de chefes, feitiços e perguntas com alternativas | Implementação no back-end |
| Jornadas | Jornadas compostas por etapas ordenadas | Modelos no back-end |
| Batalhas | Sorteio de chefe e perguntas, resolução de turnos e condições de vitória/derrota | Motor implementado no back-end |
| Histórico | Registro de eventos de batalha | Modelo `BattleEvent` |
| Resumo | Pontuação, etapas e desempenho individual | Função de resumo no motor |
| Interface web | Aplicação Next.js | Estrutura inicial; experiência completa ainda em desenvolvimento |
| Testes automatizados | Testes de regras de negócio e integração | Suíte Django indicada como vazia na documentação de validação |

A situação acima é uma fotografia do código consultado, não uma declaração de que todo o fluxo já esteja pronto para uso em produção. Consulte o [ROADMAP.md](ROADMAP.md) para acompanhar o que está implementado, parcial ou pendente.

## Arquitetura

O projeto está organizado em três partes principais:

### Back-end

Aplicação Django com Django REST Framework. Concentra:

- modelos e relacionamentos;
- serialização e validação de dados;
- autenticação e permissões;
- endpoints HTTP;
- regras de negócio de combate e progressão;
- documentação do contrato da API.

O motor de batalha está isolado em `apps/journeys/battle.py`. Ele não depende diretamente de requisições HTTP: as views chamam suas funções e convertem erros de regra de negócio em respostas da API.

### Front-end

Aplicação web baseada em Next.js e React. O `package.json` define scripts de desenvolvimento, build, execução de produção e lint. A interface ainda deve ser considerada uma base em evolução; a existência de uma rota ou componente inicial não significa que os fluxos completos especificados nos requisitos estejam integrados.

### Ferramentas de desenvolvimento

A pasta `tools/` contém scripts para preparar o ambiente e validar etapas do back-end. Os gates verificam configuração do Django, dependências, migrations, schema do banco, registros no admin e chamadas HTTP de fumaça.

## Tecnologias

### Back-end

- Python
- Django `5.2.18`
- Django REST Framework `3.18.3`
- Simple JWT `5.5.1`
- django-cors-headers `4.9.0`
- drf-spectacular `0.30.0`

As versões estão fixadas em [`back-end/requirements.txt`](back-end/requirements.txt).

### Front-end

- Next.js `16.3.5`
- React `19.2.8`
- TypeScript `5`
- Tailwind CSS `4`
- Axios `1.20.x`
- ESLint `9`

As dependências e os scripts estão definidos em [`front-end/package.json`](front-end/package.json).

### Banco de dados

O ambiente de desenvolvimento utiliza SQLite, conforme a configuração e os scripts de validação do back-end. A escolha de banco para implantação deve ser formalizada antes de um ambiente de produção.

## Estrutura do repositório

```text
jornada/
├── back-end/
│   ├── apps/
│   │   ├── bosses/       # Chefes, perguntas e alternativas
│   │   ├── groups/       # Grupos, estudantes e pontuação
│   │   ├── heroes/       # Heróis
│   │   ├── journeys/     # Jornadas, etapas e motor de batalha
│   │   ├── spells/       # Feitiços e regras de combate
│   │   └── users/        # Usuários, estudantes e permissões
│   ├── config/           # Configurações e roteamento do Django
│   ├── manage.py
│   ├── requirements.txt
│   └── API.md
├── front-end/            # Aplicação Next.js
├── tools/
│   ├── setup_dev.sh
│   ├── validar_fundacao.sh
│   ├── validar_crud.sh
│   └── checar_schema.py
├── README.md
└── ROADMAP.md
```

> A estrutura acima destaca os diretórios e módulos relevantes. Arquivos auxiliares, migrations e componentes internos podem variar conforme a evolução do projeto.

## Como executar

### Pré-requisitos

- Git
- Python compatível com as dependências do projeto. O arquivo de requisitos registra validação com Python `3.14.7`.
- Node.js compatível com Next.js 16 (Node.js `20.9` ou superior).
- npm

### 1. Clonar o repositório

```bash
git clone https://github.com/Anthhon/jornada.git
cd jornada
```

### 2. Preparar o back-end

Na raiz do repositório:

```bash
python3 -m venv back-end/.venv
back-end/.venv/bin/pip install -r back-end/requirements.txt
```

O repositório também disponibiliza um script de preparação:

```bash
bash tools/setup_dev.sh
```

Esse script prepara o ambiente, instala as dependências e executa as operações locais de banco descritas em `tools/README.md`.

### 3. Iniciar o back-end

```bash
cd back-end
.venv/bin/python manage.py runserver
```

Por padrão, o servidor de desenvolvimento do Django fica disponível em:

```text
http://127.0.0.1:8000/
```

### 4. Preparar e iniciar o front-end

Em outro terminal:

```bash
cd front-end
npm install
npm run dev
```

A aplicação Next.js fica normalmente disponível em:

```text
http://localhost:3000/
```

> **Integração:** confirme a URL-base da API e as variáveis de ambiente utilizadas pelo front-end antes de executar os fluxos integrados. Não inclua tokens, senhas ou credenciais no repositório.

## API

A API é construída com Django REST Framework. A documentação específica de endpoints, payloads e respostas deve ser mantida em [`back-end/API.md`](back-end/API.md).

O projeto utiliza `drf-spectacular` para geração de schema OpenAPI. Consulte a configuração de URLs do back-end para os caminhos efetivamente expostos no ambiente em execução.

A autenticação utiliza JWT. Clientes devem obter e enviar os tokens conforme o contrato documentado pela API, normalmente no cabeçalho:

```http
Authorization: Bearer <access_token>
```

Não presuma que um endpoint está disponível apenas por existir um modelo correspondente: a disponibilidade deve ser conferida no roteamento e na documentação da API.

## Motor de batalha

O módulo `back-end/apps/journeys/battle.py` concentra as regras centrais de uma batalha.

### Fluxo geral

1. `start_stage()` valida a jornada do grupo e identifica a próxima etapa pendente.
2. O motor verifica se há um herói ativo e chefes elegíveis com perguntas jogáveis.
3. Um chefe é sorteado do conjunto associado à etapa.
4. Um `StageProgress` é criado com os estados iniciais de vida e escudo.
5. `answer()` valida a alternativa enviada e, se aplicável, o feitiço escolhido.
6. Uma resposta correta concede pontos e causa dano ao chefe; feitiços podem aplicar efeitos adicionais.
7. Se o chefe continuar vivo, ele executa sua ação.
8. A batalha termina por vitória, derrota ou limite de turnos (`MAX_TURNS`).
9. Os eventos são persistidos em `BattleEvent` e a progressão da jornada é atualizada.

### Modelos relevantes

- `Journey`: jornada.
- `Stage`: etapa ordenada de uma jornada, com pontuação máxima e conjunto de chefes possíveis.
- `GroupJourney`: execução de uma jornada por um grupo.
- `StageProgress`: estado de combate e resultado de uma etapa.
- `BattleEvent`: registro das ações e resultados ocorridos durante a batalha.

O motor também oferece `available_spells()`, `spell_cooldown_left()` e `journey_summary()` para consultar feitiços disponíveis, recargas e o resumo de desempenho.

## Validação e testes

Os scripts de validação estão em `tools/`. Consulte [`tools/README.md`](tools/README.md) antes de executá-los.

Exemplo:

```bash
bash tools/validar_fundacao.sh
bash tools/validar_crud.sh
```

Os gates foram projetados para validar a fundação e os CRUDs, incluindo verificações do Django, migrations, schema e chamadas HTTP de fumaça. O próprio `tools/README.md` informa que a suíte de testes Django ainda está vazia; portanto, a existência dos gates não substitui testes unitários e de integração das regras de negócio.

No front-end:

```bash
cd front-end
npm run lint
npm run build
```

## Documentação complementar

- [`back-end/API.md`](back-end/API.md) — contrato e endpoints da API.
- [`tools/README.md`](tools/README.md) — preparação do ambiente e gates de validação.
- [`ROADMAP.md`](ROADMAP.md) — acompanhamento de requisitos e evolução do projeto.

## Estado atual e próximos passos

O back-end já contém os principais modelos de domínio e um motor de batalha com progressão, efeitos de feitiços, registro de eventos e resumo de desempenho. A próxima prioridade é consolidar testes automatizados para as regras de negócio e completar a integração dos fluxos da interface com a API.

Em paralelo, é importante revisar as divergências documentais identificadas nos scripts de validação, formalizar o processo de migrations e garantir que os requisitos de autorização sejam testados por perfil de usuário.

Consulte o [ROADMAP.md](ROADMAP.md) para o detalhamento das tarefas e critérios de conclusão.
