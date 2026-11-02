# Jornada — Front-end

Interface da Jornada / Debuggers & Developers, com área do professor, aventureiros,
grupos, heróis, habilidades, chefes, perguntas e missões.

O front-end pode consumir a API Django diretamente ou simular seus endpoints com
MSW durante o desenvolvimento. Os componentes e serviços são os mesmos nos dois modos.

## Stack

| Tecnologia | Uso no projeto |
| --- | --- |
| Next.js 16 + React 19 | App Router, rotas, layouts e páginas |
| TypeScript 5 | Tipagem de componentes, contratos e serviços |
| Tailwind CSS 4 | Estilos e tokens visuais |
| Radix UI | Primitivos de interface, como diálogos e abas |
| React Hook Form 7 | Valores, erros e envio dos formulários |
| Zod 4 | Validação das respostas nas features integradas |
| Axios | Cliente HTTP, Bearer token e renovação de JWT |
| Zustand 5 | Estado compartilhado, sessão visual e dados demonstrativos |
| MSW 3 | Simulação de endpoints HTTP no navegador e nos testes |
| Lucide React + Sonner | Ícones e notificações |
| ESLint + tsx + Node Test Runner | Análise estática e testes HTTP |

As dependências completas estão em [package.json](./package.json).
O arquivo package-lock.json registra as versões instaladas.

## Instalação

É necessário ter Node.js 20.9 ou superior e npm. Os exemplos usam PowerShell,
partindo da raiz do repositório:

~~~powershell
cd front-end
npm ci
Copy-Item .env.example .env.local
~~~

Copie o arquivo de exemplo apenas na primeira configuração, para preservar uma
eventual .env.local existente. Esse arquivo é local e não deve ser versionado.

Se o PowerShell bloquear npm.ps1, use npm.cmd e npx.cmd no lugar de npm e npx.

## Executar com MSW, sem iniciar o back-end

Em front-end/.env.local, configure:

~~~dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_API_MOCKING=enabled
~~~

Dentro de front-end, execute:

~~~powershell
npm run dev
~~~

Abra [http://localhost:3000/login](http://localhost:3000/login) e use:

| Campo | Valor |
| --- | --- |
| Usuário | professor |
| Senha | jornada123 |

O MSW intercepta as chamadas do Axios para os endpoints implementados, mesmo que
o Django esteja desligado. A URL da API permanece configurada para que os mesmos
serviços funcionem nos dois modos. O Axios aguarda o worker iniciar antes de
enviar a primeira chamada.

O arquivo public/mockServiceWorker.js já está no projeto. Se estiver ausente
ou após atualizar o MSW, regenere-o com:

~~~powershell
npm run mocks:init
~~~

Os handlers mantêm estado em memória. Recarregar a página pode invalidar os tokens
demonstrativos e exigir um novo login. Requisições sem handler seguem para a rede;
o MSW não simula automaticamente qualquer endpoint.

## Executar conectado diretamente à API Django

Em front-end/.env.local, configure:

~~~dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_API_MOCKING=disabled
~~~

Inicie o Django em outro terminal. A partir da raiz do repositório, com o ambiente
virtual do back-end já configurado:

~~~powershell
cd back-end
.\.venv\Scripts\python.exe manage.py runserver
~~~

No terminal do front-end:

~~~powershell
npm run dev
~~~

Abra [http://localhost:3000/login](http://localhost:3000/login) e entre com uma
conta existente no Django. As credenciais de demonstração só funcionam na API
real se essa conta também estiver cadastrada nela.

O CORS atual do Django permite http://localhost:3000. Caso use outra origem,
como http://127.0.0.1:3000 ou outra porta, ajuste CORS_ALLOWED_ORIGINS em
back-end/config/settings.py.

Há migrations pendentes em relação aos modelos de users e groups, incluindo a
mudança de Student entre apps. Revise essa evolução de schema antes de atualizar
um banco existente. Veja [API-INTEGRATION.md](./API-INTEGRATION.md).

## Alternar entre os modos

| Configuração | MSW | API direta |
| --- | --- | --- |
| NEXT_PUBLIC_API_MOCKING | enabled | disabled |
| Django precisa estar iniciado? | Não, para os endpoints simulados | Sim |
| Credenciais | professor / jornada123 | Conta cadastrada no Django |
| NEXT_PUBLIC_API_BASE_URL | URL interceptada pelos handlers | Endereço da API Django |

Depois de alterar .env.local, pare e reinicie npm run dev. Faça logout e entre
novamente ao trocar de modo: tokens emitidos pelo MSW não são válidos no Django.
Se não conseguir encerrar uma sessão antiga pela interface, limpe o
sessionStorage da aplicação no navegador e recarregue a página.

Variáveis NEXT_PUBLIC_* são públicas e incorporadas durante o build; não devem
conter segredos. O MSW só é habilitado em desenvolvimento, mesmo que a variável
esteja como enabled em um build de produção.

## O que já está conectado

| Endpoint | Uso |
| --- | --- |
| POST /api/token/ | Login e obtenção de tokens |
| POST /api/token/refresh/ | Renovação do token de acesso |
| GET /api/users/ | Listagem autenticada na página /users |

Login e usuários usam HTTP nos dois modos. Alunos, grupos, habilidades, heróis,
chefes, perguntas e missões ainda usam dados locais de demonstração, pois seus
endpoints REST não estão registrados no back-end. Alterações nessas telas não são
persistidas na API, mesmo no modo de conexão direta.

Contas de usuário e registros de aventureiros são entidades distintas; /users
não substitui o cadastro de alunos.

## Organização do código

~~~text
front-end/
├── app/                    # Rotas, layouts e metadados do Next.js
├── features/               # Código agrupado por domínio
│   └── <feature>/
│       ├── components/     # Telas e formulários
│       ├── services/       # Chamadas HTTP da feature
│       ├── schemas/        # Validação com Zod
│       ├── types/          # Contratos pertencentes ao domínio
│       └── index.ts        # Exportações públicas da feature
├── components/             # Interface e layout compartilhados
├── lib/                    # Axios, configuração, tokens e utilidades
├── stores/                 # Estado compartilhado e seus tipos
├── hooks/                  # Comportamentos reutilizáveis
├── constants/              # Constantes compartilhadas
├── mocks/
│   ├── browser.ts          # Inicialização do MSW no navegador
│   ├── handlers/           # Endpoints simulados
│   └── fixtures/           # Respostas usadas pelos handlers
├── public/                 # Assets e mockServiceWorker.js
└── tests/                  # Testes HTTP e integração com Django
~~~

Cada feature cria apenas as pastas de que precisa. Os tipos ficam no domínio
responsável e são exportados pelo seu index.ts.

O fluxo das features integradas é:

~~~text
Formulário / página → serviço da feature → Axios → Django ou handler MSW
~~~

lib/api.ts centraliza endereço da API, timeout, envio de Authorization: Bearer
e renovação de JWT. Os tokens ficam em sessionStorage. Um 401 em uma chamada
protegida dispara uma tentativa de renovação e uma repetição da chamada; se a
sessão expirar, a interface volta ao login. As permissões devem ser verificadas
pelo Django, não apenas pela navegação do front-end.

## Comandos disponíveis

Execute dentro de front-end:

| Comando | Finalidade |
| --- | --- |
| npm run dev | Servidor de desenvolvimento |
| npm run build | Build de produção e verificação de tipos |
| npm start | Executa o build de produção, depois de npm run build |
| npm run lint | Análise estática com ESLint |
| npx tsc --noEmit | Verificação de tipos sem gerar arquivos |
| npm test | Testes HTTP com Axios e MSW, sem iniciar o Django |
| npm run mocks:init | Gera ou atualiza o service worker do MSW |

O teste opcional contra um Django real usa servidor e banco descartáveis.
Execute a partir da raiz do repositório:

~~~powershell
.\back-end\.venv\Scripts\python.exe front-end/tests/django-smoke.py
~~~

Esse teste cobre login, listagem protegida e renovação de JWT. Ele sincroniza os
modelos atuais de users e groups no banco temporário e não valida o histórico
de migrations nem altera back-end/db.sqlite3.

## Documentação complementar

- [Arquitetura do front-end](./architecture.md).
- [Integração HTTP, testes e próximos endpoints](./API-INTEGRATION.md).
- [Rotas disponíveis no back-end](../back-end/API.md).
