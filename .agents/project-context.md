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

- `apps/api`: Express.js REST API
- `apps/telegram-bot`: Telegram Bot bằng Telegraf.js
- `apps/admin-web`: Next.js Admin Dashboard
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