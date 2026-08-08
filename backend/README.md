# Order Flow Backend

## Telegram notification worker

KHOA-006 uses a transactional PostgreSQL outbox plus BullMQ. Business transactions create
`notifications` rows; a dispatcher polls `PENDING`/`RETRYING` rows every five seconds and
enqueues jobs whose payload contains only `notificationId`. The worker records delivery as
`SENT`, retries Telegram failures up to five times, and records the final state as `FAILED`.

Local startup:

```powershell
docker compose up -d postgres redis
npm.cmd run generate:prisma
npm.cmd run dev:notification-worker
```

The worker environment requires only `TELEGRAM_BOT_TOKEN`, `REDIS_URL`, and `DATABASE_URL`.
To retry a `FAILED` notification after correcting an operational problem:

```powershell
npm.cmd run notifications:requeue -- <notification-id>
```

Delivery is at-least-once: a process failure after Telegram accepts a message but before the
database marks it `SENT` can result in a duplicate message. The unique outbox key prevents
duplicate business events from creating duplicate notification rows.

Backend workspace skeleton for API, Telegram bot, admin web, shared packages, and Prisma.

## Telegram authentication endpoints

Telegram Web App and the server-side Telegram Bot use separate authentication
contracts:

| Caller | Endpoint | Authentication | Result |
| --- | --- | --- | --- |
| Telegram Web App | `POST /api/v1/telegram/session` | Signed `initData` verified with `TELEGRAM_BOT_TOKEN` | JWT access/refresh session |
| Telegram Bot | `POST /api/v1/telegram/bot/session` | `x-bot-internal-secret` plus `telegramUserId` | Active employee identity; no JWT |

For local development, the API reads the repository `.env.local`, while the Bot
reads `apps/telegram-bot/.env`. Set the same non-empty `BOT_INTERNAL_SECRET` in
both files. Keep `API_BASE_URL=http://localhost:3001/api/v1` in the Bot env.
Restart both processes after changing code or environment values:

```sh
npm run dev:api
npm run dev:bot
```

The internal Bot endpoint is mounted only when the API has
`BOT_INTERNAL_SECRET`. Its request and response details are maintained in
`apps/telegram-bot/TELEGRAM_SESSION_CONTRACT.md`.

## Telegram bot (Khoa)

The Telegram Bot scaffold lives in `apps/telegram-bot`. It authenticates each
interaction against the API using the user's Telegram ID, renders role-specific
inline menus, protects duplicate callbacks, and leaves every business decision
to the backend. The notification worker uses BullMQ retries so a Telegram send
failure cannot roll back a completed payment or order state change.
Draft keyboards carry a compact state revision within Telegram's 64-byte
callback limit. Stale buttons are cleared and replaced from backend state;
concurrent and rapid sequential taps are guarded in the Bot and mutation
endpoints remain idempotent or conditionally transactional.
The required Telegram authentication contract is documented in
`apps/telegram-bot/TELEGRAM_SESSION_CONTRACT.md`.
Service staff can create backend-owned drafts, choose CASH or SePay/VietQR,
list their orders, and refresh payment/fulfillment status from Telegram. The
API owns pricing, totals, ownership checks and payment transitions.
Baristas can list the paid queue, open order detail, atomically claim an order,
mark their assigned order READY, and view status history. The API derives the
actor from the Telegram identity and records each transition transactionally.

```sh
cp apps/telegram-bot/.env.example apps/telegram-bot/.env
npm install
npm run dev:bot
npm run dev:notification-worker
npm run test:bot
```

The development scripts load `apps/telegram-bot/.env` automatically and override
stale values inherited from the local shell. Keep the file local and never commit
its token or shared secrets. The bot itself requires
`TELEGRAM_BOT_TOKEN`, `API_BASE_URL`, and `BOT_INTERNAL_SECRET`; only the
notification worker additionally requires `REDIS_URL` and `DATABASE_URL`.
This override applies only to the development runner; production start commands
continue to use environment variables injected by the deployment platform.

Use long polling locally. In production, set an HTTPS origin in
`TELEGRAM_WEBHOOK_DOMAIN` and a random `TELEGRAM_WEBHOOK_SECRET_TOKEN` to switch
the bot to authenticated webhook mode. Build with `npm run build:bot`, then run
`npm run start:bot` with environment variables injected by the deployment
platform. Business transactions write idempotent notification outbox rows in
PostgreSQL; the dispatcher enqueues `NotificationJob` payloads after commit.

`ORDER_PAID` for CASH and `ORDER_READY` are connected to their current business
transactions. The SePay webhook/reconciliation tasks (#18 and #24) must call
`recordOrderNotification` for a reconciled PAID order or
`recordPaymentReviewNotifications` for a review classification from the same
Prisma transaction. The outbox unique key makes replayed sources idempotent.

## Structure

- `apps/api` - HTTP API service
- `apps/telegram-bot` - Telegram bot service
- `apps/admin-web` - Admin web application
- `packages/shared-types` - Shared TypeScript types
- `packages/shared-constants` - Shared constants
- `packages/eslint-config` - Shared ESLint configuration
- `prisma` - Database schema and seed script

## Supabase environment

Copy the repository-level `.env.example` to `.env.local` and provide the
Supabase values there. The admin web client reads
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Prisma uses `DATABASE_URL` for application traffic and `DIRECT_URL` for
migrations. Keep both server-only and never prefix them with `NEXT_PUBLIC_`.

Install the admin web dependency from its directory:

```bash
cd apps/admin-web
npm install
```

Row Level Security must be enabled for every table exposed through the
browser Supabase client. Never use a Supabase service-role key in admin-web.

## API service

The Fastify API lives in `apps/api`. Install and run it with:

```bash
cd apps/api
npm install
npm run dev
```

Authentication uses a process-local memory cache for sessions and the
server-only variables shown in the repository `.env.example`. Only SHA-256
refresh-token hashes are cached; restarting the API logs out every user, and
multiple API instances do not share sessions. Use Redis before horizontally
scaling the API.

Apply `prisma/sql/2026-08-04_users_rls.sql` to prevent the `users` table and
its password hashes from being read through Supabase's public Data API. The API
automatically finds `.env.local` from its current directory or any parent
directory.

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

## Initial owner seed

Set `SEED_OWNER_FULL_NAME`, `SEED_OWNER_USERNAME`, and a password of at least
12 characters in the repository `.env.local`, then run:

```bash
cd backend
npm run db:generate
npm run db:seed
```

The seed is idempotent for an existing `OWNER`: it refreshes the configured
name, bcrypt password hash, and active status. It refuses to promote an
existing non-owner account that happens to use the same username.
