# chatbot-frontend — web-interface simulator (BFF)

A **Next.js** web app that simulates a CRM/dashboard product with the generic assistant
embedded in it. It is the third service of the chatbot system and acts as a
**backend-for-frontend (BFF)**: the browser talks only to this app's `app/api/*` routes,
and those routes proxy to **`ca-ai-core`** with the backend bearer token injected
**server-side** — the token is never exposed to the browser.

```
browser ──▶ Next.js route handlers (app/api/*, BFF proxy) ──▶ ca-ai-core ──▶ ca-agentic
              server-side bearer injection (lib/server/backend.ts)
```

## Stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) / **React 18** / **TypeScript** |
| Styling | Tailwind CSS |
| Package manager | **npm** |
| Dev port | **5173** |

## Quick start

```bash
npm install
cp .env.example .env          # fill in values (see Configuration)
npm run dev                   # next dev on http://localhost:5173
```

The backing services (`ca-ai-core`, `ca-agentic`, Postgres/Redis/Keycloak) come up from
`../infra-components` — see that repo's `README.md` (`./infra-up.sh`, then the full-stack
compose). Point `BACKEND_API_BASE` at the running `ca-ai-core`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next dev server on :5173 |
| `npm run build` | Production build (`next build`) |
| `npm run start` | Serve the production build on :5173 |
| `npm run lint` | ESLint over `.js/.jsx/.ts/.tsx` |

## Configuration

Config lives in `.env` (git-ignored) with a committed `.env.example` mirror. Two classes of
variable:

- **Server-only (never sent to the browser)** — the backend base URL and bearer token used
  by the BFF proxy. `BACKEND_API_BASE` points at `ca-ai-core`; the backend token is read
  server-side in `lib/server/backend.ts` from a repo-root `.env`.
- **`NEXT_PUBLIC_*`** — the only browser-visible config (exposed at build time).

Everything is env-driven; no endpoint, credential, or tenant value is hardcoded.

## Layout

```
app/
├── layout.tsx, page.tsx        # shell + landing
├── globals.css
├── <mock-pages>/               # CRM/dashboard pages hosting the embedded assistant
│   (account, analytics, marketing, policy-management, prospecting, settings, …)
└── api/                        # BFF proxy route handlers to ca-ai-core
    ├── chat/                   # SSE chat relay (streams ca-ai-core's response)
    ├── sessions/               # session history
    ├── tickets/                # ticket views + board
    ├── tenants/                # tenant list for the tenant selector
    ├── backend-health/         # health probe passthrough
    └── env-config/             # browser-visible runtime config
components/assistant/           # embedded assistant UI (chat window, input, history)
context/AssistantContext.tsx    # assistant state incl. active-tenant selection
lib/
├── api.ts                      # browser → BFF client
└── server/backend.ts           # server-side backend base URL + bearer injection
```

## Multitenancy

A user may belong to several tenants. The assistant UI exposes a **tenant selector**
(backed by `app/api/tenants`), and the chosen tenant is sent to the backend on every request
via the `x-platform-id` header. The BFF forwards it to `ca-ai-core`, which authorizes the
selection against the caller's membership and isolates all data per tenant — the frontend
never sees another tenant's data.

## Deployment

Built as a container image via the repo `Dockerfile` (Node build → `next build`) and brought
up together with the backend services by the full-stack compose in `../infra-components`
(health-gated: the frontend waits for `ca-ai-core` to be ready). Build context is trimmed by
`.containerignore`.
