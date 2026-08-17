# Project Context

## Tổng quan

OrderFlow là hệ thống quản lý vận hành dành cho doanh nghiệp
F&B vừa và nhỏ.

Luồng chính:

Service Staff
→ Create Order
→ Payment
→ Kitchen Queue
→ Preparing
→ Ready
→ Delivered

## Thành phần

- `apps/api`: Express.js REST API (port 3001 local)
- `apps/telegram-bot`: Telegram Bot bằng Telegraf.js
- `frontend/`: Next.js Admin Dashboard (port 3000 local, proxy qua `/api/backend/*`)
- `prisma`: Database schema và migrations
- `packages/shared-types`: Shared TypeScript types
- `packages/shared-constants`: Enum và constants

## Công nghệ

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- BullMQ
- Telegraf.js
- Zod
- JWT
- Jest
- Supertest
- Docker Compose

## Role nghiệp vụ

- `OWNER` (admin, truy cập Dashboard Web)
- `SERVICE_STAFF`
- `BARISTA`
- `MANAGER`
- `SYSTEM`

## Nguyên tắc kiến trúc

- Modular Monolith.
- PostgreSQL là source of truth.
- Telegram Bot và Frontend chỉ gọi Backend API.
- Business rule phải nằm tại Backend.
- Redis chỉ dùng cho queue, cache và session tạm thời.
- Auth session của API là in-memory (`MemoryAuthSessionStore`); restart backend sẽ xóa toàn bộ session, người dùng phải đăng nhập lại.
- Frontend tự động redirect về `/login` khi nhận 401 và refresh token không còn hiệu lực.