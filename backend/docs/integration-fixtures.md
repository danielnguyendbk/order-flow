# BE004 Integration Fixtures

Run these fixtures when a backend developer or the Telegram Bot needs stable
accounts and menu data without manually preparing the database.

```bash
npm run seed:be004
```

The seed is idempotent and uses the `BE004` namespace. It upserts only the
records listed here and does not delete unrelated data. The password below is
for local development and integration smoke tests only.

## Users

| Purpose | ID | Username | Password | Telegram user ID | DB role | Status | Bot role |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Admin manager | `00000000-0000-4000-8000-000000004001` | `be004_owner` | `be004-dev-password` | `94004001` | `OWNER` | `ACTIVE` | `MANAGER` |
| Service staff | `00000000-0000-4000-8000-000000004002` | `be004_service_staff` | none | `94004002` | `SERVICE_STAFF` | `ACTIVE` | `SERVICE_STAFF` |
| Barista | `00000000-0000-4000-8000-000000004003` | `be004_barista` | none | `94004003` | `BARISTA` | `ACTIVE` | `BARISTA` |
| Inactive staff | `00000000-0000-4000-8000-000000004004` | `be004_inactive_staff` | none | `94004004` | `SERVICE_STAFF` | `INACTIVE` | blocked |

The database does not have a `MANAGER` enum value. Bot session responses expose
database `OWNER` users as Bot `MANAGER`.

## Menu

| Purpose | ID | Name | State | Price |
| --- | --- | --- | --- | --- |
| Active category | `00000000-0000-4000-8000-000000004101` | `BE004 Drinks` | `isActive=true` | n/a |
| Inactive category | `00000000-0000-4000-8000-000000004102` | `BE004 Hidden Drinks` | `isActive=false` | n/a |
| Active item | `00000000-0000-4000-8000-000000004201` | `BE004 Iced Latte` | `isAvailable=true` | `45000` |
| Inactive item | `00000000-0000-4000-8000-000000004202` | `BE004 Inactive Mocha` | `isAvailable=false` | `50000` |

Public menu endpoints must include `BE004 Drinks` and `BE004 Iced Latte`, and
must exclude `BE004 Hidden Drinks` and `BE004 Inactive Mocha`.

## Orders

| Purpose | ID | Order code | Payment status | Fulfillment status | Creator | Payment code |
| --- | --- | --- | --- | --- | --- | --- |
| Barista smoke-test queue order | `00000000-0000-4000-8000-000000004301` | `BE004-QUEUED-001` | `PAID` | `QUEUED` | `be004_service_staff` | `PAY-BE004-QUEUED-001` |

The queued order has one `BE004 Iced Latte`, total `45000`, and is unassigned
so `be004_barista` can see it in the queue before claiming.

## Required Headers

Bot and Telegram-owned operational routes require:

| Header | Value |
| --- | --- |
| `x-bot-internal-secret` | same value configured in API and Bot environment |
| `x-telegram-user-id` | one of the stable Telegram user IDs above |

`POST /api/v1/telegram/bot/session` uses `x-bot-internal-secret` and a JSON
body:

```json
{ "telegramUserId": 94004002 }
```

Expected smoke-test results:

| Fixture | Request | Expected result |
| --- | --- | --- |
| `94004002` | `/telegram/bot/session` | `200` with role `SERVICE_STAFF` |
| `94004001` | `/telegram/bot/session` | `200` with role `MANAGER` |
| `94004004` | `/telegram/bot/session` | `403` with code `EMPLOYEE_INACTIVE` |
| `94004003` | `/barista/queue` | queue can include `BE004-QUEUED-001` |
