# Order Flow API Contract

Base path: `/api/v1`

Status: **mixed** — routes remain planned unless their section explicitly marks them implemented.
Routes explicitly marked **implemented** have handlers, validation, authorization, and tests. All other route groups remain planned.

## Integration fixtures

Status: **implemented**

BE-004 shared fixtures live in `backend/docs/integration-fixtures.md` and are
seeded with:

```bash
npm run seed:be004
```

The fixture namespace is `BE004`. It provides one active owner/admin-manager,
one active service staff employee, one active barista, one inactive service
staff employee, active/inactive menu data, and a `PAID + QUEUED` order for
barista smoke testing. Bot and Telegram-owned operational requests use:

- `x-bot-internal-secret`
- `x-telegram-user-id`

Database `OWNER` remains the persisted manager role and is exposed to the
Telegram Bot as `MANAGER`.

## Telegram session

Status: **implemented**

Runtime note: Telegram Web App authentication is optional. When
`TELEGRAM_BOT_TOKEN` is empty, `/telegram/session` returns HTTP `503` and the
rest of the API remains available. The internal Bot endpoint uses the separate
`BOT_INTERNAL_SECRET` shared by the API and Bot, and is mounted only when that
secret is configured.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/telegram/session` | Create a JWT session from signed Telegram Web App data |
| `POST` | `/api/v1/telegram/bot/session` | Resolve an active employee for the internal Telegram Bot |

Bot requests use `/telegram/bot/session`, provide `x-bot-internal-secret` and a numeric `telegramUserId`; the API resolves the employee from `public.users` and rejects unknown or inactive employees.

Telegram Web App requests omit the internal header and provide:

```json
{ "initData": "<signed Telegram Web App initData>" }
```

The server verifies Telegram's HMAC signature and `auth_date`, then resolves an active employee by `telegram_user_id`.

## Admin authentication

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/admin/auth/login` | Authenticate an administrator |
| `POST` | `/api/v1/admin/auth/refresh` | Refresh an administrator session/token |
| `POST` | `/api/v1/admin/auth/logout` | End an administrator session |
| `GET` | `/api/v1/admin/auth/me` | Return the current administrator profile |
| `GET` | `/api/v1/admin/auth/debug/sessions` | Development-only session cache inspection |

- Login body: `{ "username": "...", "password": "..." }`
- Refresh body: `{ "refreshToken": "..." }`
- Logout and `me` require `Authorization: Bearer <accessToken>` and the current `OWNER` role.
- Login, refresh, and Telegram session return `{ "data": { "accessToken", "refreshToken", "tokenType", "expiresIn", "user" } }`.
- `me` returns `{ "data": { "id", "fullName", "username", "telegramUserId", "role" } }`.
- Logout returns HTTP `204`.
- Refresh tokens rotate on every use. Reuse of an old refresh token revokes its in-memory session.
- Sessions are process-local: restarting the API logs everyone out, and separate API instances do not share sessions.
- Debug sessions route is mounted only outside `production` and is not part of the production contract.

## Service orders

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/orders` | Create a service order |
| `GET` | `/api/v1/orders` | List service orders |
| `GET` | `/api/v1/orders/:orderId` | Get order detail |
| `POST` | `/api/v1/orders/:orderId/cancel` | Cancel an unpaid order |
| `POST` | `/api/v1/orders/:orderId/ready` | Mark a preparing order ready |
| `POST` | `/api/v1/orders/:orderId/deliver` | Mark a ready order delivered |

- Create body: `{ "createdByUserId": "...", "paymentMethod": "QR|CASH", "customerNote": "...", "items": [{ "menuItemId": "...", "quantity": 1, "note": "..." }] }`.
- New orders start with `paymentStatus: "UNPAID"` and `fulfillmentStatus: "PENDING_PAYMENT"` from database defaults.
- `orderCode` is unique in the database; create retries generated code collisions before surfacing a database error.
- `GET /orders` supports `createdByUserId`, `fulfillmentStatus`, `paymentStatus`, `assignedBaristaId`, `page`, and `limit`; service staff can pass their own `createdByUserId` to list their own service orders.
- `GET /orders/:orderId` returns `items` and `timeline`, where `timeline` is status history ordered oldest-first.
- Cancel body: `{ "reason": "...", "requesterId": "..." }`. Unpaid pending-payment orders can be cancelled and the cancellation is recorded in `timeline`.
- READY body: `{ "requesterId": "..." }`, or `baristaId`/`userId`. Only the assigned barista or a manager can mark READY.
- DELIVER body: `{ "requesterId": "..." }`, or `baristaId`/`userId`. Only the creator or a manager can mark DELIVERED.

## Order items

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/orders/:orderId/items` | Add an item to an editable order |
| `PATCH` | `/api/v1/orders/:orderId/items/:itemId` | Update item quantity or note |
| `DELETE` | `/api/v1/orders/:orderId/items/:itemId` | Remove an item |

- Item changes are allowed only while the order is `UNPAID` and `PENDING_PAYMENT`; an order with QR payment `PENDING` is not editable.
- Add item resolves and snapshots the current menu item name and price from the backend. Client-supplied name, price, or total are ignored.
- Every add/update/delete recalculates `totalAmount` from persisted item snapshots inside a database transaction.
- Quantity must be a positive integer. Unavailable items and items in inactive categories cannot be added.

## Payments

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/orders/:orderId/payments` | List payment records for an order |
| `POST` | `/api/v1/orders/:orderId/payments/qr` | Initialize or reuse a QR payment |
| `POST` | `/api/v1/orders/:orderId/payments/cash/confirm` | Confirm a CASH payment and queue the order |

- `GET /orders/:orderId/payments` returns the linked payment history for the order.
- QR initialization is idempotent for an existing pending QR payment and returns the transfer content and amount.
- CASH confirmation requires `confirmedByUserId` and an exact amount when provided; only the order creator or owner can confirm.
- CASH confirmation transitions the order from `UNPAID/PENDING_PAYMENT` to `PAID/QUEUED` and records payment + fulfillment history.
- CASH confirmation and QR initialization write financial audit logs.

## SePay webhook and reconciliation

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/webhooks/sepay` | Receive and reconcile a SePay transaction webhook |
| `GET` | `/api/v1/admin/transactions` | List received SePay transactions |
| `GET` | `/api/v1/admin/transactions/:transactionId` | Get a received SePay transaction |
| `GET` | `/api/v1/admin/reconciliations` | List transactions needing reconciliation review |
| `GET` | `/api/v1/admin/reconciliations/:reconciliationId` | Get a reconciliation review transaction |
| `POST` | `/api/v1/admin/reconciliations/:reconciliationId/resolve` | Resolve a reconciliation review transaction |

- SePay accepts `sepayTransactionId`, `sepay_transaction_id`, `transactionId`, `transaction_id`, or `id` as the external unique transaction ID.
- SePay accepts `amountIn`, `amount_in`, `transferAmount`, or `amount` as the received amount.
- Duplicate SePay webhooks are idempotent and still return HTTP success without reprocessing payments, notifications, or audit logs.
- Exact QR matches transition the payment to `PAID`, queue the order, write payment history, and enqueue `ORDER_PAID`.
- Underpaid, overpaid, wrong-code, and cancelled-order arrivals move the payment/order into review where applicable and enqueue `PAYMENT_REVIEW`.
- Reconciliation resolution requires an owner actor and writes a financial audit log with the resolution action and note.

## Refunds, revenue, and audit

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/admin/orders/:orderId/refund` | Record a manual refund for a paid order |
| `GET` | `/api/v1/admin/reports/revenue` | Return revenue totals by date range and payment method |
| `GET` | `/api/v1/admin/audit-logs` | List audit logs |

- Refund body: `{ "refundedByUserId": "...", "reason": "...", "amount": 50000 }`; `amount` is optional and defaults to the received payment amount.
- Refunds require an owner actor, reject duplicate refund records for the same payment, and write `MANUAL_REFUND_RECORDED` audit logs.
- Revenue accepts `from` and `to` query parameters as ISO date-time strings or `YYYY-MM-DD`; date-only values are expanded to the Asia/Bangkok day boundary.
- Revenue separates `CASH`, `QR`, and `REFUNDED`; refunded amounts are excluded from net revenue.

## Barista queue

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/barista/employees` | List active Barista employees eligible for assignment |
| `GET` | `/api/v1/barista/queue` | List queued paid orders for barista processing |
| `GET` | `/api/v1/barista/orders?baristaId=...` | List preparing or ready orders assigned to a barista |
| `POST` | `/api/v1/orders/:orderId/claim` | Atomically claim a queued order |

- Queue only shows orders with `fulfillmentStatus = QUEUED` and `paymentStatus = PAID`.
- Claim is atomic at the database layer: only one barista can win a concurrent claim.
- Claim rejects a target user unless their current role is `BARISTA` and status is `ACTIVE`.
- `GET /barista/orders` requires `baristaId`.

## Public menu

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/menu/categories` | List public menu categories |
| `GET` | `/api/v1/menu/items` | List public menu items |

Implementation status: **implemented for authenticated Telegram service staff**. Both routes re-check the employee identity and active state.

## Telegram service-staff orders

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/orders` | Create or return the employee's existing open backend-owned draft |
| `GET` | `/api/v1/orders?mine=true` | List the employee's recent orders |
| `GET` | `/api/v1/orders/:orderId` | Get an owned order and current status |
| `POST` | `/api/v1/orders/:orderId/items` | Add an available menu item at the backend price |
| `PATCH` | `/api/v1/orders/:orderId/items/:itemId` | Update quantity or note while editable |
| `DELETE` | `/api/v1/orders/:orderId/items/:itemId` | Delete an item and recalculate total |
| `POST` | `/api/v1/orders/:orderId/cancel` | Cancel an unpaid draft |
| `POST` | `/api/v1/orders/:orderId/payments/qr` | Start an idempotent QR payment |
| `POST` | `/api/v1/orders/:orderId/payments/cash/confirm` | Atomically confirm CASH and queue the order |
| `POST` | `/api/v1/orders/:orderId/deliver` | Creator confirms handoff of a READY order |

Implementation status: **implemented**. All routes require the Bot secret and an active `SERVICE_STAFF` Telegram identity. Ownership, editability, menu availability and payment transitions are enforced by the API.

## Telegram Barista orders

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/barista/queue` | List oldest paid, queued and unassigned orders |
| `GET` | `/api/v1/barista/orders` | List orders assigned to the current Barista |
| `GET` | `/api/v1/barista/orders/:orderId` | Show an accessible queue/assigned order |
| `GET` | `/api/v1/barista/orders/:orderId/history` | Show history for an assigned order |
| `POST` | `/api/v1/orders/:orderId/claim` | Atomically claim a queued order |
| `POST` | `/api/v1/orders/:orderId/ready` | Mark the assigned preparing order ready |

Implementation status: **implemented**. These endpoints require the Bot
secret and an active `BARISTA` Telegram identity. The backend derives the actor
from the authenticated identity; claim and READY use conditional updates and
write history within the same serializable transaction.

## Admin employees

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/employees` | List employees |
| `GET` | `/api/v1/admin/employees/:employeeId` | Get an employee by ID |
| `POST` | `/api/v1/admin/employees` | Create an employee |
| `PATCH` | `/api/v1/admin/employees/:employeeId` | Partially update an employee |
| `POST` | `/api/v1/admin/employees/:employeeId/activate` | Activate an employee |
| `POST` | `/api/v1/admin/employees/:employeeId/deactivate` | Deactivate an employee |

## Admin menu categories

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/menu-categories` | List menu categories for administration |
| `POST` | `/api/v1/admin/menu-categories` | Create a menu category |
| `PATCH` | `/api/v1/admin/menu-categories/:categoryId` | Partially update a menu category |
| `DELETE` | `/api/v1/admin/menu-categories/:categoryId` | Delete a menu category |

## Admin menu items

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/menu-items` | List menu items for administration |
| `GET` | `/api/v1/admin/menu-items/:itemId` | Get a menu item by ID |
| `POST` | `/api/v1/admin/menu-items` | Create a menu item |
| `PATCH` | `/api/v1/admin/menu-items/:itemId` | Partially update a menu item |
| `DELETE` | `/api/v1/admin/menu-items/:itemId` | Delete a menu item |

## Admin dashboard

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/dashboard` | Get live owner dashboard metrics, status counts, revenue series, recent orders, and payment alerts |

- Requires a valid `Authorization: Bearer <OWNER_JWT>` session; service staff and Baristas receive `403`.
- Optional `days` query controls the revenue range from 1 through 90 days and defaults to 7.
- Revenue amounts are returned as decimal strings because PostgreSQL/Prisma stores VND amounts as `BigInt`.
- Revenue buckets use the `Asia/Ho_Chi_Minh` timezone. With `days=1`, `revenueSeries` contains 24 hourly buckets; longer ranges use daily buckets.

## Admin orders

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/orders` | List all orders with filters |
| `GET` | `/api/v1/admin/orders/:orderId` | Get an order with items and timeline |
| `POST` | `/api/v1/admin/orders/:orderId/override-status` | Override fulfillment or payment status |

- All routes require an authenticated admin session.
- Override body includes `domain`, `status`, `adminId`, and optional `reason`; terminal fulfillment statuses cannot be overridden.

## Implementation ownership

| Route group | API module |
| --- | --- |
| Telegram session | `apps/api/src/modules/auth/` with Telegram integration as needed |
| Admin authentication | `apps/api/src/modules/auth/` |
| Service orders, items and public ownership actions | `apps/api/src/modules/orders/` |
| Payments and payment transitions | `apps/api/src/modules/payments/` plus order status updates in `apps/api/src/modules/orders/` |
| Barista queue and public claim view | `apps/api/src/modules/barista/` plus claim handling in `apps/api/src/modules/orders/` |
| Admin dashboard and orders | `apps/api/src/modules/admin/` plus status mutation handling in `apps/api/src/modules/orders/` |
| Public/admin menu categories and items | `apps/api/src/modules/menu/` |
| Telegram service-staff orders and payments | `apps/api/src/modules/orders/` |
| Telegram Barista queue and processing | `apps/api/src/modules/barista/` |
| Admin employees | `apps/api/src/modules/employees/` |

## Contract completion checklist

Before marking an endpoint implemented, define and test:

- Request parameters, query, and body schema
- Success response body and HTTP status
- Authentication and role/permission requirements
- Validation and domain errors
- Pagination/filtering/sorting where applicable
- Audit behavior for admin mutations
- Integration or route tests
