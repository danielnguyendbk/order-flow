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
        └── seed.ts                    # Idempotent initial OWNER seed entry point
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
- Baristas can complete the Telegram preparation flow: queue → detail → atomic claim → PREPARING → READY → history. Queue eligibility, active role, assignment ownership and state transitions are enforced by the API.
- Telegram session, menu, draft-order, CASH/QR and order-status routes are implemented end-to-end according to `backend/apps/telegram-bot/TELEGRAM_SESSION_CONTRACT.md`.
- The Prisma schema maps the existing users, menu, orders, payments and status-history SQL tables; the full API TypeScript build succeeds.
- Bot tests cover authentication, role menus, Bot-to-API HTTP boundaries, complete CASH/QR flows, tracking, active-item checks, edit/delete, stale callbacks, duplicate callbacks, ownership, and non-editable orders.
- Inline draft keyboards use compact revisioned callback data from `backend/apps/telegram-bot/src/callbacks/`; stale keyboards are cleared and refreshed from backend state, and duplicate mutations are guarded in both the Bot and API.
- Barista API transitions use conditional updates plus serializable transactions so assignment/status and history commit together; service-staff delivery is separately authenticated and creator-owned.
- Notification delivery uses a PostgreSQL transactional outbox and a BullMQ/Redis Telegram worker. ORDER_PAID and ORDER_READY target the order creator; PAYMENT_REVIEW targets active owners, with persistent retry state and an internal requeue CLI.
- Telegram development commands run through `apps/telegram-bot/src/dev-runner.ts`, which deliberately lets the local `.env` override stale shell credentials; production commands continue to use deployment-provided environment variables.

## Progress log — 2026-08-06

- `feat-tele` implements KHOA-006 notification outbox records, idempotent event keys, BullMQ dispatch, Telegram retry/failure persistence, Redis Docker infrastructure, and an internal failed-notification requeue command.
- Fixed local Bot startup after token/secret rotation by replacing `tsx --env-file` with an override-aware development runner and regression coverage.
- KHOA-006 exposes transaction-scoped hooks for SePay ORDER_PAID/PAYMENT_REVIEW; production call sites remain owned by the still-open webhook/reconciliation issues #18 and #24, with disposable-database replay coverage at the outbox boundary.

## Progress log — 2026-08-05

- `feat-tele` completes KHOA-005 with revisioned callbacks under 64 bytes, stale-keyboard removal and state refresh, centralized pending/completed callback guards, idempotent draft creation, and real Telegraf routing coverage.
- Verified for KHOA-005: API and Bot type checks pass; 32 API tests and 73 Bot tests pass. The disposable PostgreSQL concurrency test remains opt-in through `TEST_DATABASE_URL`.
- `feat-tele` completes KHOA-004 with authenticated Barista queue/detail/history endpoints, atomic claim/READY transitions, service-staff delivery, Telegram handlers/keyboards, unit tests and full HTTP E2E coverage.
- Verified for KHOA-004: full API check with 31 tests and Bot check with 49 tests; the disposable database race/ownership test is opt-in through `TEST_DATABASE_URL`.
- `feat-tele` completes KHOA-003 with authenticated menu/draft APIs, transactional CASH/QR payment selection, mine/status endpoints and Telegram tracking/refresh handlers.
- Full HTTP E2E tests cover category → item → quantity → note → review → CASH/QR → status; database integration tests remain opt-in through a disposable `TEST_DATABASE_URL`.
- Verified for KHOA-003: Prisma generate/validate, full API check/build, 20 API tests, Bot check/build and 41 Bot tests all pass.
- `feat-tele` implements `POST /api/v1/telegram/session` against `public.users`, including internal-secret authentication, active-state enforcement, role mapping and Bot response validation.
- Verified locally for KHOA-002: API auth checks and 11 tests pass; Bot type-check/build and 32 tests pass.

- `apps/api` is a runnable Express service; the auth module implements admin JWT sessions and verified Telegram Web App sessions. Session state is held by a bounded process-local memory cache in `auth-session.store.ts`.
- Employee and menu modules are developed on dedicated feature branches; shared packages remain placeholders kept by `.gitkeep` files.
- `schema.prisma` configures Prisma Client and PostgreSQL through pooled `DATABASE_URL` plus migration `DIRECT_URL`; it currently defines the initial `User`, `Order`, and `OrderItem` models and related enums.
- `seed.ts` creates or refreshes the initial active `OWNER` from `SEED_OWNER_*`
  environment variables and refuses implicit role promotion.
- `docker-compose.yml` runs PostgreSQL 16 Alpine on port `5432`, with database/user/password `order_flow` and persistent volume `postgres_data`.
- API dependencies, TypeScript config, auth tests, and a root environment example exist; there is still no root workspace manifest or CI configuration.

## Progress log — 2026-08-04

- `feat-tele` was pushed at `ad2991d` (`feat(telegram): add service staff draft order flow`).
- `feat-tele` was merged into `dev` and pushed at `bc844e8` at that point in the project history.
- Verified after the merge:
  - `cd backend && npm.cmd run check:bot`
  - `cd backend && npm.cmd run test:bot` — 14 tests passed.
- Next Telegram dependencies: add SePay webhook reconciliation and real notification outbox integration.

## Navigation shortcuts

- API work: start at `backend/apps/api/src/` and the relevant `modules/<domain>/` folder.
- Telegram work: start at `backend/apps/telegram-bot/src/`.
- Telegram callback protocol and replay guards: start at `backend/apps/telegram-bot/src/callbacks/`.
- Admin UI work: start at `backend/apps/admin-web/src/`.
- Database work: start at `backend/prisma/schema.prisma` and `backend/prisma/seed.ts`.
- Cross-application contracts/constants: use `backend/packages/shared-types/` and `backend/packages/shared-constants/`.
- Local database infrastructure: use `backend/docker-compose.yml`.
- Planned API routes: read `backend/docs/api-contract.md` before implementing handlers.
- Postman/API generation: import `backend/docs/openapi.yaml`; keep it synchronized with route behavior and `api-contract.md`.
- Auth session storage: use `backend/apps/api/src/modules/auth/auth-session.store.ts`; restart clears sessions and multi-instance deployments require a shared replacement such as Redis.
- Supabase browser access: use `backend/apps/admin-web/src/services/supabase.ts`; its public values live in the root `.env.local`.
- Environment variable names/templates: use the root `.env.example`; never commit `.env.local`.

## Installed GitHub skills

The GitHub plugin is installed. Use its skills for repository work as follows:

- `github:github`: general repository orientation and triage; read or summarize Issues, PRs, patches, comments, labels, and repository state.
- `github:gh-address-comments`: inspect unresolved PR review threads, requested changes, and inline comments, then implement the selected fixes.
- `github:gh-fix-ci`: inspect and diagnose failing GitHub Actions checks and logs, then implement an approved fix.
- `github:yeet`: intentionally stage and commit local changes, push the branch, and open a draft PR.

Prefer the connected GitHub app for structured repository, Issue, and PR data. Use local `git` or `gh` only where needed for branch discovery, commits, pushes, or GitHub Actions logs. Before any write action, confirm the exact repository, branch, PR, Issue, or change scope; never include unrelated working-tree changes in a commit.

## Maintenance rule

When adding, removing, or repurposing a top-level app, package, domain module, or infrastructure component, update this map in the same change.
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
