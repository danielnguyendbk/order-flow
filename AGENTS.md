# Project Map — Order Flow

Use this file as the first-stop repository map. Read it before scanning the tree, and update it whenever the structure or architecture changes.

## Repository layout

The repository currently contains one workspace under `backend/`.

```text
order-flow/
├── AGENTS.md                         # This persistent project map
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
    │   └── admin-web/                # Admin web application
    │       └── src/
    │           ├── app/               # Application pages/layout
    │           ├── components/        # Reusable UI components
    │           ├── services/          # API clients; `supabase.ts` is the browser client
    │           └── types/             # Admin-web-specific types
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

This is an initial skeleton, not yet a runnable application:

- `apps/api` is a runnable Fastify service; the auth module implements admin JWT sessions and verified Telegram Web App sessions. Session state is held by a bounded process-local memory cache in `auth-session.store.ts`.
- `apps/telegram-bot/src/bot.ts` only returns `{ name: "order-flow-telegram-bot" }`.
- Most non-auth API modules, Telegram bot subdirectories, admin-web UI directories, and shared packages remain placeholders kept by `.gitkeep` files.
- `schema.prisma` configures Prisma Client and PostgreSQL through pooled `DATABASE_URL` plus migration `DIRECT_URL`, but defines no models yet.
- `seed.ts` has no seed data yet.
- `docker-compose.yml` runs PostgreSQL 16 Alpine on port `5432`, with database/user/password `order_flow` and persistent volume `postgres_data`.
- API dependencies, TypeScript config, auth tests, and a root environment example exist; there is still no root workspace manifest or CI configuration.

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
