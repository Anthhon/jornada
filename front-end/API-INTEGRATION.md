# Integração com a API

O mesmo serviço de uma feature pode consumir Django ou respostas simuladas pelo MSW:

```text
React Hook Form → serviço da feature → Axios → Django
                                           ↳ handler MSW (somente desenvolvimento)
```

O MSW intercepta requisições HTTP. Nos endpoints integrados, os componentes não leem os dados simulados diretamente. Os cadastros usam serviços por feature e o Zustand funciona como cache da interface. A execução das incursões continua sendo a demonstração local anterior.

## Executar com Django

Copie `.env.example` para `.env.local`, configure os valores abaixo e reinicie o Next:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_API_MOCKING=disabled
```

Essa configuração vale para os contratos já compatíveis com o Django. Os endpoints provisórios de cadastro e agenda descritos abaixo ainda precisam ser adaptados antes da integração real.

Execute `python manage.py runserver` no ambiente virtual do Django e `npm run dev` em `front-end`. Use um usuário cadastrado no Django. A configuração atual de CORS permite `http://localhost:3000`; abra o frontend nessa origem. Para outro host ou porta, ajuste `CORS_ALLOWED_ORIGINS` no backend antes de usar essa origem.

Os valores `NEXT_PUBLIC_*` são públicos e incorporados durante a compilação. Não coloque senhas ou chaves privadas neles. Builds de produção desativam o MSW.

## Executar sem Django

Defina `NEXT_PUBLIC_API_MOCKING=enabled` em `.env.local`, reinicie `npm run dev` e entre com `professor` / `jornada123`. A URL-base da API permanece igual. O Axios espera a inicialização do worker antes de enviar requisições.

Os catálogos simulados e a agenda usam chaves versionadas no `localStorage`; o registro de tokens usa `sessionStorage`. Os dados ficam no navegador: não representam armazenamento compartilhado nem autorização no servidor.

O arquivo gerado `public/mockServiceWorker.js` é versionado com a aplicação. Após atualizar o MSW, gere-o novamente com `npm run mocks:init`. O MSW 3 usa `onUnhandledFrame`; requisições sem handler seguem para a rede no navegador e provocam falha na suíte HTTP.

## Contratos já implementados

| Endpoint | Responsabilidade | Comportamento |
| --- | --- | --- |
| `POST /api/token/` | Autenticação | Credenciais → tokens de acesso e renovação |
| `POST /api/token/refresh/` | Infraestrutura HTTP | Renova o acesso e repete a requisição uma vez |
| `GET /api/me/` | Autenticação | Nome e perfil do usuário autenticado |
| `GET /api/users/` | Usuários | Consulta administrativa disponível ao professor |

`lib/api.ts` configura URL-base, timeout, autorização, renovação compartilhada entre requisições simultâneas e notificação de sessão expirada. A autenticação usa um cliente separado para que uma tentativa de login rejeitada não inicie renovação de token. Os tokens ficam em `sessionStorage`; a renderização no servidor não acessa o armazenamento do navegador. Sair limpa os tokens e a sessão da interface; falha na renovação também encerra a sessão.

A autenticação usa Bearer no navegador; não há cookies HttpOnly nem uma camada BFF. A proteção de navegação do Next não substitui autorização: o Django deve aplicar as permissões. O endpoint de token não retorna perfil ou papel; essas informações estão em `/api/me/`. A sidebar atual usa os dados da sessão local. No projeto, o perfil administrativo é `role: "teacher"`, sem exigir uma flag adicional ou superusuário. A revogação do token de renovação no backend ainda não está implementada.

No modo simulado, tokens emitidos são registrados em `sessionStorage`, na chave `jornada-mock-tokens`, e continuam válidos após recarga da página ou HMR. Tokens desconhecidos recebem 401 nos handlers de autenticação. O nome de usuário tem espaços externos removidos; a senha é enviada sem alteração.

Os serviços retornam dados validados com Zod, não `AxiosResponse`. `features/users/types/user.ts` acompanha o DTO em snake_case do Django. Não existe conversão automática de `User` para `Student`: contas e alunos são entidades distintas; a resposta de `/api/users/` não fornece automaticamente matrícula e vínculos de equipe.

## Integração dos cadastros

Aventureiros, grupos, habilidades, heróis, chefes e perguntas usam chamadas Axios explícitas em seus respectivos arquivos `features/*/services/*-service.ts`. Cada serviço valida entrada e resposta com o schema Zod da feature. Apenas a configuração do cliente Axios é compartilhada em `lib/api.ts`; não há fábrica genérica de endpoints.

Os contratos provisórios usam `/mock-catalog/{resource}/`: GET da coleção, PUT do item para criar ou atualizar e DELETE do item. A agenda usa GET/PUT em `/mock-agenda/`. Esses contratos representam as necessidades atuais da interface; não são os contratos reais dos serializers Django.

Desativar o MSW não basta para conectar esses cadastros. Quando as lacunas abaixo forem resolvidas, adapte os serviços e mapeamentos aos DTOs e métodos reais, incluindo a separação entre POST de criação e atualização. A execução das incursões fica fora desta integração.

### Lacunas confirmadas do backend para a integração futura

Esta seção registra somente ausências ou divergências verificadas; não solicita reescrever CRUDs existentes. Nenhum arquivo do backend ou banco foi alterado nesta integração.

| Domínio | Ausência ou divergência | Evidência e encaminhamento |
| --- | --- | --- |
| Alunos | Não há matrícula no serializer; o frontend exige matrícula única. O cadastro em lote recebe apenas nomes e grupo. | `back-end/apps/users/serializers.py`: definir representação, unicidade, compatibilidade com registros antigos e entrada em lote. IDs Django são numéricos; IDs simulados são strings. Mapear sem enviar IDs fictícios na criação real. |
| Exclusão de aluno | Excluir remove o registro e o vínculo; PATCH de `is_active` é outra operação e também altera o acesso da conta vinculada. | `users/views.py` e `users/serializers.py`: confirmar exclusão ou desativação antes de mapear a ação da interface. |
| Grupos | Falta letra no serializer. Pontos extras do backend são inteiros por grupo; a interface mantém bônus decimais individuais. | `groups/serializers.py`: definir escopo de unicidade da letra e contrato dos bônus individuais. Não enviar `memberIds` como campo Django; vínculos usam a operação existente de definição de integrantes. |
| Habilidades | Custo em PR, dados, sinalização de revisão e suporte descritivo não correspondem a `spell_type/base_value/max_value/cooldown_turns`. | `spells/serializers.py` e `spells/models.py`: definir esses campos e sua semântica. Não tratar recarga como custo em PR nem valor base como rolagem de dados. |
| Heróis | A interface mantém um catálogo reutilizável de classes, com função, descrição, passiva, atributos e habilidades. O Hero do backend representa combatente por grupo/jornada e tem HP, escudo e bônus. | `heroes/models.py` e `heroes/serializers.py`: definir catálogo de classes separado da atribuição, com campos e vínculos de habilidades. Não inventar IDs de grupo ou jornada para cadastrar classes. |
| Chefes | Não há campo/contrato de imagem, especialidade nem gatilhos e efeitos descritivos por habilidade. O backend usa HP máximo, ativação e vínculos de feitiços. | `bosses/serializers.py`: definir armazenamento/acesso de imagens e contrato de habilidades punitivas. A interface aceita caminho local ou URL HTTPS, sem simular upload real. Mapear `hp/active` para os campos confirmados. |
| Perguntas | A interface permite linguagem opcional e alternativas editáveis juntas. O backend exige chefe e grava alternativas separadamente por choices. | `bosses/models.py` e `bosses/serializers.py`: definir vínculo com linguagem/chefe e gravação atômica ou compensação de falhas parciais. Gabarito oculto não deve ser interpretado como resposta incorreta. |
| Agenda | Não há contrato real verificado para a matriz editável de três colunas e sua consulta pública. | `/mock-agenda/` existe somente no MSW. Definir persistência, escrita autorizada, campos públicos e tratamento de conflitos/versões. Nomes, letras e alunos devem vir dos cadastros de referência. |
| Migrações | O histórico/schema SQLite local diverge do modelo atual de Student, movido entre apps. | As migrações históricas recuperadas são candidatas a baseline local. Revisar transição que preserve dados, estado dos bancos de implantação e ambiente Django fixado antes de integrar dados reais. |

Os catálogos simulados validam dados e vínculos, rejeitam tokens desconhecidos e restringem o gabarito à sessão simulada do professor. Isso serve ao desenvolvimento e não substitui permissões do servidor. Mudanças futuras no backend exigem comunicação prévia ao usuário e uma branch nova. Commits dependem de pedido explícito.

Antes de conectar uma feature aos endpoints reais:

1. Conferir serializers, views, URLs, permissões, erros e paginação diante dos requisitos da interface. Validar migrações antes de implantar.
2. Definir o DTO/schema e o mapeamento para o modelo de interface onde houver diferenças.
3. Adaptar as chamadas explícitas do serviço e fazer o MSW reproduzir o mesmo contrato HTTP.
4. Manter gravações aguardadas, erros visíveis no formulário e atualização da listagem após a resposta.
5. Preservar estados de carregamento, erro e vazio, sem retornar aos dados fixos como substituto silencioso de falhas.

Operações de incursão também precisam de comandos no servidor para transições de etapa, avaliações, atribuição de herói, turnos e resultados. Sorteio de chefe, notas e combate devem ser aplicados pelo servidor antes de serem considerados definitivos. Não há endpoint de streaming, SSE ou WebSocket verificado; os serviços usam requisição e resposta HTTP pelo Axios.

## Verificação

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

A suíte MSW testa login, falhas de autenticação, renovação concorrente, tentativas limitadas e erros do servidor usando chamadas HTTP pelo Axios. Também cobre CRUD dos seis catálogos, validação Zod, vínculos, persistência simulada, falhas de armazenamento e sincronização da agenda pública.

Na raiz do repositório, o teste opcional com Django é:

```powershell
.\back-end\.venv\Scripts\python.exe front-end/tests/django-smoke.py
```

Ele inicia servidor e banco Django descartáveis e verifica login, usuários protegidos e renovação JWT pelo Axios, sem modificar `back-end/db.sqlite3`. Como as migrações atuais de users/groups divergem dos modelos, o teste sincroniza esses modelos diretamente no banco descartável. Ele valida a integração HTTP, não a aplicação das migrações em um banco existente.

A verificação de migrações continua apontando alterações pendentes:

```powershell
# A partir de back-end
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run --noinput
```

A mudança de Student entre apps e os campos de grupo exigem revisão e um plano de preservação dos dados. Nenhuma migração foi gerada ou aplicada nesta integração de frontend.
