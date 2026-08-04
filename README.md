# 🚀 ACIS Flow

> **Smart F&B Operations Platform for Small & Medium Businesses**

ACIS Flow là nền tảng quản lý vận hành dành cho quán cà phê, trà sữa,
nhà hàng và mô hình F&B vừa & nhỏ. Hệ thống kết hợp **Telegram Bot**,
**Express.js REST API** và **Website quản trị** để số hóa quy trình
Order → Payment → Kitchen → Delivery → Reporting.

------------------------------------------------------------------------

## ✨ Features

-   🤖 Telegram Bot cho nhân viên phục vụ
-   ☕ Telegram Bot cho Barista
-   💳 Thanh toán Cash & QR (SePay)
-   📊 Dashboard doanh thu
-   📦 Quản lý Menu
-   👥 Quản lý nhân viên
-   🧾 Audit Log
-   🔔 Notification
-   📈 Revenue Analytics

------------------------------------------------------------------------

## 🏗 System Architecture

``` mermaid
graph LR
A[Service Staff] --> B[Telegram Bot]
C[Barista] --> B
D[Manager] --> E[Admin Web]

B --> F[Express.js API]
E --> F

F --> G[(PostgreSQL)]
I[SePay] -->|Webhook| F
```

------------------------------------------------------------------------

## 🔄 Business Workflow

``` mermaid
flowchart LR
A(Create Order)
-->B(Payment)
-->C(Queue)
-->D(Preparing)
-->E(Ready)
-->F(Delivered)
```

### Payment State

``` mermaid
stateDiagram-v2
UNPAID --> PENDING
UNPAID --> PAID
PENDING --> PAID
PENDING --> UNDERPAID
PENDING --> OVERPAID
PENDING --> PAYMENT_REVIEW
```

### Fulfillment State

``` mermaid
stateDiagram-v2
PENDING_PAYMENT --> QUEUED
QUEUED --> PREPARING
PREPARING --> READY
READY --> DELIVERED
```

------------------------------------------------------------------------

# ⚙️ Tech Stack
  Backend         Node.js + Express.js + TypeScript
  ORM             Prisma
  Database        PostgreSQL
  Bot             Telegraf.js
  Frontend        Next.js
  Auth            JWT
  Validation      Zod
  Logging         Pino
  API Docs        Swagger
  Testing         Jest + Supertest
  Deploy          Docker

------------------------------------------------------------------------

# 📁 Project Structure

``` text
acis-flow/
├── apps/
│   ├── api/
│   ├── telegram-bot/
│   └── admin-web/
├── packages/
│   ├── shared-types/
│   └── shared-utils/
├── prisma/
├── docker/
├── docs/
├── docker-compose.yml
└── README.md
```

------------------------------------------------------------------------

# 📡 API Modules

-   Authentication
-   Employee Management
-   Menu Management
-   Order Management
-   Payment
-   SePay Webhook
-   Kitchen Queue
-   Delivery
-   Revenue Report
-   Reconciliation
-   Audit Log
-   Notification

Base URL

``` text
/api/v1
```

------------------------------------------------------------------------

# 🤖 Telegram Bot

## Service Staff

-   Login bằng Telegram User ID
-   Tạo Order
-   Thêm món
-   Chọn Cash / QR
-   Theo dõi Order
-   Giao món

## Barista

-   Xem Queue
-   Claim Order
-   Preparing
-   Ready
-   Xem lịch sử

------------------------------------------------------------------------

# 💳 Payment

## Cash

-   Nhân viên xác nhận đã thu tiền.
-   Backend lưu người xác nhận và thời gian.

## QR

-   Sinh QR.
-   SePay Webhook xác nhận.
-   Chỉ khi đúng mã + đúng tiền mới chuyển PAID.

------------------------------------------------------------------------

# 🗄 Database Modules

-   employees
-   menu_categories
-   menu_items
-   orders
-   order_items
-   payments
-   sepay_transactions
-   reconciliations
-   notifications
-   audit_logs

------------------------------------------------------------------------

# 🚀 Getting Started

``` bash
git clone <repository>

cd acis-flow

cp .env.example .env

docker compose up -d

npm install

npx prisma migrate dev

npx prisma db seed

npm run dev
```

------------------------------------------------------------------------

# 🧪 Testing

``` bash
npm test
npm run test:integration
npm run test:e2e
```

Các trường hợp cần kiểm thử:

-   Authentication
-   Order Lifecycle
-   Payment
-   SePay Duplicate Webhook
-   Revenue
-   Telegram Notification
-   Atomic Claim

------------------------------------------------------------------------

# 👨‍💻 Team Responsibilities

  Member      Responsibility
  ----------- -----------------------------------------
  Backend 1   Foundation, Auth, Employee, Menu
  Backend 2   Order, Kitchen Workflow, Delivery
  Backend 3   Payment, SePay, Revenue, Audit
  Backend 4   Telegram Bot, Notification, Integration
  Frontend    Dashboard & Admin UI




