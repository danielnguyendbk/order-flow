# Telegram session contract

The Telegram Bot is the only caller of this endpoint. The API remains the
source of truth for employee registration, `active` state, and role.
This internal endpoint does not issue JWTs. Telegram Web App JWT sessions remain
available separately at `POST /api/v1/telegram/session` and accept signed
`initData` instead of a Bot secret.

## `POST /api/v1/telegram/bot/session`

Headers:

- `x-bot-internal-secret`: shared secret between the Bot and API.
- `content-type: application/json`

Request body:

```json
{ "telegramUserId": 123456789 }
```

Successful response (`200`):

```json
{
  "employeeId": "uuid",
  "telegramUserId": 123456789,
  "displayName": "Nguyễn Minh Anh",
  "role": "SERVICE_STAFF"
}
```

`role` must be one of `SERVICE_STAFF`, `BARISTA`, or `MANAGER`; the database
`OWNER` role is exposed to the Bot as `MANAGER`. `telegramUserId` must be a
positive JavaScript safe integer. Error responses are:

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `TELEGRAM_USER_ID_INVALID` | Invalid request identity |
| `401` | `BOT_AUTH_INVALID` | Invalid internal Bot secret |
| `403` | `EMPLOYEE_INACTIVE` | Employee is inactive |
| `404` | `EMPLOYEE_NOT_FOUND` | Telegram user is not registered |

Error bodies have the shape:

```json
{ "code": "EMPLOYEE_INACTIVE", "message": "Employee is inactive" }
```

The bot calls this endpoint again for every callback; a Telegram session must
never be used as the authorization source.

## Draft order contract

The Bot uses these endpoints for the service-staff draft flow. Every request
uses the same internal-secret header and authenticated Telegram user context.
The API must verify ownership, active employee status, item availability, and
that the order is still `paymentStatus=UNPAID` and
`fulfillmentStatus=PENDING_PAYMENT`.

| Endpoint | Request | Response |
| --- | --- | --- |
| `POST /orders` | none | draft order |
| `GET /menu/categories` | none | active categories |
| `GET /menu/items?categoryId=:id` | none | active/inactive menu items with `id`, `name`, `price`, `isActive` |
| `POST /orders/:orderId/items` | `menuItemId`, `quantity`, optional `note` | updated draft order |
| `PATCH /orders/:orderId/items/:itemId` | optional `quantity` and/or `note` | updated draft order |
| `DELETE /orders/:orderId/items/:itemId` | none | updated draft order |
| `GET /orders/:orderId` | none | current draft order |
| `POST /orders/:orderId/cancel` | none | `204` or cancellation result |
| `POST /orders/:orderId/payments/cash/confirm` | none | paid and queued order |
| `POST /orders/:orderId/deliver` | none | creator-owned order transitioned from `READY` to `DELIVERED` |
| `POST /orders/:orderId/payments/qr` | none | order, payment code, amount and QR image URL |
| `GET /orders?mine=true` | none | up to 20 most recent orders owned by the employee |

`POST /orders` is create-or-get for an employee's open
`UNPAID/PENDING_PAYMENT` draft. Repeated or concurrent requests return the
same draft, so a double-click cannot create two open orders.

A draft-order response contains `id`, `code`, optional `paymentMethod`, `paymentStatus`,
`fulfillmentStatus`, `totalAmount`, and `items`. An item contains `id`,
`menuItemId`, `name`, `quantity`, `unitPrice`, and optional `note`. The API
calculates all prices and `totalAmount`; the Bot never sends a client total.

Every route above requires `x-bot-internal-secret` and
`x-telegram-user-id`. The API re-checks that the employee is active and has
the `SERVICE_STAFF` role on every request. CASH confirmation atomically moves
the order to `paymentStatus=PAID` and `fulfillmentStatus=QUEUED`. QR creation
sets `paymentStatus=PENDING`; the Bot refreshes `GET /orders/:orderId` to show
the status written by payment reconciliation.

## Inline callback contract

Draft-order callback data uses the compact format
`d:<8-hex-revision>:<action-code>[:entity-id]` and must be at most Telegram's
64-byte `callback_data` limit. The Bot rotates the draft revision whenever it
renders a new state. A callback whose revision does not match the active draft
is stale: the Bot acknowledges it, removes the old inline keyboard, reloads
the backend-owned state, and renders fresh controls.

The Bot session keeps short-lived pending and completed action keys. Pending
keys reject concurrent taps; completed keys reject rapid sequential replay.
This is a UX guard only. Backend create, payment, claim, READY, and delivery
operations remain authoritative and idempotent or use conditional transitions.
Legacy `draft:*` callbacks are accepted by routing only so they can be cleared
and refreshed; they are never executed as mutations.

## Barista order contract

Every request below requires `x-bot-internal-secret` and
`x-telegram-user-id`. The API resolves the actor from the Telegram identity on
every request and requires an active `BARISTA`; it never accepts a client
supplied `baristaId` or `requesterId`.

| Endpoint | Response |
| --- | --- |
| `GET /barista/queue` | Up to 20 oldest `PAID + QUEUED + unassigned` orders |
| `GET /barista/orders` | Up to 20 most recently updated orders assigned to the Barista |
| `GET /barista/orders/:orderId` | An unassigned queue order or an order assigned to the Barista |
| `GET /barista/orders/:orderId/history` | Status history for an order assigned to the Barista |
| `POST /orders/:orderId/claim` | Atomically assign the Barista and transition `QUEUED → PREPARING` |
| `POST /orders/:orderId/ready` | Atomically transition the assigned order `PREPARING → READY` |

Claim and READY write the order transition and its history entry in one
serializable transaction. A concurrent/stale action returns `409`; another
Barista's order returns `403`. Repeating a successful claim or READY action by
the same Barista is idempotent. Delivery remains a service-staff action: only
the employee who created the order can transition `READY → DELIVERED` through
the authenticated Telegram endpoint.
