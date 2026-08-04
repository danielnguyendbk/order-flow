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

`role` must be one of `SERVICE_STAFF`, `BARISTA`, or `MANAGER`. Return `401`
for an invalid bot secret; return `403` for an inactive employee and `404` for
an unknown Telegram user. Error bodies have the shape:

```json
{ "code": "EMPLOYEE_INACTIVE", "message": "Employee is inactive" }
```

The bot calls this endpoint again for every callback; a Telegram session must
never be used as the authorization source.
