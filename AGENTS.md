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
    │   └── api-contract.md           # Planned HTTP route inventory
    ├── apps/
    │   ├── api/                      # HTTP API service
    │   │   └── src/
    │   │       ├── app.ts            # API factory placeholder (`createApp`)
    │   │       ├── config/           # Runtime/application configuration
    │   │       ├── jobs/             # Background/scheduled jobs
    │   │       ├── middleware/       # HTTP middleware
    │   │       ├── routes/           # Route registration
    │   │       └── modules/          # Domain modules (listed below)
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

- The API is an Express app with Telegram employee-session authentication, order lifecycle, barista, admin, payment and order-status-history modules. Its routes are mounted beneath `/api/v1`.
- `backend/apps/telegram-bot` is a TypeScript/Telegraf workspace with its own `package.json`, lockfile, environment template, Vitest configuration and notification-worker skeleton.
- The Telegram Bot authenticates each interaction through `POST /api/v1/telegram/session`, stores only an ephemeral Bot session, and renders role-specific menus.
- Service staff can complete an API-owned Telegram order flow: category → item → quantity → note → review → CASH or QR. They can edit/cancel drafts, list their orders and refresh payment/fulfillment status. Price, total, ownership and payment transitions are always supplied or enforced by the API.
- Telegram session, menu, draft-order, CASH/QR and order-status routes are implemented end-to-end according to `backend/apps/telegram-bot/TELEGRAM_SESSION_CONTRACT.md`.
- The Prisma schema maps the existing users, menu, orders, payments and status-history SQL tables; the full API TypeScript build succeeds.
- Bot tests cover authentication, role menus, Bot-to-API HTTP boundaries, complete CASH/QR flows, tracking, active-item checks, edit/delete, stale callbacks, duplicate callbacks, ownership, and non-editable orders.

## Progress log — 2026-08-05

- `feat-tele` completes KHOA-003 with authenticated menu/draft APIs, transactional CASH/QR payment selection, mine/status endpoints and Telegram tracking/refresh handlers.
- Full HTTP E2E tests cover category → item → quantity → note → review → CASH/QR → status; database integration tests remain opt-in through a disposable `TEST_DATABASE_URL`.
- Verified for KHOA-003: Prisma generate/validate, full API check/build, 20 API tests, Bot check/build and 41 Bot tests all pass.
- `feat-tele` implements `POST /api/v1/telegram/session` against `public.users`, including internal-secret authentication, active-state enforcement, role mapping and Bot response validation.
- Verified locally for KHOA-002: API auth checks and 11 tests pass; Bot type-check/build and 32 tests pass.

## Progress log — 2026-08-04

- `feat-tele` was pushed at `ad2991d` (`feat(telegram): add service staff draft order flow`).
- `feat-tele` was merged into `dev` and pushed at `bc844e8` at that point in the project history.
- Verified after the merge:
  - `cd backend && npm.cmd run check:bot`
  - `cd backend && npm.cmd run test:bot` — 14 tests passed.
- Next Telegram dependencies: add barista queue/Ready, SePay webhook reconciliation, and real notification outbox integration.

## Navigation shortcuts

- API work: start at `backend/apps/api/src/` and the relevant `modules/<domain>/` folder.
- Telegram work: start at `backend/apps/telegram-bot/src/`.
- Admin UI work: start at `backend/apps/admin-web/src/`.
- Database work: start at `backend/prisma/schema.prisma` and `backend/prisma/seed.ts`.
- Cross-application contracts/constants: use `backend/packages/shared-types/` and `backend/packages/shared-constants/`.
- Local database infrastructure: use `backend/docker-compose.yml`.
- Planned API routes: read `backend/docs/api-contract.md` before implementing handlers.
- Supabase browser access: use `backend/apps/admin-web/src/services/supabase.ts`; its public values live in the root `.env.local`.
- Environment variable names/templates: use the root `.env.example`; never commit `.env.local`.

## Maintenance rule

When adding, removing, or repurposing a top-level app, package, domain module, or infrastructure component, update this map in the same change.
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
