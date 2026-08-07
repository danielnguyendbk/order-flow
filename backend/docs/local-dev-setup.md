# Local Development Setup — Troubleshooting Log

Tài liệu này ghi lại các lỗi gặp phải khi khởi động API lần đầu trên môi trường local và cách khắc phục.

---

## 1. `.env.local` thiếu biến bắt buộc

### Triệu chứng
API crash ngay khi start do `zod` validation fail ở `getEnv()`:
```
ZodError: Required at "DATABASE_URL" ...
```

### Nguyên nhân
File `.env.local` ở root chỉ có 2 biến Supabase và `JWT_ACCESS_SECRET` với giá trị placeholder.

### Fix
Bổ sung các biến còn thiếu vào `.env.local`:

```dotenv
# API authentication
JWT_ACCESS_SECRET="dev-access-secret-replace-in-production-min32chars"
JWT_REFRESH_SECRET="dev-refresh-secret-replace-in-production-min32chars"
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
AUTH_SESSION_CACHE_MAX=10000

# PostgreSQL - local docker-compose
DATABASE_URL="postgresql://order_flow:order_flow@localhost:5432/order_flow"
DIRECT_URL="postgresql://order_flow:order_flow@localhost:5432/order_flow"

# Telegram (disabled for local dev)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_AUTH_MAX_AGE_SECONDS=300

# API server
HOST="0.0.0.0"
PORT=3001
```

> ⚠️ File `config/env.ts` dùng `findUp(".env.local", process.cwd())` để tự tìm file `.env.local` từ thư mục hiện tại lên root — không cần copy file vào `apps/api/`.

---

## 2. Docker daemon chưa chạy

### Triệu chứng
```
unable to get image 'postgres:16-alpine': Cannot connect to the Docker daemon at
unix:///Users/<user>/.docker/run/docker.sock. Is the docker daemon running?
```

### Nguyên nhân
Docker Desktop chưa được mở trước khi chạy `docker compose up`.

### Fix
Mở Docker Desktop trước:
```bash
open -a Docker
# Chờ ~10-15 giây để daemon sẵn sàng
docker info  # kiểm tra đã ready chưa
```

Sau đó khởi động PostgreSQL:
```bash
cd backend/
docker compose up -d
```

---

## 3. Prisma CLI chưa được cài trong `apps/api`

### Triệu chứng
```
zsh: no such file or directory: ./node_modules/.bin/prisma
```

### Nguyên nhân
`package.json` của `apps/api` chỉ có `@prisma/client` trong dependencies nhưng không có `prisma` CLI trong devDependencies.

### Fix
Cài `prisma` CLI đúng version (v5, khớp với `@prisma/client@5.x`):
```bash
cd backend/apps/api
npm install --save-dev prisma@5
```

> ⚠️ **Không dùng `npx prisma`** — `npx` sẽ tự động tải phiên bản mới nhất (v7+) và có breaking changes không tương thích với schema hiện tại (xem mục 4).

---

## 4. `prisma generate` dùng Prisma v7 — breaking change

### Triệu chứng
```
Error code: P1012
error: The datasource property `url` is no longer supported in schema files.
Move connection URLs for Migrate to `prisma.config.ts` ...
```

### Nguyên nhân
Prisma v7 không còn hỗ trợ `url` và `directUrl` trong `datasource` block của `schema.prisma`. Phải dùng file `prisma.config.ts` riêng. Tuy nhiên project đang dùng `@prisma/client@5.22.0` nên cần CLI v5 tương ứng.

### Fix
Dùng `prisma` CLI v5 đã cài ở bước trên (không dùng `npx`):
```bash
./node_modules/.bin/prisma generate --schema=../../prisma/schema.prisma
```

---

## 5. `schema.prisma` không có model — `prisma generate` không tạo client

### Triệu chứng
```
You don't have any models defined in your schema.prisma, so nothing will be generated.
```

Và khi API start, `order.repository.ts` crash khi import:
```
Error: @prisma/client did not initialize yet. Please run "prisma generate" ...
```

### Nguyên nhân
- `schema.prisma` chỉ có cấu hình `generator` và `datasource`, chưa có model nào.
- `order.repository.ts` gọi `new PrismaClient()` ở top-level module scope → crash ngay khi file được `require()`-ed.

### Fix
Thêm các model `Order`, `OrderItem` và các enums liên quan vào `backend/prisma/schema.prisma`:
```bash
./node_modules/.bin/prisma generate --schema=../../prisma/schema.prisma
```

Sau khi generate thành công, API khởi động bình thường.

> 📌 **Lưu ý tiếp theo**: Cần chạy migration để tạo bảng thực trong DB trước khi test endpoint:
> ```bash
> ./node_modules/.bin/prisma migrate dev --schema=../../prisma/schema.prisma --name init
> ```

---

## Quy trình khởi động API local (tổng hợp)

```bash
# 1. Mở Docker Desktop (nếu chưa mở)
open -a Docker && sleep 15

# 2. Khởi động PostgreSQL
cd backend/
docker compose up -d

# 3. Generate Prisma Client (chỉ cần làm 1 lần hoặc khi schema thay đổi)
cd apps/api
./node_modules/.bin/prisma generate --schema=../../prisma/schema.prisma

# 4. (Lần đầu) Tạo bảng trong DB
./node_modules/.bin/prisma migrate dev --schema=../../prisma/schema.prisma --name init

# 5. Chạy API
npm run dev
# → http://localhost:3001
# → Health check: GET http://localhost:3001/health
```

---

*Cập nhật lần cuối: 2026-08-05*
