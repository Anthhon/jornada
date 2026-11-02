# API da Jornada

Este documento lista as rotas que o back-end disponibiliza atualmente.

## Endereço local

Com o servidor iniciado por `python manage.py runserver`, a API fica em:

```text
http://127.0.0.1:8000
```

Todos os exemplos abaixo usam esse endereço. No front-end, guarde-o em uma
variável de ambiente quando a integração começar.

## Autenticação

As rotas protegidas usam JWT. Primeiro faça login em `POST /api/token/` e
guarde o valor de `access`. Nas chamadas protegidas, envie-o no cabeçalho:

```http
Authorization: Bearer SEU_ACCESS_TOKEN
```

## Rotas

### Login

`POST /api/token/`

Gera os tokens de acesso para um usuário já cadastrado no Django.

Corpo JSON:

```json
{
  "username": "nome_do_usuario",
  "password": "senha_do_usuario"
}
```

Resposta de sucesso (`200 OK`):

```json
{
  "refresh": "token-de-longa-duracao",
  "access": "token-de-curta-duracao"
}
```

Se as credenciais estiverem incorretas, a resposta é `401 Unauthorized`.

### Renovar token de acesso

`POST /api/token/refresh/`

Use esta rota quando o token `access` expirar. O `refresh` dura mais tempo.

Corpo JSON:

```json
{
  "refresh": "token-de-longa-duracao"
}
```

Resposta de sucesso (`200 OK`):

```json
{
  "access": "novo-token-de-curta-duracao"
}
```

### Listar usuários

`GET /api/users/`

Retorna todos os usuários, do mais recentemente criado para o mais antigo.
Esta rota exige autenticação JWT.

Cabeçalho necessário:

```http
Authorization: Bearer SEU_ACCESS_TOKEN
```

Resposta de sucesso (`200 OK`):

```json
[
  {
    "id": 1,
    "username": "ana",
    "email": "ana@exemplo.com",
    "first_name": "Ana",
    "last_name": "Silva",
    "date_joined": "2026-11-02T12:00:00Z"
  }
]
```

Sem token válido, a resposta é `401 Unauthorized`.

## Painel administrativo

`GET /admin/`

Esta não é uma rota REST para o front-end. É a interface administrativa padrão
do Django, usada no navegador por administradores. Para criar um usuário admin:

```powershell
python manage.py createsuperuser
```

## Exemplo no front-end

```ts
const resposta = await fetch("http://127.0.0.1:8000/api/users/", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})

const usuarios = await resposta.json()
```

## Onde estas rotas ficam no código

| Rota | Arquivo que a registra | Implementação |
| --- | --- | --- |
| `/api/token/` | `config/urls.py` | `TokenObtainPairView` (Simple JWT) |
| `/api/token/refresh/` | `config/urls.py` | `TokenRefreshView` (Simple JWT) |
| `/api/users/` | `apps/users/urls.py` | `apps/users/views.py` (`user_list`) |
| `/admin/` | `config/urls.py` | Django Admin |

Apps como `heroes`, `spells`, `bosses` e `journeys` ainda não têm rotas
registradas; por isso ainda não possuem endpoints consumíveis.
