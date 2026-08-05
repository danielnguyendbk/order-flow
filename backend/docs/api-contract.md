# Order Flow API Contract

Base path: `/api/v1`

Status: **mixed** — routes remain planned unless their section explicitly marks them implemented.

## Telegram session

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/telegram/session` | Create or establish a Telegram user session |

Implementation status: **implemented**. The route validates the internal Bot secret and Telegram user ID, resolves the employee from `public.users`, and rejects unknown or inactive employees.

## Admin authentication

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/admin/auth/login` | Authenticate an administrator |
| `POST` | `/api/v1/admin/auth/refresh` | Refresh an administrator session/token |
| `POST` | `/api/v1/admin/auth/logout` | End an administrator session |
| `GET` | `/api/v1/admin/auth/me` | Return the current administrator profile |

## Telegram service-staff menu

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

