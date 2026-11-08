# API integration

The same feature service runs against Django or MSW:

```text
React Hook Form → feature service → Axios → Django
                                       ↳ MSW handler (development only)
```

MSW intercepts HTTP requests. Components never select fixtures directly for the
integrated endpoints. Zustand still owns the older demonstration domain state;
those screens have not been converted to HTTP persistence.

## Run with Django

Copy `.env.example` to `.env.local`, set these values, then restart Next:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_API_MOCKING=disabled
```

Run Django with `python manage.py runserver` in its configured virtual environment,
and run `npm run dev` in `front-end`. Use a user already registered in Django.
The current CORS setting permits `http://localhost:3000`; open the front at that
origin. If you use a different host or port, add that origin to Django's
`CORS_ALLOWED_ORIGINS`.

`NEXT_PUBLIC_*` values are public and are embedded at build time. Do not put
passwords or private keys in them. Production builds always disable MSW.

## Run without Django

Set `NEXT_PUBLIC_API_MOCKING=enabled` in `.env.local`, restart `npm run dev`, and
log in with `professor` / `jornada123`. The API URL remains the same. Axios waits
for the worker to start before dispatching a request. Handler state is in memory;
reloading can invalidate demo tokens and require another login.

The generated `public/mockServiceWorker.js` is committed with the application.
After upgrading MSW, regenerate it with `npm run mocks:init`. MSW 3 uses
`onUnhandledFrame`; unmatched requests bypass mocking in the browser and fail in
the HTTP test suite.

## Implemented contracts

| Endpoint | Owner | Behavior |
| --- | --- | --- |
| `POST /api/token/` | authentication | Credentials → access and refresh tokens |
| `POST /api/token/refresh/` | HTTP infrastructure | Renew access and retry once |
| `GET /api/users/` | users | Authenticated listing, displayed at `/users` |

`lib/api.ts` configures the base URL, timeout, authorization, a shared in-flight
refresh request, and session expiration notification. Authentication endpoints use
a separate client so a rejected login never starts a refresh loop. Tokens are
stored in `sessionStorage`; SSR never reads browser storage. Logout clears both
tokens and the existing UI session. A failed refresh ends that session.

This is browser-side bearer authentication, not an HttpOnly-cookie/BFF setup.
Next's UI guard is not an authorization boundary: Django must enforce permissions.
The current token endpoint returns no role or profile; the existing professor
label is UI metadata, not a verified claim. A `/me/` endpoint with explicit roles
is needed before introducing different access levels. Logout currently removes
local credentials; backend refresh-token revocation is not implemented.

Usernames are trimmed before login; passwords are sent unchanged.

Feature services return parsed data, rather than `AxiosResponse`, and validate
responses with Zod. `features/users/types/user.ts` matches Django's snake_case DTO.
There is no automatic conversion from `User` to `Student`: accounts and student
records are distinct concepts and the current API does not expose student IDs,
enrollment numbers, or membership contracts.

## Connecting the other screens

Students, groups, skills/spells, heroes, bosses, questions, and missions currently
have no registered REST endpoints. No hypothetical URLs were added as though
they were available. To connect each feature:

1. Define serializers, views, URLs, permissions, validation errors, and pagination
   in Django. Resolve the existing migration drift before deploying that schema.
2. Define the feature's DTO/schema and map it to its UI model where fields differ
   (for example numeric backend IDs versus current string demo IDs).
3. Add service methods for the real endpoints, then corresponding MSW handlers
   using the exact same HTTP contract.
4. Replace the feature's direct Zustand mutations and `fakeSave` calls with
   awaited service methods. Show success only after the request completes, show
   backend field errors through React Hook Form, and update/refetch the listing.
5. Remove that feature's seed initialization and simulated loading. Use actual
   pending/error states as demonstrated by `features/users/components/users-page.tsx`.

Complex mission operations also need server commands for stage transitions,
evaluations, hero assignment, battle turns, and results. Random boss selection,
grading, and battle rules must be enforced on the server before treating those
values as authoritative. The current API exposes no streaming/SSE/WebSocket
endpoint; ordinary services use request/response HTTP through Axios.

## Verification

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

The MSW suite exercises login, authentication failures, concurrent renewal,
bounded retries, and server errors using real Axios HTTP calls.

From the repository root, the optional live Django smoke test is:

```powershell
.\back-end\.venv\Scripts\python.exe front-end/tests/django-smoke.py
```

It launches a disposable Django test server/database and checks login, protected
users, and JWT renewal through Axios. It never modifies `back-end/db.sqlite3`.
Because current `users` and `groups` migrations do not match their models, this
test synchronizes those models directly in the disposable database. It validates
HTTP integration, not the deployability of existing migrations.

The read-only migration check still reports pending changes:

```powershell
# From back-end
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run --noinput
```

In particular, `Student` moved between apps and group fields changed. Those
migrations require review and a data-preserving plan for existing records; they
were not generated or applied as part of this frontend integration.
