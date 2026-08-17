# Project Map — Order Flow

Use this file as the first-stop repository map. Read it before scanning the tree, and update it whenever the structure or architecture changes.

## Repository layout

The repository currently contains two main workspaces: `backend/` and `frontend/`.

```text
order-flow/
├── AGENTS.md                         # This persistent project map
├── compose.yaml                      # Pull-and-run production container stack
├── DOCKER_DEPLOYMENT.md              # Container publishing and operator guide
├── package.json                      # Root process runner (`npm run live`)
├── SWIFT_MOBILE_APP_SPEC.md          # OWNER-only, read-only Swift manager dashboard contract
├── frontend/                         # Next.js Admin Web Application
│   ├── src/
│   │   ├── app/                      # App Router (pages: dashboard, orders, payments, etc.)
│   │   ├── components/               # Reusable UI components
│   │   └── lib/                      # Utility functions and data models
│   └── public/                       # Static assets
└── backend/
    ├── README.md                     # Short workspace overview
    ├── docker-compose.yml            # Local PostgreSQL 16 service
    ├── Dockerfile                    # Shared API/Bot/worker/init production image
    ├── Dockerfile.postgres           # PostgreSQL image with baseline schema
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
    │   └── telegram-bot/             # Telegram bot service
    │   │   └── src/
    │   │       ├── bot.ts            # Bot factory placeholder (`createBot`)
    │   │       ├── commands/          # Bot commands
    │   │       ├── handlers/          # Update/event handlers
    │   │       ├── keyboards/         # Telegram keyboard definitions
    │   │       ├── middleware/        # Bot middleware
    │   │       ├── scenes/            # Multi-step conversation flows
    │   │       └── services/          # Bot-facing integrations/services
    ├── packages/
    │   ├── shared-types/              # Types shared across applications
    │   ├── shared-constants/          # Constants shared across applications
    │   └── eslint-config/             # Shared ESLint configuration
    └── prisma/
        ├── schema.prisma              # PostgreSQL Prisma schema
        ├── seed.ts                    # Idempotent initial OWNER seed entry point
        ├── seed-visualization.ts      # Large local-Docker dataset; reuses existing users
        └── sync-users-to-docker.ts    # Safe Supabase users → local Docker upsert
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
- `refunds`: manual refund recording
- `barista`: barista-facing workflow
- `notifications`: notification delivery
- `reports`: reporting
- `audit`: audit trail

## Current implementation state

- The complete application can run from published Docker images through root `compose.yaml`: PostgreSQL, Redis, one-shot OWNER initialization, API, Admin Web, Telegram Bot and notification worker. GHCR release automation builds both AMD64 and ARM64 images.
- The API is an Express app with Telegram employee-session authentication, order lifecycle, barista, admin, payment, SePay, reconciliation, refund, revenue report, audit and order-status-history modules. Its routes are mounted beneath `/api/v1`.
- The API runs a server-side QR-payment recovery poller every three seconds by default. It scans pending QR payments in a bounded batch, queries SePay with `SEPAY_API_TOKEN`, then sends exact matches through the same idempotent SePay transaction pipeline used by webhooks.
- OWNER-authenticated `GET /api/v1/admin/dashboard` returns live PostgreSQL aggregates, status counts, revenue buckets, recent orders and payment alerts for the requested 1–90 day range.
- The root `npm run live` command uses `concurrently` to run the API, Admin Web, Telegram Bot and notification worker in one terminal.
- `backend/apps/telegram-bot` is a TypeScript/Telegraf application managed by the root `backend/package.json`; it has its own local environment template, Vitest configuration and notification-worker skeleton.
- The Telegram Bot authenticates each interaction through `POST /api/v1/telegram/bot/session`, stores only an ephemeral Bot session, and renders role-specific menus. Telegram Web App JWT authentication remains at `POST /api/v1/telegram/session`.
- Service staff can complete an API-owned Telegram order flow: category → item → quantity → note → review → CASH or QR. They can edit/cancel drafts, list their orders and refresh payment/fulfillment status. Price, total, ownership and payment transitions are always supplied or enforced by the API.
- Baristas can complete the Telegram preparation flow: queue → detail → atomic claim → PREPARING → READY → history. Queue eligibility, active role, assignment ownership and state transitions are enforced by the API.
- Telegram session, menu, draft-order, CASH/QR and order-status routes are implemented end-to-end according to `backend/apps/telegram-bot/TELEGRAM_SESSION_CONTRACT.md`.
- The Prisma schema maps the existing users, menu, orders, payments and status-history SQL tables; the full API TypeScript build succeeds.
- Bot tests cover authentication, role menus, Bot-to-API HTTP boundaries, complete CASH/QR flows, tracking, active-item checks, edit/delete, stale callbacks, duplicate callbacks, ownership, and non-editable orders.
- Inline draft keyboards use compact revisioned callback data from `backend/apps/telegram-bot/src/callbacks/`; stale keyboards are cleared and refreshed from backend state, and duplicate mutations are guarded in both the Bot and API.
- Barista API transitions use conditional updates plus serializable transactions so assignment/status and history commit together; service-staff delivery is separately authenticated and creator-owned.
- Notification delivery uses a PostgreSQL transactional outbox and a BullMQ/Redis Telegram worker. ORDER_PAID targets the order creator plus every active Barista with an actionable claim button, ORDER_READY targets the order creator, and PAYMENT_REVIEW targets active owners, with persistent retry state and an internal requeue CLI.
- Telegram development commands run through `apps/telegram-bot/src/dev-runner.ts`, which deliberately lets the local `.env` override stale shell credentials; production commands continue to use deployment-provided environment variables.
- The staff `Kiểm tra thanh toán` action actively queries SePay API v2 as a webhook-recovery path, requiring `SEPAY_API_TOKEN` and an environment-specific `SEPAY_API_BASE_URL`; Live and Test Mode/Sandbox tokens are isolated. Numeric API v1 and UUID API v2 transaction IDs share the same string idempotency column.
- The experimental voice-order handler can download a Telegram voice message and invoke a configured Hermes-compatible command bridge; it is disabled unless `VOICE_ORDER_SCRIPT` is configured.

## Progress log — 2026-08-16

- Added production multi-stage Docker images for the shared backend runtime and standalone Next.js frontend, plus a PostgreSQL 16 image that initializes the full baseline schema.
- Added a pull-only production Compose stack with health/dependency gates, persistent PostgreSQL/Redis volumes, idempotent OWNER initialization, internal service URLs and configurable public ports.
- Added GHCR tag publishing for `linux/amd64` and `linux/arm64`, an environment template, and an operator guide for download, startup, upgrades, logs and package visibility.

## Progress log — 2026-08-14

- Added three OWNER report exports to the revenue page: an accounting-oriented XLSX, a 04/TNDN revenue-method DOCX, and a 03/TNDN revenue-expense DOCX.
- DOCX exports retain the two source templates in `backend/docs`, fill revenue from PostgreSQL, and require the user to confirm tax identity, rate, expense and adjustment inputs that Order Flow does not store.
- XLSX export provides summary, issue register, order/Payment/SePay/refund detail, journal and daily reconciliation sheets. Formula-driven checks reconcile order totals, expected/received amounts, bank transactions and cumulative refunds; colored bold cells and comments identify each exception and remediation. The workbook retains an explicit scope note for missing VAT/input-invoice/expense data.

## Progress log — 2026-08-12

- Added SePay API v2 active transaction lookup with explicit Live/Sandbox endpoints so Telegram payment checks can use isolated Test Mode API tokens.
- Migrated SePay external transaction identifiers from `bigint` to `varchar(64)`, preserving legacy numeric IDs while accepting v2 UUIDs.
- Added a 60-second SePay lookup tolerance for bank timestamp rounding/clock skew while retaining exact account, incoming amount and payment-code validation.
- Pending QR status messages now expose `Kiểm tra thanh toán` directly, so active SePay reconciliation is not limited to the original QR message.

## Progress log — 2026-08-11

- Removed the deprecated `backend/apps/admin-web` placeholder and its unused browser Supabase client; the active Next.js admin application remains in the repository-level `frontend/` workspace.
- Added the optional experimental Telegram voice-order bridge on `test/dashboard-with-voice`; normal button-based ordering remains available when the bridge is disabled or fails.
- Ported the dashboard aggregate API from `bc00f75` without its retired simulator or older admin-route behavior; the service now reuses the shared Prisma singleton.

## Progress log — 2026-08-10

- Fixed the Supabase schema gap that caused 500s on admin tabs: the remote DB was missing the `sepay_transactions` and `audit_logs` tables plus the `transaction_match_status`, `resolution_action` and `audit_entity_type` enum types. Added the idempotent migration `backend/prisma/sql/2026-08-10_sepay_audit_tables.sql` (safe to re-run) and a small runner at `backend/scripts/run-migration.cjs` (`node scripts/run-migration.cjs prisma/sql/<file>.sql`) for applying future SQL migrations against Supabase.
- Switched `DATABASE_URL` in the root `.env.local` from the Supabase **session pooler (5432)** to the **transaction pooler (6543)** with `pgbouncer=true`. The API creates many separate `new PrismaClient()` instances (each holding its own connection pool), which exceeded the 15-connection cap of the session pooler and caused intermittent `max clients reached` 500s whenever the admin UI fired several requests in parallel (e.g. the dashboard). Transaction pooling releases connections after each transaction; `DIRECT_URL` (5432) is unchanged for migrations.
- Fixed `Request validation failed` on the Thực đơn (catalog) and Danh mục (categories) pages: the admin menu-item and employee list schemas capped `limit` at 100 while the admin UI loads up to 500–1000 rows. Raised the cap to 1000 in `adminItemListQuerySchema` (`item.schemas.ts`) and `employeeListQuerySchema` (`employee.schemas.ts`).
- Consolidated all backend services to consume the shared `PrismaClient` singleton (`src/db.ts`). Configured `connection_limit=5` in `src/db.ts` and `max: 3` in `src/config/database.ts` (node-postgres `pg.Pool`). This caps total active connections at 8, completely below Supabase Transaction Pooler's ceiling of 15 connections, eliminating `EMAXCONNSESSION` process crashes under concurrent admin UI navigation.
- Verified after the fixes: all admin endpoints (orders, transactions, reconciliations, revenue, audit-logs, menu, employees, barista queue) return 200 both directly and through the FE `/api/backend` proxy, including 7 parallel calls × 3 rounds; API type-check and 57 API tests pass.

## Progress log — 2026-08-10

- Added a deterministic, rerunnable visualization seed that targets only the PostgreSQL database exposed by local Docker, covering menu, orders, order items, payments, status history and historical notifications across a configurable time range.
- The visualization seed uses a dedicated localhost Docker PostgreSQL URL instead of the normal Supabase environment URL, never writes `users`, requires existing active SERVICE_STAFF and BARISTA records, and refuses production/remote database targets.
- Removed the local Redis service from Docker Compose; auth session caching remains process-local, while the optional BullMQ notification worker requires an externally supplied Redis service if used.
- Added a guarded, non-destructive users-only sync from Supabase into local Docker PostgreSQL; it preserves UUIDs and refuses unique identity conflicts.
- Usage and verification queries are documented in `backend/docs/visualization-seed.md`.
- Removed the local realtime Order Simulator and its dedicated API scripts; test data remains available through the Docker-only visualization seed.

## Progress log — 2026-08-07

- Split the two Telegram authentication contracts: Telegram Web App JWT creation remains `POST /api/v1/telegram/session`, while internal Bot employee resolution now uses `POST /api/v1/telegram/bot/session`.
- The Bot client now calls `/telegram/bot/session`. The API mounts this route only when `BOT_INTERNAL_SECRET` is configured, and Bot operational requests continue through the internal-secret-gated Telegram order/barista routers.
- Local API configuration comes from the repository `.env.local`; local Bot configuration comes from `backend/apps/telegram-bot/.env`. Both files must contain the same non-empty `BOT_INTERNAL_SECRET`. The Bot API base URL is `http://localhost:3001/api/v1` by default.
- Verified after the split: API type-check and 35 API tests pass; Bot type-check and 79 Bot tests, including HTTP E2E flows, pass.

## Progress log — 2026-08-06

- `feat-tele` implements KHOA-006 notification outbox records, idempotent event keys, BullMQ dispatch, Telegram retry/failure persistence, Redis Docker infrastructure, and an internal failed-notification requeue command.
- Fixed local Bot startup after token/secret rotation by replacing `tsx --env-file` with an override-aware development runner and regression coverage.
- SePay webhook processing now calls the transaction-scoped notification outbox hooks: exact matches enqueue `ORDER_PAID`, while review classifications enqueue `PAYMENT_REVIEW`. Duplicate webhooks return success without replaying payment, notification, or audit side effects.

## Progress log — 2026-08-05

- `feat-tele` completes KHOA-005 with revisioned callbacks under 64 bytes, stale-keyboard removal and state refresh, centralized pending/completed callback guards, idempotent draft creation, and real Telegraf routing coverage.
- Verified for KHOA-005: API and Bot type checks pass; 32 API tests and 73 Bot tests pass. The disposable PostgreSQL concurrency test remains opt-in through `TEST_DATABASE_URL`.
- `feat-tele` completes KHOA-004 with authenticated Barista queue/detail/history endpoints, atomic claim/READY transitions, service-staff delivery, Telegram handlers/keyboards, unit tests and full HTTP E2E coverage.
- Verified for KHOA-004: full API check with 31 tests and Bot check with 49 tests; the disposable database race/ownership test is opt-in through `TEST_DATABASE_URL`.
- `feat-tele` completes KHOA-003 with authenticated menu/draft APIs, transactional CASH/QR payment selection, mine/status endpoints and Telegram tracking/refresh handlers.
- Full HTTP E2E tests cover category → item → quantity → note → review → CASH/QR → status; database integration tests remain opt-in through a disposable `TEST_DATABASE_URL`.
- Verified for KHOA-003: Prisma generate/validate, full API check/build, 20 API tests, Bot check/build and 41 Bot tests all pass.
- `feat-tele` implements the internal Bot session against `public.users`, now exposed separately at `POST /api/v1/telegram/bot/session`, including internal-secret authentication, active-state enforcement, role mapping and Bot response validation.
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
- Admin UI work: start at `frontend/src/app/`.
- Database work: start at `backend/prisma/schema.prisma` and `backend/prisma/seed.ts`.
- Cross-application contracts/constants: use `backend/packages/shared-types/` and `backend/packages/shared-constants/`.
- Local database infrastructure: use `backend/docker-compose.yml`.
- Planned API routes: read `backend/docs/api-contract.md` before implementing handlers.
- Postman/API generation: import `backend/docs/openapi.yaml`; keep it synchronized with route behavior and `api-contract.md`.
- Swift mobile work: start at `SWIFT_MOBILE_APP_SPEC.md`; the MVP is an OWNER-only, read-only manager dashboard and explicitly excludes service-staff/Barista actions.
- Auth session storage: use `backend/apps/api/src/modules/auth/auth-session.store.ts`; restart clears sessions and multi-instance deployments require a shared replacement such as Redis.
- Telegram authentication: Web App JWT flow is registered in `backend/apps/api/src/modules/auth/auth.routes.ts`; internal Bot employee resolution is implemented in `telegram-session.routes.ts` and mounted at `/api/v1/telegram/bot/session` from `apps/api/src/app.ts`.
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
