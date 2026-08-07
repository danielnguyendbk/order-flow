# Order Flow API Contract

Base path: `/api/v1`

Status: **mixed** — routes remain planned unless their section explicitly marks them implemented.
Routes explicitly marked **implemented** have handlers, validation, authorization, and tests. All other route groups remain planned.

## Telegram session

Status: **implemented**

Runtime note: Telegram authentication is optional. When `TELEGRAM_BOT_TOKEN`
is empty, this endpoint returns HTTP `503` and the rest of the API remains
available.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/telegram/session` | Create or establish a Telegram user session |

Bot requests provide `x-bot-internal-secret` and a numeric `telegramUserId`; the API resolves the employee from `public.users` and rejects unknown or inactive employees.

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

- Login body: `{ "username": "...", "password": "..." }`
- Refresh body: `{ "refreshToken": "..." }`
- Logout and `me` require `Authorization: Bearer <accessToken>` and the current `OWNER` role.
- Login, refresh, and Telegram session return `{ "data": { "accessToken", "refreshToken", "tokenType", "expiresIn", "user" } }`.
- `me` returns `{ "data": { "id", "fullName", "username", "telegramUserId", "role" } }`.
- Logout returns HTTP `204`.
- Refresh tokens rotate on every use. Reuse of an old refresh token revokes its in-memory session.
- Sessions are process-local: restarting the API logs everyone out, and separate API instances do not share sessions.

## Service orders

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/orders` | Create a service order |
| `GET` | `/api/v1/orders` | List service orders |
| `GET` | `/api/v1/orders/:orderId` | Get order detail |
| `POST` | `/api/v1/orders/:orderId/cancel` | Cancel an unpaid order |

- Create body: `{ "createdByUserId": "...", "paymentMethod": "QR|CASH", "customerNote": "...", "items": [{ "menuItemId": "...", "quantity": 1, "note": "..." }] }`.
- New orders start with `paymentStatus: "UNPAID"` and `fulfillmentStatus: "PENDING_PAYMENT"` from database defaults.
- `orderCode` is unique in the database; create retries generated code collisions before surfacing a database error.
- `GET /orders` supports `createdByUserId`, `fulfillmentStatus`, `paymentStatus`, `assignedBaristaId`, `page`, and `limit`; service staff can pass their own `createdByUserId` to list their own service orders.
- `GET /orders/:orderId` returns `items` and `timeline`, where `timeline` is status history ordered oldest-first.
- Cancel body: `{ "reason": "...", "requesterId": "..." }`. Unpaid pending-payment orders can be cancelled and the cancellation is recorded in `timeline`.

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

## Telegram service-staff menu

## Public menu

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

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/employees` | List employees |
| `GET` | `/api/v1/admin/employees/:employeeId` | Get an employee by ID |
| `POST` | `/api/v1/admin/employees` | Create an employee |
| `PATCH` | `/api/v1/admin/employees/:employeeId` | Partially update an employee |
| `POST` | `/api/v1/admin/employees/:employeeId/activate` | Activate an employee |
| `POST` | `/api/v1/admin/employees/:employeeId/deactivate` | Deactivate an employee |

## Admin menu categories

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/menu-categories` | List menu categories for administration |
| `POST` | `/api/v1/admin/menu-categories` | Create a menu category |
| `PATCH` | `/api/v1/admin/menu-categories/:categoryId` | Partially update a menu category |
| `DELETE` | `/api/v1/admin/menu-categories/:categoryId` | Delete a menu category |

## Admin menu items

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/menu-items` | List menu items for administration |
| `GET` | `/api/v1/admin/menu-items/:itemId` | Get a menu item by ID |
| `POST` | `/api/v1/admin/menu-items` | Create a menu item |
| `PATCH` | `/api/v1/admin/menu-items/:itemId` | Partially update a menu item |
| `DELETE` | `/api/v1/admin/menu-items/:itemId` | Delete a menu item |

## Implementation ownership

| Route group | API module |
| --- | --- |
| Telegram session | `apps/api/src/modules/auth/` with Telegram integration as needed |
| Admin authentication | `apps/api/src/modules/auth/` |
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
