# Order Flow Backend

Backend workspace skeleton for API, Telegram bot, admin web, shared packages, and Prisma.

## Telegram bot (Khoa)

The Telegram Bot scaffold lives in `apps/telegram-bot`. It authenticates each
interaction against the API using the user's Telegram ID, renders role-specific
inline menus, protects duplicate callbacks, and leaves every business decision
to the backend. The notification worker uses BullMQ retries so a Telegram send
failure cannot roll back a completed payment or order state change.
The required Telegram authentication contract is documented in
`apps/telegram-bot/TELEGRAM_SESSION_CONTRACT.md`.

```sh
cp apps/telegram-bot/.env.example apps/telegram-bot/.env
npm install
npm run dev:bot
npm run dev:notification-worker
npm run test:bot
```

Use long polling locally. Set `TELEGRAM_WEBHOOK_DOMAIN` in production to switch
the bot to webhook mode. The API should enqueue `NotificationJob` payloads only
after its business transaction commits.

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
