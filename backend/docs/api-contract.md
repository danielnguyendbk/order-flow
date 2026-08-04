# Order Flow API Contract

Base path: `/api/v1`

Routes explicitly marked **implemented** have handlers, validation, authorization, and tests. All other route groups remain planned.

## Telegram session

Status: **implemented**

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/telegram/session` | Create or establish a Telegram user session |

Request body:

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

## Public menu

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/menu/categories` | List public menu categories |
| `GET` | `/api/v1/menu/items` | List public menu items |

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
