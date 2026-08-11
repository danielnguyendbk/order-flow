# Order Flow

Order Flow là hệ thống vận hành F&B gồm bốn tiến trình:

- Admin Web: Next.js, mặc định `http://localhost:3000`
- REST API: Express + Prisma/PostgreSQL, mặc định `http://localhost:3001`
- Telegram Bot: Telegraf, chạy bằng long polling khi phát triển local
- Notification Worker: BullMQ + Redis, gửi thông báo Telegram từ transactional outbox

Luồng chính của hệ thống là: tạo đơn → thanh toán tiền mặt/QR → Barista nhận đơn → pha chế → sẵn sàng → giao món → báo cáo.

## Workflow luồng order chính

```mermaid
flowchart TB
    subgraph Staff["Service Staff · Telegram Bot"]
        Start([Bắt đầu]) --> Build[Chọn danh mục → món → số lượng → ghi chú]
        Build --> Review[Xem lại và chỉnh sửa đơn]
        Review --> Draft["Đơn nháp<br/>UNPAID · PENDING_PAYMENT"]
        Draft --> Payment{Chọn thanh toán}
        Draft -. Hủy khi chưa thanh toán .-> Cancelled([CANCELLED])
        Ready --> Deliver[Nhân viên tạo đơn xác nhận giao món]
        Deliver --> Delivered([DELIVERED])
    end

    subgraph PaymentFlow["REST API · Payment · SePay"]
        Payment -->|CASH · đã thu tiền| Cash[API xác nhận tiền mặt]
        Cash --> PaidQueued["PAID · QUEUED"]

        Payment -->|QR| CreateQr["Tạo payment code và VietQR<br/>PENDING · PENDING_PAYMENT"]
        CreateQr --> Bank[Khách chuyển khoản]
        Bank --> Verify{"SePay webhook hoặc<br/>Kiểm tra thanh toán"}
        Verify -->|Webhook khớp mã + số tiền hoặc tra cứu khớp đủ điều kiện| PaidQueued
        Verify -->|Sai mã / thiếu / thừa / trạng thái bất thường| ReviewPayment["UNDERPAID / OVERPAID / REVIEW<br/>Ghi nhận reconciliation"]
    end

    subgraph Notify["Transactional Outbox · Redis · Notification Worker"]
        PaidQueued --> PaidEvent[ORDER_PAID]
        PaidEvent -. Telegram .-> StaffPaid[Thông báo nhân viên tạo đơn]
        PaidEvent -. Telegram + nút nhận đơn .-> BaristaAlert[Thông báo các Barista đang hoạt động]
        ReviewPayment --> ReviewEvent[PAYMENT_REVIEW]
        ReviewEvent -. Telegram .-> OwnerReview[Owner kiểm tra và xử lý thủ công]
        Ready --> ReadyEvent[ORDER_READY]
        ReadyEvent -. Telegram .-> StaffReady[Thông báo nhân viên tạo đơn]
    end

    subgraph Barista["Barista · Telegram Bot"]
        PaidQueued --> Queue[Danh sách đơn chờ pha]
        Queue -->|Một Barista claim nguyên tử| Preparing["PREPARING<br/>gán assignedBaristaId"]
        Preparing -->|Barista được gán xác nhận| Ready[READY]
    end

    Delivered --> Reports[Admin Web · báo cáo doanh thu và audit log]

    classDef terminal fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef exception fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
    classDef active fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
    class Delivered,PaidQueued terminal;
    class Cancelled,ReviewPayment exception;
    class Draft,CreateQr,Preparing,Ready active;
```

Trạng thái của một order được theo dõi độc lập theo hai miền:

- **Payment:** `UNPAID` → `PENDING` → `PAID`; giao dịch QR bất thường chuyển sang `UNDERPAID`, `OVERPAID` hoặc `REVIEW` để Owner đối soát.
- **Fulfillment:** `PENDING_PAYMENT` → `QUEUED` → `PREPARING` → `READY` → `DELIVERED`. Chỉ order đã `PAID` mới vào `QUEUED`.
- Service Staff chỉ sửa hoặc hủy draft khi chưa thanh toán. API cũng hỗ trợ hủy có lý do từ `PENDING_PAYMENT`, `QUEUED` hoặc `PREPARING`; `DELIVERED` và `CANCELLED` là trạng thái kết thúc.
- Mọi lần đổi trạng thái được lưu vào order status history; các thao tác quan trọng tiếp tục được ghi audit log để Admin Web tra cứu.

## 1. Yêu cầu

Cài trước:

- Node.js `>= 20.6` và npm
- Docker Desktop có Docker Compose
- Git
- Một Telegram Bot token từ BotFather nếu muốn chạy Bot và notification worker

Các lệnh dưới đây viết cho PowerShell trên Windows. Nếu dùng macOS/Linux, thay `Copy-Item` bằng `cp` và `npm.cmd`/`npx.cmd` bằng `npm`/`npx`.

Kiểm tra công cụ:

```powershell
node --version
npm --version
docker --version
docker compose version
```

## 2. Lấy mã nguồn và cài dependency

```powershell
git clone <repository-url>
cd order-flow

npm.cmd --prefix backend install
npm.cmd --prefix backend/apps/api install
npm.cmd --prefix frontend install
npm.cmd install
```

Repo không có root npm workspace. Root `package.json` chỉ cung cấp lệnh điều phối các tiến trình, vì vậy cần cài đủ cả bốn bộ dependency như trên:

- `backend/`: Prisma, Telegram Bot và worker
- `backend/apps/api/`: Express API
- `frontend/`: Next.js Admin Web
- root: `concurrently` để chạy và dừng đồng thời bốn tiến trình

## 3. Cấu hình môi trường

### 3.1 API và database

Tạo file local từ template:

```powershell
Copy-Item .env.example .env.local
```

Mở `.env.local` và đặt ít nhất các giá trị sau để chạy hoàn toàn bằng PostgreSQL local:

```dotenv
# PostgreSQL do backend/docker-compose.yml tạo
DATABASE_URL="postgresql://order_flow:order_flow@localhost:5432/order_flow"
DIRECT_URL="postgresql://order_flow:order_flow@localhost:5432/order_flow"

# Chuỗi ngẫu nhiên riêng biệt, mỗi chuỗi dài ít nhất 32 ký tự
JWT_ACCESS_SECRET="replace-with-a-random-secret-at-least-32-characters"
JWT_REFRESH_SECRET="replace-with-another-random-secret-at-least-32-characters"

# Phải giống hệt BOT_INTERNAL_SECRET trong backend/apps/telegram-bot/.env
BOT_INTERNAL_SECRET="replace-with-a-long-random-internal-secret"

# Tài khoản đăng nhập Admin Web được tạo ở bước seed
SEED_OWNER_FULL_NAME="Store Owner"
SEED_OWNER_USERNAME="owner"
SEED_OWNER_PASSWORD="change-me-at-least-12-characters"

HOST="0.0.0.0"
PORT=3001
```

`SEED_OWNER_PASSWORD` phải dài ít nhất 12 ký tự. Không commit `.env.local`.

Các biến dưới đây chỉ cần khi dùng tính năng tương ứng:

```dotenv
# Cần cho QR/VietQR và xác thực initData của Telegram Web App
TELEGRAM_BOT_TOKEN="123456789:your-real-bot-token"
SEPAY_BANK_ACCOUNT="your-bank-account-number"
SEPAY_BANK_NAME="your-bank-short-name"
SEPAY_ACCOUNT_HOLDER="your-account-holder-name"
SEPAY_QR_IMAGE_BASE_URL="https://vietqr.app/img"

# Cần khi nhận webhook hoặc dùng nút kiểm tra giao dịch SePay
SEPAY_WEBHOOK_API_KEY="your-sepay-webhook-api-key"
SEPAY_API_TOKEN="your-sepay-api-token"
```

Hai biến `NEXT_PUBLIC_SUPABASE_*` trong template có thể giữ nguyên khi chạy toàn bộ stack bằng PostgreSQL local; Admin Web hiện đọc/ghi dữ liệu qua Express API.

### 3.2 Telegram Bot và notification worker

```powershell
Copy-Item backend/apps/telegram-bot/.env.example backend/apps/telegram-bot/.env
```

Điền `backend/apps/telegram-bot/.env`:

```dotenv
TELEGRAM_BOT_TOKEN=123456789:your-real-bot-token
API_BASE_URL=http://localhost:3001/api/v1
BOT_INTERNAL_SECRET=replace-with-a-long-random-internal-secret
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://order_flow:order_flow@localhost:5432/order_flow

# Để trống để Bot chạy long polling ở local
TELEGRAM_WEBHOOK_DOMAIN=
TELEGRAM_WEBHOOK_PATH=/telegram/webhook
TELEGRAM_WEBHOOK_SECRET_TOKEN=
PORT=3001
```

Lưu ý:

- `BOT_INTERNAL_SECRET` ở hai file `.env.local` và `backend/apps/telegram-bot/.env` phải giống hệt nhau và không được rỗng.
- Bot cần `TELEGRAM_BOT_TOKEN`, `API_BASE_URL`, `BOT_INTERNAL_SECRET`.
- Worker cần `TELEGRAM_BOT_TOKEN`, `REDIS_URL`, `DATABASE_URL`.
- Không commit file `backend/apps/telegram-bot/.env`.

### 3.3 Admin Web

Không bắt buộc tạo env cho frontend khi API chạy ở địa chỉ mặc định. Nếu đổi địa chỉ API, tạo `frontend/.env.local`:

```dotenv
API_BASE_URL=http://127.0.0.1:3001/api/v1
```

Biến này chỉ được đọc ở server Next.js, không thêm tiền tố `NEXT_PUBLIC_`.

## 4. Khởi tạo PostgreSQL và Redis

Từ thư mục gốc `order-flow/`:

```powershell
docker compose -f backend/docker-compose.yml up -d postgres redis
docker compose -f backend/docker-compose.yml ps
```

Docker Compose tạo:

- PostgreSQL 16 tại `localhost:5432`, database/user/password đều là `order_flow`
- Redis 7 tại `localhost:6379`

Khởi tạo Prisma Client, đồng bộ schema và seed dữ liệu:

```powershell
cd backend

$env:DATABASE_URL="postgresql://order_flow:order_flow@localhost:5432/order_flow"
$env:DIRECT_URL="postgresql://order_flow:order_flow@localhost:5432/order_flow"

npm.cmd run db:generate
npx.cmd prisma db push --schema prisma/schema.prisma
npm.cmd run db:seed
npm.cmd run seed:menu

cd ..
```

Các lệnh trên thực hiện:

- `db:generate`: sinh Prisma Client
- `prisma db push`: tạo toàn bộ enum, bảng, khóa và index từ `backend/prisma/schema.prisma`
- `db:seed`: tạo/cập nhật tài khoản OWNER từ `.env.local`
- `seed:menu`: thêm menu mẫu để có thể tạo đơn ngay

Repository hiện không có Prisma migration history, vì vậy một database local mới phải dùng `prisma db push`; không chạy `prisma migrate dev` theo hướng dẫn cũ.

## 5. Chạy toàn bộ dự án

Giữ Docker Desktop và hai container PostgreSQL/Redis đang chạy. Từ thư mục gốc `order-flow/`, chạy:

```powershell
npm run live
```

Lệnh này chạy đồng thời API, Admin Web, Telegram Bot và Notification Worker trong cùng một terminal, với prefix riêng cho log của từng tiến trình. Nhấn `Ctrl+C` để dừng cả bốn.

Nếu muốn chạy và theo dõi từng tiến trình trong terminal riêng, dùng các lệnh bên dưới.

Mở bốn cửa sổ terminal riêng.

### Terminal 1 — API

```powershell
cd order-flow/backend
npm.cmd run dev:api
```

API tự đọc `order-flow/.env.local` và lắng nghe ở `http://localhost:3001`.

### Terminal 2 — Admin Web

```powershell
cd order-flow/frontend
npm.cmd run dev
```

Mở `http://localhost:3000/login` và đăng nhập bằng `SEED_OWNER_USERNAME`/`SEED_OWNER_PASSWORD`.

### Terminal 3 — Telegram Bot

```powershell
cd order-flow/backend
npm.cmd run dev:bot
```

Development runner tự đọc `backend/apps/telegram-bot/.env`. Khi `TELEGRAM_WEBHOOK_DOMAIN` để trống, Bot chạy long polling nên không cần tunnel HTTPS.

### Terminal 4 — Notification Worker

```powershell
cd order-flow/backend
npm.cmd run dev:notification-worker
```

Worker lấy notification từ PostgreSQL, đưa job vào Redis và gửi tin qua Telegram.

## 6. Kiểm tra sau khi chạy

Kiểm tra API:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

Kết quả mong đợi:

```text
status service
------ -------
ok     order-flow-api
```

Kiểm tra nhanh toàn hệ thống:

1. Mở `http://localhost:3000/login` và đăng nhập tài khoản OWNER đã seed.
2. Vào **Thực đơn** để xác nhận menu mẫu đã xuất hiện.
3. Vào **Nhân viên**, tạo một `SERVICE_STAFF` và một `BARISTA` với đúng Telegram User ID.
4. Nếu muốn nhận notification trong chat riêng, điền cả Telegram Chat ID; với chat riêng, giá trị này thường bằng Telegram User ID.
5. Mở Bot trên Telegram, gửi `/start`. Mỗi Telegram User ID chỉ nhận menu đúng với role đã khai báo.
6. Tạo đơn bằng tài khoản service staff, thanh toán CASH hoặc QR, rồi dùng tài khoản barista để claim và chuyển đơn sang READY.
7. Kiểm tra đơn, thanh toán, doanh thu và audit log trên Admin Web.

## 7. SePay webhook khi phát triển local

Thanh toán CASH và việc tạo ảnh QR không cần public tunnel. SePay chỉ có thể gọi webhook nếu API có một URL HTTPS công khai.

Webhook phải trỏ tới:

```text
https://<public-api-domain>/api/v1/webhooks/sepay
```

API key cấu hình trong SePay phải khớp `SEPAY_WEBHOOK_API_KEY` trong `.env.local`. Hướng dẫn cấu hình Test Mode/Live chi tiết nằm tại [backend/docs/sepay-live-setup.md](backend/docs/sepay-live-setup.md).

## 8. Dừng hoặc làm mới môi trường local

Dừng các tiến trình Node bằng `Ctrl+C`, sau đó dừng container:

```powershell
docker compose -f backend/docker-compose.yml down
```

Lệnh trên giữ nguyên dữ liệu trong Docker volumes. Nếu chủ động muốn xóa toàn bộ dữ liệu PostgreSQL và Redis local để khởi tạo lại từ đầu:

```powershell
docker compose -f backend/docker-compose.yml down -v
```

`down -v` xóa dữ liệu local và không thể khôi phục nếu chưa sao lưu.

## 9. Kiểm tra code

```powershell
cd backend
npm.cmd run check:api
npm.cmd run test:api
npm.cmd run check:bot
npm.cmd run test:bot

cd ../frontend
npm.cmd run lint
npm.cmd run build
```

## 10. Lỗi thường gặp

### API báo lỗi env hoặc không khởi động

- Kiểm tra `.env.local` nằm ở thư mục gốc `order-flow/`.
- Hai JWT secret phải dài ít nhất 32 ký tự.
- `DATABASE_URL` phải trỏ tới PostgreSQL đang chạy.
- Kiểm tra cổng bằng `docker compose -f backend/docker-compose.yml ps`.

### Admin Web trả về 503

Frontend không kết nối được API. Kiểm tra Terminal API và chạy:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

Nếu API dùng cổng khác, sửa `API_BASE_URL` trong `frontend/.env.local` rồi khởi động lại Next.js.

### Không đăng nhập được Admin Web

Chạy lại seed sau khi kiểm tra `SEED_OWNER_PASSWORD` dài ít nhất 12 ký tự:

```powershell
cd backend
npm.cmd run db:seed
```

API lưu session trong bộ nhớ tiến trình; khởi động lại API sẽ đăng xuất các phiên hiện tại.

### Bot báo không tìm thấy hoặc không có quyền

- Bảo đảm nhân viên đang `ACTIVE` và Telegram User ID trong Admin Web đúng với tài khoản đang nhắn Bot.
- Bảo đảm `BOT_INTERNAL_SECRET` trong hai file env giống nhau.
- Khởi động lại cả API và Bot sau khi đổi env.

### Bot chạy nhưng notification không gửi

- Worker phải đang chạy riêng với `npm.cmd run dev:notification-worker`.
- Redis phải chạy và `REDIS_URL=redis://localhost:6379`.
- Nhân viên nhận thông báo phải có `telegramChatId` trong database.

### Cổng 5432, 6379, 3000 hoặc 3001 đã được dùng

Dừng dịch vụ đang chiếm cổng hoặc đổi port tương ứng trong Docker Compose/env. Nếu đổi port API, cập nhật cả `frontend/.env.local` và `API_BASE_URL` của Bot.

## Cấu trúc chính

```text
order-flow/
├── package.json                 # Root runner: npm run live
├── frontend/                    # Next.js Admin Web
├── backend/
│   ├── apps/api/                # Express REST API
│   ├── apps/telegram-bot/       # Telegraf Bot và notification worker
│   ├── prisma/                  # Prisma schema, seed và SQL hỗ trợ
│   └── docker-compose.yml       # PostgreSQL + Redis local
├── .env.example
└── README.md
```
