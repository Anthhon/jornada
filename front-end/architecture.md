# Front-end Architecture

## Implemented separation

- `app/`: Next.js routes and metadata.
- `features/*/components/`: screens and independently mounted forms.
- `features/*/types/`: feature-specific contracts.
- `features/*/constants/`: feature-specific options and labels.
- Domain contracts stay in `features/<owner>/types/` and are exported through that feature's `index.ts`. There is no global domain `types/` folder.
- `constants/`: shared evaluation criteria.
- `stores/`: Zustand demo state, mutations, and store-specific types.
- `features/*/services/`: typed Axios calls for endpoints implemented in Django.
- `features/*/schemas/`: Zod validation at API boundaries.
- `mocks/handlers/`: MSW HTTP handlers matching existing backend routes.
- `mocks/fixtures/`: HTTP mock responses; other fixtures and simulated latency still support domain screens without endpoints.
- `hooks/`: shared loading behavior and React Hook Form integration.
- `lib/`: date formatting, business rules, and infrastructure.

Forms use React Hook Form for values, errors, and submission status. The shared
`useValidatedForm` hook maps existing cross-field domain validation to RHF root
errors. Dialog visibility, selection, animation, and search remain local UI state.
Authentication, the current-user profile and the restricted Admin account list
connect to Django. Other domain screens still use
local demonstration state while integration with their backend endpoints is pending.
See [API integration](./API-INTEGRATION.md) for configuration, tests, and remaining work.

## Sidebar

All interface icons come from `components/icons/rpg-icons.tsx`: inline SVGs on
a 20×20 pixel grid, with the golden apple's ink, gold, shade and highlight palette.
They accept SVG props, refs and Tailwind sizing/animation classes. `Crest` wraps
the shared golden apple; notifications and card ornaments use the same family.
Empty resource gems use grayscale/opacity instead of color overrides so their
state remains visible with the fixed sprite palette. Decorative icons are hidden
from assistive technology; standalone icons can receive an `aria-label`.

`components/layout/teacher-shell.tsx` composes the existing desktop sidebar and
mobile sheet. Sections, links, badge keys and role visibility rules live in
`sidebar-config.ts`; `sidebar-navigation.tsx` renders semantic lists, active
routes and collapsed tooltips. Only section labels use the pixel font.

The user card opens `sidebar-user-menu.tsx` (Profile, Theme, Exit). The menu
supports arrow keys, Home/End, Escape, Tab and outside clicks. Ctrl+B collapses
the sidebar (or toggles the mobile sheet), except while typing in editable fields.
Themes are stored in `localStorage` under `jornada-theme`.

`TeacherShell` accepts optional `counts={{ agenda: 2, missions: 5 }}`. When omitted,
badges count unfinished incursions for Agenda and all incursions for Missions;
pass `counts={{}}` to hide them. `/schedule` embeds the agenda inside this shell;
the public `/agenda` stays available to visitors.

Professors are the administrators in this project. The sidebar and direct visits
to `/users` use `role: "teacher"` returned by `/api/me/`; students do not get the
Admin section. There is no separate granular permission or superuser requirement.
Django remains responsible for authorization on the API itself.

This project uses **Feature-Sliced Design (FSD)** adapted for the **Next.js App Router**. It is domain-oriented: code is grouped by the capability it delivers rather than by generic technical folders.

The App Router owns URL routing and route-level composition. Feature folders own the domain UI, types, validation, state, API access, and business rules for that capability.

## Principles

- Keep route files in `app/` small. A route composes a screen and defines Next.js metadata, not domain logic.
- Group domain code in `features/<feature-name>/`.
- Use English for folder names, routes, symbols, component names, types, and documentation.
- Keep reusable, domain-agnostic visual primitives in the global `components/ui/` folder.
- A feature may import from global infrastructure. Keep runtime infrastructure independent of feature components; domain utilities and fixtures may import feature contracts with `import type`.
- Prefer Server Components. Add `"use client"` only to the smallest interactive component that needs state, effects, event handlers, or browser APIs.
- Use path aliases (`@/`) for imports.

## Target Structure

```text
front-end/
├── app/                              # Next.js App Router: URLs and route composition
│   ├── (public)/
│   │   ├── page.tsx                   # /
│   │   ├── heroes/page.tsx            # /heroes
│   │   └── bosses/page.tsx            # /bosses
│   ├── (teacher)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx         # /dashboard
│   │   ├── students/page.tsx          # /students
│   │   ├── journeys/page.tsx          # /journeys
│   │   ├── groups/page.tsx            # /groups
│   │   └── assessments/page.tsx       # /assessments
│   ├── login/page.tsx
│   ├── layout.tsx                     # Root layout, fonts and global providers
│   ├── globals.css                    # Global styles and design tokens only
│   ├── not-found.tsx
│   └── error.tsx
├── features/                          # Domain capabilities (Feature-Sliced Design)
│   ├── authentication/
│   │   ├── components/
│   │   │   └── login-form.tsx
│   │   ├── schemas/
│   │   │   └── login.schema.ts
│   │   ├── types/
│   │   │   └── authentication.types.ts
│   │   ├── services/
│   │   │   └── authentication.service.ts
│   │   └── index.ts
│   ├── students/
│   │   ├── components/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── services/
│   │   └── index.ts
│   ├── journeys/
│   ├── groups/
│   ├── heroes/
│   ├── bosses/
│   ├── assessments/
│   └── public-agenda/
├── components/                        # Global components only
│   ├── ui/                            # Reusable presentational primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── table.tsx
│   └── layout/                        # Shared shell components
│       ├── public-header.tsx
│       ├── teacher-sidebar.tsx
│       └── page-container.tsx
├── lib/                               # Global utilities and infrastructure
│   ├── api-client.ts
│   ├── env.ts
│   ├── utils.ts
│   └── constants.ts
├── types/                             # Cross-domain types only
│   ├── api.types.ts
│   └── common.types.ts
├── public/                            # Static assets
└── architecture.md
```

## Route and Feature Responsibilities

`app/` is the routing layer, not a second place for feature implementations. For example, `app/(teacher)/students/page.tsx` should only assemble the Students feature and set metadata:

```tsx
import { StudentsPage } from "@/features/students";

export default function Page() {
  return <StudentsPage />;
}
```

If a page needs a route parameter, read it in the App Router page and pass the value to the feature as a typed prop.

```text
app/(teacher)/students/[studentId]/page.tsx
  -> features/students/components/student-details-page.tsx
```

Route groups such as `(public)` and `(teacher)` organize layouts without changing the public URL. Avoid adding a `features` or `modules` segment to URLs; feature names are an implementation concern.

## Feature Contract

Every feature starts small and expands only when needed:

```text
features/students/
├── components/        # Smart, feature-specific components
├── schemas/           # Runtime validation and form schemas
├── types/             # Types exclusive to Students
├── services/          # Feature API calls, mappers and server-side data access
├── hooks/             # Feature-only hooks, when necessary
├── actions/           # Next.js Server Actions, when necessary
└── index.ts           # Public API of the feature
```

Not every feature needs every folder. Do not create empty folders.

### `components/`

Feature components are **smart components**: they coordinate domain data, feature state, form behavior, and interactions. Keep them focused on their feature; for example, `student-table.tsx`, `student-form.tsx`, and `student-details-page.tsx` belong to `features/students/components/`.

Pure, broadly reusable primitives do **not** belong here. Put generic buttons, inputs, dialogs, tables, badges, empty states, and loading placeholders in `components/ui/`.

### `schemas/`

Store runtime schemas here (for example, Zod schemas) plus types inferred from them when the type is feature-local. Use schemas at API boundaries and in forms. The schema is the source of truth for validation.

### `types/`

Use this folder for types that only make sense inside the feature, such as `Student`, `CreateStudentInput`, or `StudentListFilters`. Place genuinely shared contracts in the root `types/` folder.

### `services/`, `actions/`, and `hooks/`

- `services/`: API requests, DTO-to-domain mapping, and data functions.
- `actions/`: mutations implemented as Next.js Server Actions.
- `hooks/`: client-side behavior specific to the feature.

Keep HTTP and data transformation out of route pages and visual UI primitives.

## Imports and Public APIs

Features expose only intentional exports through `index.ts`:

```ts
// features/students/index.ts
export { StudentsPage } from "./components/students-page";
export type { Student } from "./types/student.types";
```

Consumers should import from the feature root:

```ts
import { StudentsPage, type Student } from "@/features/students";
```

Do not import another feature's internal files (for example, `@/features/students/services/...`). If two features need the same domain behavior, extract the truly shared part to `lib/`, `types/`, or a dedicated shared feature only after the reuse is established.

## Migration from `.lovable_exports`

The `.lovable_exports` directory is a source of UI references and mock flows. During migration:

1. Map each view to an App Router URL and one primary feature.
2. Move domain-specific logic into the matching feature; do not copy source files directly into `app/`.
3. Replace mock data with typed service interfaces first, then connect them to the backend.
4. Move generic visual elements into `components/ui/` only when they are reused across domains.
5. Preserve the visual behavior while replacing React-router assumptions with Next.js `Link`, `useRouter`, layouts, loading states, and error boundaries.

## Naming

- Folders and files: `kebab-case` (`student-form.tsx`).
- React components: `PascalCase` (`StudentForm`).
- Functions, variables, hooks, and types: English (`useStudentFilters`, `CreateStudentInput`).
- Routes: plural English nouns where applicable (`/students`, `/journeys`, `/groups`).
- Avoid generic names such as `helpers`, `common`, `misc`, and `utils` inside features; name code by its domain purpose.

## Initial Feature Mapping

| Route area | Primary feature |
| --- | --- |
| Login and session | `authentication` |
| Teacher student management | `students` |
| Groups and membership | `groups` |
| Journeys and schedules | `journeys` or `public-agenda` |
| Hero catalogue | `heroes` |
| Boss catalogue | `bosses` |
| Assessments and grades | `assessments` |

This structure keeps the Next.js routing convention intact while preserving a clear domain boundary for the forthcoming migration.
