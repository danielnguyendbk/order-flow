# Telegram session contract

The Telegram Bot is the only caller of this endpoint. The API remains the
source of truth for employee registration, `active` state, and role.

## `POST /api/v1/telegram/session`

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

A draft-order response contains `id`, `code`, `paymentStatus`,
`fulfillmentStatus`, `totalAmount`, and `items`. An item contains `id`,
`menuItemId`, `name`, `quantity`, `unitPrice`, and optional `note`. The API
calculates all prices and `totalAmount`; the Bot never sends a client total.
