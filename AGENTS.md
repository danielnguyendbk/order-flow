# Project Map — Order Flow

Use this file as the first-stop repository map. Read it before scanning the tree, and update it whenever the structure or architecture changes.

## Repository layout

The repository currently contains two main workspaces: `backend/` and `frontend/`.

```text
order-flow/
├── AGENTS.md                         # This persistent project map
├── frontend/                         # Next.js Admin Web Application
│   ├── src/
│   │   ├── app/                      # App Router (pages: dashboard, orders, payments, etc.)
│   │   ├── components/               # Reusable UI components
│   │   └── lib/                      # Utility functions and data models
│   └── public/                       # Static assets
└── backend/
    ├── README.md                     # Short workspace overview
    ├── docker-compose.yml            # Local PostgreSQL 16 service
    ├── docs/
    │   ├── api-contract.md           # Planned HTTP route inventory
    │   └── openapi.yaml              # Importable Postman/OpenAPI contract for all routes
    ├── apps/
    │   ├── api/                      # HTTP API service
    │   │   └── src/
    │   │       ├── app.ts            # Fastify application factory (`createApp`)
    │   │       ├── config/           # Runtime/application configuration
    │   │       ├── jobs/             # Background/scheduled jobs
    │   │       ├── middleware/       # HTTP middleware
    │   │       ├── routes/           # Route registration
    │   │       └── modules/          # Domain modules (listed below); auth is implemented
    │   ├── telegram-bot/             # Telegram bot service
    │   │   └── src/
    │   │       ├── bot.ts            # Bot factory placeholder (`createBot`)
    │   │       ├── commands/          # Bot commands
    │   │       ├── handlers/          # Update/event handlers
    │   │       ├── keyboards/         # Telegram keyboard definitions
    │   │       ├── middleware/        # Bot middleware
    │   │       ├── scenes/            # Multi-step conversation flows
    │   │       └── services/          # Bot-facing integrations/services
    │   └── admin-web/                # (Deprecated placeholder)
    ├── packages/
    │   ├── shared-types/              # Types shared across applications
    │   ├── shared-constants/          # Constants shared across applications
    │   └── eslint-config/             # Shared ESLint configuration
    └── prisma/
        ├── schema.prisma              # PostgreSQL Prisma schema
        └── seed.ts                    # Database seed entry point
```

## API domain modules

All module directories are under `backend/apps/api/src/modules/`:

- `auth`: authentication and authorization
- `employees`: employee management
- `menu`: menu/catalog management
- `orders`: order lifecycle
- `payments`: payment handling
- `sepay`: SePay integration
- `reconciliations`: payment/order reconciliation
- `barista`: barista-facing workflow
- `notifications`: notification delivery
- `reports`: reporting
- `audit`: audit trail

## Current implementation state

- The API is an Express app with order lifecycle, barista, admin, payment and order-status-history modules. Its routes are mounted beneath `/api/v1`.
- `backend/apps/telegram-bot` is a TypeScript/Telegraf workspace with its own `package.json`, lockfile, environment template, Vitest configuration and notification-worker skeleton.
- The Telegram Bot authenticates each interaction through `POST /api/v1/telegram/session`, stores only an ephemeral Bot session, and renders role-specific menus.
- Service staff can create a backend-owned draft order through Telegram: category → item → quantity → note → review; they can add, edit, delete, or cancel draft items. Price and total are always supplied by the API.
- The Bot/API draft-order contract is documented in `backend/apps/telegram-bot/TELEGRAM_SESSION_CONTRACT.md`; backend integration routes still need to conform to that contract before a live end-to-end run.
- Bot unit tests cover authentication, role menus, draft creation, active-item checks, edit/delete, stale callbacks, duplicate callbacks, ownership, and non-editable orders.

- `apps/api` is a runnable Express service; the auth module implements admin JWT sessions and verified Telegram Web App sessions. Session state is held by a bounded process-local memory cache in `auth-session.store.ts`.
- Employee and menu modules are developed on dedicated feature branches; shared packages remain placeholders kept by `.gitkeep` files.
- `schema.prisma` configures Prisma Client and PostgreSQL through pooled `DATABASE_URL` plus migration `DIRECT_URL`, but defines no models yet.
- `seed.ts` has no seed data yet.
- `docker-compose.yml` runs PostgreSQL 16 Alpine on port `5432`, with database/user/password `order_flow` and persistent volume `postgres_data`.
- API dependencies, TypeScript config, auth tests, and a root environment example exist; there is still no root workspace manifest or CI configuration.

## Progress log — 2026-08-04

- `feat-tele` was pushed at `ad2991d` (`feat(telegram): add service staff draft order flow`).
- `feat-tele` was merged into `dev` and pushed at `bc844e8`; `dev` is the current checked-out branch and tracks `origin/dev`.
- Verified after the merge:
  - `cd backend && npm.cmd run check:bot`
  - `cd backend && npm.cmd run test:bot` — 14 tests passed.
- Next Telegram dependencies: implement/align the real backend Telegram-session, menu and draft-order endpoints; then add Cash/QR, barista queue/Ready, and real notification outbox integration.

## Navigation shortcuts

- API work: start at `backend/apps/api/src/` and the relevant `modules/<domain>/` folder.
- Telegram work: start at `backend/apps/telegram-bot/src/`.
- Admin UI work: start at `backend/apps/admin-web/src/`.
- Database work: start at `backend/prisma/schema.prisma` and `backend/prisma/seed.ts`.
- Cross-application contracts/constants: use `backend/packages/shared-types/` and `backend/packages/shared-constants/`.
- Local database infrastructure: use `backend/docker-compose.yml`.
- Planned API routes: read `backend/docs/api-contract.md` before implementing handlers.
- Postman/API generation: import `backend/docs/openapi.yaml`; keep it synchronized with route behavior and `api-contract.md`.
- Auth session storage: use `backend/apps/api/src/modules/auth/auth-session.store.ts`; restart clears sessions and multi-instance deployments require a shared replacement such as Redis.
- Supabase browser access: use `backend/apps/admin-web/src/services/supabase.ts`; its public values live in the root `.env.local`.
- Environment variable names/templates: use the root `.env.example`; never commit `.env.local`.

## Maintenance rule

When adding, removing, or repurposing a top-level app, package, domain module, or infrastructure component, update this map in the same change.
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
