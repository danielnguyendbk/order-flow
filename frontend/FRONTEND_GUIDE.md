# Hướng dẫn tổng quan — Web Admin Frontend (Order Flow / Bot QLCT)

> File này được tạo để giúp **đọc hiểu và trả lời câu hỏi** về toàn bộ giao diện
> quản trị (web admin) của dự án. Mọi thông tin trong đây đều đối chiếu từ code
> thực tế trong thư mục `frontend/`.

---

## 1. Đây là gì? Vai trò trong hệ thống

`frontend/` là **Web Admin (giao diện quản trị)**, viết bằng **Next.js 16 (App Router) + React 19 + Tailwind CSS v4**.

Nó **KHÔNG chứa dữ liệu và không có database riêng**. Nó chỉ là lớp giao diện:
- Đọc/ghi dữ liệu **trực tiếp từ backend Express** (`backend/apps/api`) trên PostgreSQL.
- Mọi request từ trình duyệt đều đi qua **route proxy** `/api/backend/*` trong Next.js, route này sẽ forward tới backend thật (mặc định `http://localhost:3001`).

Nói ngắn gọn: **FE chỉ là "mặt tiền" (front), toàn bộ nghiệp vụ nằm ở backend.**

Người dùng cuối là **Chủ quán / Admin** (không phải nhân viên — nhân viên dùng Telegram Bot).

---

## 2. Công nghệ sử dụng (`package.json`)

| Công nghệ | Phiên bản | Vai trò |
|---|---|---|
| Next.js | 16.3.0 | Framework, App Router |
| React / ReactDOM | 19.2.8 | UI |
| Tailwind CSS | v4 (qua `@tailwindcss/postcss`) | Styling |
| TypeScript | ^5 | Ngôn ngữ |
| ESLint (`eslint-config-next`) | ^9 | Lint |

**Lưu ý quan trọng (cạm bẫy Next 16):**
- Next.js 16 có **breaking changes** so với bản cũ (theo `AGENTS.md` — đọc guide trong `node_modules/next/dist/docs/` trước khi viết code mới).
- `next build` bản thường đang **dính bug upstream của Next 16.3 + React 19.2** khi prerender trang `/_global-error` ("Cannot read properties of null (reading 'useContext')"). Workaround hiện tại: script build dùng `next build --debug-prerender` (xem `package.json`).
- Font **Be Vietnam Pro** được self-host sub-set (file `.woff2` trong `public/fonts/`) để giữ đúng ký tự tiếng Việt.

### Cách chạy

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000/login
npm run build      # build production (có cờ --debug-prerender)
npm run start      # chạy bản production
```

Yêu cầu backend đang chạy (mặc định `API_UPSTREAM_URL = http://localhost:3001`) để proxy trả dữ liệu thật.

---

## 3. Cấu trúc thư mục (đọc nhanh)

```
frontend/
├── next.config.ts            # Cấu hình Next (allowedDevOrigins + ghi chú bug build)
├── package.json              # Script: dev / build / start / lint
├── postcss.config.mjs        # Cấu hình Tailwind
├── tsconfig.json             # Path alias @/* → ./src/*
├── TESTING.md                # Checklist kiểm thử thủ công toàn bộ tính năng
├── public/fonts/             # Font Be Vietnam Pro self-hosted (.woff2)
└── src/
    ├── app/                  # App Router — trang + API routes
    │   ├── layout.tsx        # Root layout (metadata, html lang="vi")
    │   ├── page.tsx          # "/" → redirect /dashboard
    │   ├── globals.css       # Tailwind import + design tokens (@theme)
    │   ├── global-error.tsx  # Trang báo lỗi toàn cục
    │   ├── login/page.tsx    # Trang đăng nhập (độc lập, không có sidebar)
    │   ├── (admin)/          # Nhóm trang có sidebar/topbar (AppShell)
    │   │   ├── layout.tsx    # Bọc <AppShell> cho mọi trang admin
    │   │   ├── dashboard/page.tsx
    │   │   ├── orders/page.tsx, orders/new/page.tsx, orders/[orderId]/page.tsx
    │   │   ├── payments/page.tsx
    │   │   ├── reconciliations/page.tsx
    │   │   ├── catalog/page.tsx, categories/page.tsx
    │   │   ├── users/page.tsx
    │   │   ├── barista/page.tsx
    │   │   ├── reports/revenue/page.tsx
    │   │   ├── audit/page.tsx
    │   │   ├── forbidden/page.tsx
    │   ├── admin/page.tsx    # /admin → redirect /dashboard
    │   └── api/
    │       ├── backend/[...path]/route.ts   # ★ PROXY mọi call tới backend
    │       └── auth/login/route.ts, auth/logout/route.ts  # Đăng nhập/đăng xuất JWT
    ├── components/           # Component dùng chung
    │   ├── AppShell.tsx      # Sidebar + topbar + drawer mobile
    │   ├── Toast.tsx         # Hệ thống toast (context)
    │   ├── PeriodFilter.tsx  # Bộ lọc thời gian (Ngày/Tuần/Tháng/Năm)
    │   └── ui.tsx            # Panel, PageHeader, Stats, Badge, Modal, Field, Skeleton...
    └── lib/                  # Logic + tiện ích
        ├── api.ts            # ★ apiRequest + toàn bộ hàm gọi backend + type API
        ├── view-models.ts    # Map ApiOrder (backend) → Order (UI)
        ├── use-api-data.ts   # ★ Hook tải dữ liệu (loading/error/reload)
        ├── data.ts           # Type + nhãn trạng thái + mock data cũ
        ├── format.ts         # formatVnd, formatDateTime, timeAgo...
        ├── period.ts         # Lọc theo kỳ
        └── server-api.ts     # Quản lý cookie session (chỉ chạy phía server)
```

---

## 4. Kiến trúc dữ liệu — "Proxy" là trái tim của FE

Đây là điều quan trọng nhất cần hiểu khi được hỏi **"FE lấy dữ liệu từ đâu?"**

### Dòng chảy request (browser → backend)

```
Trình duyệt (client component)
   │  fetch("/api/backend/admin/orders?limit=500")
   ▼
Next.js API Route  src/app/api/backend/[...path]/route.ts   (chạy phía SERVER)
   │  đọc cookie, thêm header Authorization: Bearer <accessToken>
   │  forward request.method + body tới  ${API_BASE_URL}/${path}
   ▼
Backend Express  http://localhost:3001/api/v1/admin/orders
   ▼
PostgreSQL  (qua Prisma)
```

### Điểm chính của proxy (`route.ts`):
- Build URL đích: `${API_BASE_URL}/${path.join("/")}${search}` với `API_BASE_URL` mặc định `http://127.0.0.1:3001/api/v1` (xem `server-api.ts`).
- **Tự thêm token**: lấy accessToken/refreshToken từ cookie httpOnly rồi gắn `Authorization: Bearer`.
- **Tự refresh token**: nếu backend trả `401` và có refreshToken → gọi `POST /admin/auth/refresh` của backend → lấy token mới → **gửi lại request** → set cookie mới.
- Nếu backend không chạy → trả `503` "API backend chưa sẵn sàng".
- Forward mọi method: GET/POST/PATCH/PUT/DELETE.

### Vì sao thiết kế vậy?
- Giữ **access/refresh token ở cookie httpOnly** (không lộ cho JS) → an toàn hơn.
- Trình duyệt quan trọng là **client component** (`"use client"`), nhưng việc gọi backend có token chỉ nên làm ở **server** (không expose `API_BASE_URL` + secret cho client).
- Nhờ proxy, client chỉ cần gọi `/api/backend/...` cùng origin — **không bị CORS**.

---

## 5. Đăng nhập & phiên (Auth)

### Luồng đăng nhập
1. Trang `/login` (client component) POST `/api/auth/login` với `{ username, password }`.
2. Route `api/auth/login/route.ts` (server) forward tới backend `POST /admin/auth/login`.
3. Nếu `ok` → backend trả `{ data: { accessToken, refreshToken, expiresIn, user } }`.
4. Route này gọi `setSessionCookies()` (trong `server-api.ts`) để đặt 2 cookie:
   - `order_flow_access` — **access token** (maxAge = `expiresIn`, mặc định 15 phút).
   - `order_flow_refresh` — **refresh token** (maxAge = 30 ngày).
   - Cả hai: `httpOnly: true`, `sameSite: "lax"`, `secure` khi production.
5. FE nhận `{ user }` và `router.replace("/dashboard")`.

### Kiểm tra phiên hàng ngày
- `AppShell.tsx` gọi `getCurrentUser()` (= `/api/backend/admin/auth/me`) khi mount.
- Nếu lỗi `401` → `router.replace("/login")` (đá về trang đăng nhập).
- Nếu **access token hết hạn** trong lúc dùng → proxy tự refresh, người dùng **không bị gián đoạn**.
- Nếu **refresh cũng fail** → clear cookie → về login.

### Đăng xuất
- `api/auth/logout/route.ts` (server) gọi backend `POST /admin/auth/logout` với Bearer token, rồi **xóa cookie** (`clearSessionCookies`).

---

## 6. Tầng `lib/` — giải thích từng file

### `lib/api.ts` — Tầng kết nối backend (quan trọng nhất viết bởi FE)
- `apiRequest<T>(path, options)` — hàm gọi chung: `fetch("/api/backend/" + path)`, `cache: "no-store"`, tự `JSON.stringify` body, tự thêm `content-type`.
  - Nếu response `401` và không ở trang `/login` → tự `window.location.href = "/login"`.
  - Ném `ApiError` (message tiếng Việt + status).
- Chứa **toàn bộ type của API backend**: `ApiOrder`, `ApiUser`, `ApiMenuItem`, `ApiCategory`, `ApiSepayTransaction`, `ApiSepayTransactionFull`, `ApiRevenueReport`, `ApiAuditLog`, `Paginated<T>`, `ApiOrderPaymentRecord`, `ApiBaristaOrder`, ...
- Chứa **toàn bộ hàm gọi backend** theo domain:
  - **Đơn hàng**: `getOrders`, `getOrder`, `createOrder`, `addOrderItem`, `updateOrderItem`, `deleteOrderItem`, `cancelOrder`, `refundOrder`, `confirmCash`, `initQrPayment`, `overrideOrderStatus`, `getOrderPayments`.
  - **Barista web**: `getBaristaQueue`, `getActiveBaristas`, `getBaristaOrders`, `claimOrder`, `markOrderReady`, `deliverOrder`.
  - **Thanh toán / Đối soát**: `getTransactions`, `getTransaction`, `getReconciliations`, `resolveReconciliation`.
  - **Báo cáo**: `getRevenueReport(from, to)`.
  - **Thực đơn**: `getCategories`, `getMenuItems`, `getMenuItem`, `createCategory/update/delete`, `createMenuItem/update/delete`.
  - **Nhân sự**: `getEmployees`, `getEmployee`, `createEmployee`, `updateEmployee`, `activateEmployee`, `deactivateEmployee`.
  - **Khác**: `getCurrentUser` (= admin/auth/me), `getAuditLogs`.

> Điểm mấu chốt để trả lời câu hỏi: **mọi chức năng FE đều là một hàm trong `api.ts` gọi tới backend. FE không tự tính nghiệp vụ** (giá, tổng tiền, trạng thái đều do backend trả/cấm).

### `lib/view-models.ts` — Chuyển dữ liệu backend → định dạng UI
- `toOrder(ApiOrder)` → `Order` (view-model của UI): tách tên người tạo ra first/last name, đổi `paymentMethod` "CASH"/"QR" → "cash"/"qr", gộp món thành `productName`, chuyển `REVIEW` → `PAYMENT_REVIEW`, đổi "string" tiền thành `Number`.
- `toPayment(ApiOrder)` → `Payment | null`: quyết định **trạng thái thanh toán hiển thị** dựa trên `paymentStatus` + `sepayTransactions[0].matchStatus` (MATCHED → matched, WRONG_CODE → unknown_code, UNDERPAID/OVERPAID → tương ứng,...).

> Trang Thanh toán & Đối soát không dùng file này mà tự viết hàm map riêng (`toPaymentView`, `toReconciliation`) trong từng `page.tsx` — vì chúng đọc thẳng `ApiSepayTransactionFull`.

### `lib/use-api-data.ts` — Hook tải dữ liệu chuẩn cho mọi trang
- `useApiData(loader, initialValue)` trả về `{ data, setData, loading, error, reload }`.
- Cách hoạt động:
  - Lần đầu tải → `loading = true`.
  - **Reload sau đó GIỮ dữ liệu cũ trên màn hình** (không flash "Đang tải...") — chỉ thay dữ liệu khi fetch xong.
  - Có guard chống `setState` sau khi component unmount (`aliveRef`).
  - Fetch lần đầu được defer qua microtask (`Promise.resolve().then(reload)`) để tránh lint rule `react-hooks/set-state-in-effect`.

### `lib/data.ts` — Type + nhãn (và mock data cũ)
- Chứa **các type/union trạng thái** dùng chung: `OrderPaymentStatus`, `OrderFulfillmentStatus`, `PaymentStatus`, `ReconciliationClassification`,...
- Chứa **bảng nhãn tiếng Việt** cho từng trạng thái (VD `ORDER_PAYMENT_STATUS_LABEL`, `ORDER_FULFILLMENT_STATUS_LABEL`, `PAYMENT_STATUS_LABEL`, `RECONCILIATION_*_LABEL`...).
- ⚠️ **Còn rất nhiều mock data cũ** ở cuối file: `categories[]`, `products[]`, `orders[]`, `payments[]`, `reconciliations[]`, `revenueDays[]`, `settings`, `dashboardStats`... Đây là **dữ liệu demo còn sót từ UI prototype** — **các trang hiện tại KHÔNG còn dùng** (theo README, UI đã chuyển sang dữ liệu thật qua backend). Chỉ phần **type + label** là đang được import và dùng.

### `lib/format.ts` — Định dạng hiển thị
- `formatVnd()` → `1.234.567 ₫` (vi-VN).
- `formatDateTime / formatDate / formatTime`.
- `timeAgo()` → "5 phút trước", "2 giờ trước"...

### `lib/period.ts` — Lọc theo kỳ
- `Period = "day" | "week" | "month" | "year"`.
- `periodRange()` tính khoảng từ/đến (tuần bắt đầu thứ 2).
- `inPeriod()` kiểm tra 1 mốc thời gian có nằm trong kỳ không (`""` = tất cả).

### `lib/server-api.ts` — Chỉ chạy phía server (route API của Next)
- Khai báo tên cookie, `API_BASE_URL`, và 3 hàm: `setSessionCookies`, `clearSessionCookies`, `readSessionTokens`. Dùng bởi các route `api/auth/login|logout` và proxy `/api/backend`.

---

## 7. `components/` — Thành phần dùng chung

### `ui.tsx` — Thư viện UI "tự chế" (không dùng thư viện ngoài)
- `Panel` — thẻ/card có tiêu đề + subtitle + vùng `right`.
- `PageHeader` — đầu trang (title + description + action bên phải).
- `Stats` — hàng thẻ KPI (auto grid theo số lượng item, có màu tone).
- `Badge` — huy hiệu trạng thái (tone: green/amber/red/blue/gray/teal/violet).
- `Modal` — hộp thoại (dùng `<dialog>`, có variant `wide`).
- `Field` — label + children (cho form).
- `EmptyState`, `Spinner`, `PageLoading`, `Skeleton`.
- Các badge phụ: `RankBadge`, `FulfillmentBadge`.
- Hàm màu: `orderPaymentTone`, `orderFulfillmentTone`, `paymentTone` (map trạng thái → màu badge).

### `AppShell.tsx` — Khung bố cục admin (client)
- Sidebar tối/trắng bên trái (desktop), **drawer** cho mobile.
- Topbar: tiêu đề + tên người dùng + avatar (lấy từ `getCurrentUser`).
- Gọi `getCurrentUser()` khi mount để kiểm tra phiên (401 → về login).
- Icon đều là **SVG inline tự vẽ** (không dùng thư viện icon).
- Các mục menu: Dashboard, Đơn hàng, Thanh toán, Đối soát, Thực đơn (Catalog), Danh mục, Pha chế (Barista), Báo cáo, Nhân viên, Nhật ký.

### `Toast.tsx` — Hệ thống thông báo (Context)
- `ToastProvider` bọc app; `useToast().push(message, "success"|"error"|"warning")`.
- Tự đóng sau 4s (trừ error). Giữ tối đa 4 toast (`[...prev.slice(-3), new]`).

### `PeriodFilter.tsx` — Dải nút chọn kỳ thời gian (Tất cả/Ngày/Tuần/Tháng/Năm).

---

## 8. Từng trang (route) — nhiệm vụ & logic chính

Mọi trang admin đều là **client component** (`"use client"`) nằm trong nhóm `(admin)` (được bọc `AppShell`), dùng `useApiData` để tải dữ liệu.

| Route | File | Nhiệm vụ |
|---|---|---|
| `/` | `page.tsx` | Redirect → `/dashboard` |
| `/login` | `login/page.tsx` | Đăng nhập admin |
| `/admin` | `admin/page.tsx` | Redirect → `/dashboard` |
| `/dashboard` | `dashboard/page.tsx` | KPI, biểu đồ doanh thu 7 ngày, đơn mới, giao dịch cần chú ý |
| `/orders` | `orders/page.tsx` | Danh sách đơn + lọc/tìm + hủy đơn + override |
| `/orders/new` | `orders/new/page.tsx` | Tạo đơn thủ công (chọn món, SL, người tạo) |
| `/orders/[orderId]` | `orders/[orderId]/page.tsx` | Chi tiết đơn: items, timeline, thanh toán, thêm/sửa món, hoàn tiền |
| `/payments` | `payments/page.tsx` | Danh sách giao dịch SePay + chi tiết |
| `/reconciliations` | `reconciliations/page.tsx` | Đối soát giao dịch + resolve (chấp nhận/từ chối/hoàn tiền...) |
| `/catalog` | `catalog/page.tsx` | Quản lý món (thêm/sửa/xóa/bật-tắt bán) |
| `/categories` | `categories/page.tsx` | Quản lý danh mục |
| `/users` | `users/page.tsx` | Quản lý nhân viên (thêm/sửa/khóa) |
| `/barista` | `barista/page.tsx` | Hàng đợi pha chế: nhận đơn → READY → DELIVERED |
| `/reports/revenue` | `reports/revenue/page.tsx` | Báo cáo doanh thu theo ngày + biểu đồ |
| `/audit` | `audit/page.tsx` | Nhật ký thao tác (audit log) |
| `/forbidden` | `forbidden/page.tsx` | Trang "không có quyền" |

### Logic đáng chú ý từng trang

**Dashboard:**
- `stats` tính từ `data.orders`: revenue (chỉ đơn không CANCELLED), avg/order, pendingPayment, queued.
- `RevenueChart`: tự sinh **biểu đồ cột 7 ngày** chỉ từ list orders (nhóm theo ngày, đếm đơn PAID). Không gọi API riêng.
- `AttentionPanel`: lọc giao dịch Thiếu/Thừa/Sai mã từ `admin/transactions`; bấm card → `/payments?needsReview=1&code=...`.

**Đơn hàng (`/orders`):**
- Lọc phía client (client-side): tìm kiếm, lọc trạng thái thanh toán/thực hiện, "chỉ đơn cần xử lý" (`needsAction=1`), lọc theo kỳ.
- Đơn `PAYMENT_REVIEW` hoặc `QUEUED` được tô nền đỏ.
- Hành động: **Hủy đơn** (modal nhập lý do → `cancelOrder`), **Xử lý xong** (`deliverOrder` đưa QUEUED → DELIVERED), **Bỏ kiểm tra** (`overrideOrderStatus` REVIEW → PAID).
- Dùng `Suspense` vì dùng `useSearchParams`.

**Chi tiết đơn (`/orders/[orderId]`):**
- Trang phức tạp nhất: hiển thị items, timeline (từ `order.timeline`), thông tin thanh toán.
- Có **QR giả lập** (`FakeQR`) sinh hoa văn từ mã đơn (không phải QR thật để quét).
- Hành động theo trạng thái: Xác nhận tiền mặt (`confirmCash`), Chuyển khoản QR (`initQrPayment`), Hoàn tiền (`refundOrder`), Hủy (`cancelOrder`), Thêm/Sửa/Xóa món (`addOrderItem`...) với ràng buộc (khi đã thanh toán không sửa được — backend trả 409).
- Timeline tone/glabel dựa vào `statusDomain` (PAYMENT/FULFILLMENT).

**Thanh toán (`/payments`):**
- Đọc thẳng `admin/transactions` (SePay), tự map `toPaymentView` để tính trạng thái hiển thị (matched/underpaid/overpaid/unknown_code).
- Lọc theo mã/trạng thái; bộ lọc `needsReview` sync với URL query (`useSearchParams` + `router.replace`).
- Khi chưa liên kết đơn → gợi ý qua trang Đối soát.

**Đối soát (`/reconciliations`):**
- Map `toReconciliation`: phân loại 5 loại (matched/underpaid/overpaid/unknown_code/duplicate).
- Hành động resolve: ACCEPT / REJECT / REFUND_REQUIRED / LINK_MANUALLY / NONE → gọi `resolveReconciliation` (cần `resolvedByUserId` = admin hiện tại).

**Barista (`/barista`):**
- Chọn Barista (active) → xem hàng đợi QUEUED + đơn đang xử lý của barista đó.
- Hành động: **Nhận đơn** (`claimOrder`) → **Hoàn thành READY** (`markOrderReady`) → **Giao món DELIVERED** (`deliverOrder`).
- Lưu ý nghiệp vụ: `claimOrder` là **atomic claim** — 2 admin nhấn cùng lúc chỉ 1 người thắng (backend chặn, FE hiện lỗi 409).

**Báo cáo doanh thu (`/reports/revenue`):**
- Tự tải ngay với **30 ngày gần nhất**, không cần nút.
- Thay đổi ngày/bộ lọc phương thức → `reload()` tự chạy lại (useApiData), biểu đồ + bảng cập nhật tức thì.
- Chỉ vẽ/năm những ngày **có giao dịch > 0** (filter `orderCount > 0 || refundCount > 0`).

**Nhật ký (`/audit`):**
- Chỉ đọc `admin/audit-logs`, render bảng. `details` là JSON hiển thị thu gọn.

---

## 9. Các khái niệm nghiệp vụ quan trọng (để trả lời chính xác)

### Vai trò người dùng (`role`)
`OWNER` (chủ quản) / `SERVICE_STAFF` (phục vụ, dùng Bot) / `BARISTA` (pha chế, dùng Bot).
Web admin chủ yếu dùng cho `OWNER`; staff/barista thao tác qua Telegram.

### Trạng thái thanh toán đơn (`paymentStatus` của ApiOrder)
`UNPAID` (chưa thanh toán) · `PENDING` (chờ xác nhận) · `PAID` (đã thanh toán) · `UNDERPAID` (thiếu) · `OVERPAID` (thừa) · `REVIEW` (cần kiểm tra).
> FE đổi `REVIEW` → hiển thị là `PAYMENT_REVIEW` ("Cần kiểm tra").

### Trạng thái thực hiện (`fulfillmentStatus`)
`PENDING_PAYMENT` → `QUEUED` → `PREPARING` → `READY` → `DELIVERED`; và `CANCELLED`.

### Giao dịch SePay & Đối soát
- SePay = cổng nhận **chuyển khoản QR**, gửi webhook/transaction vào hệ thống.
- Mỗi giao dịch có `matchStatus`: `UNMATCHED` / `MATCHED` / `WRONG_CODE` (sai mã) / `REVIEWED`.
- FE hiển thị trên 2 trang khác nhau từ **cùng một nguồn** `admin/transactions`:
  - Trang **Thanh toán** → nhìn theo giao dịch.
  - Trang **Đối soát** → nhìn theo phân loại (matched/underpaid/overpaid/unknown_code/duplicate) và cho resolve.

---

## 10. Hệ thống thiết kế (design tokens) — `globals.css`

Dùng Tailwind v4 với `@theme` để khai báo màu:
- `--color-canvas: #f2f4f3`, `--color-surface: #ffffff`.
- `--color-ink: #1a2421` (chữ chính), `--color-muted: #6b7a75` (chữ mờ).
- Bảng màu **brand green** (`--color-brand-50..900`) và **deep forest** (`--color-forest-600..950`) cho card tối/KPI.
- `--font-sans: "Be Vietnam Pro", ...`.

**Quy ước class CSS tùy chỉnh** (định nghĩa trong globals.css phần sau): `card`, `btn`, `btn-ghost`, `btn-danger`, `input`, `th`/`td`, `eyebrow`, `bar-striped`, `line`/`line-soft`... — các trang sử dụng rải rác những class này.

> PHONG CÁCH: không dùng thư viện UI ngoài (như shadcn/MUI), toàn bộ component tự viết bằng Tailwind trong `ui.tsx` + `globals.css`.

---

## 11. Những "cạm bẫy" / lưu ý khi được hỏi

1. **FE không có DB** — mọi dữ liệu qua proxy `/api/backend/*` tới backend Express.
2. **`lib/data.ts` có mock data cũ** — đừng nhầm là dữ liệu thật; các trang hiện không dùng chúng (chỉ dùng type + label).
3. **Build** đang phải dùng cờ `--debug-prerender` vì bug Next 16.3 + React 19.2 (trang `/_global-error`). Khi Next fix có thể bỏ.
4. **Next.js 16 khác Next.js cũ** — đọc `node_modules/next/dist/docs/` trước khi viết code mới.
5. **Auth** là JWT access(15') + refresh(30 ngày) trong **cookie httpOnly**, refresh tự động qua proxy. Nếu refresh fail → về `/login`.
6. **Toàn bộ tính toán nghiệp vụ nằm ở backend** — FE chỉ map & hiển thị. VD: giá/tổng tiền/trạng thái do backend trả; concurrency (2 barista nhận 1 đơn) do backend chặn (409).
7. Interface của FE (view-model) **khác** type API — luôn có hàm map (`view-models.ts` hoặc map nội bộ từng trang).

---

## 12. Tài liệu liên quan

- `README.md` — tổng quan ngắn, danh sách trang đã nối backend, cách chạy.
- `TESTING.md` — checklist kiểm thử thủ công toàn bộ tính năng (rất hữu ích để hiểu hành vi kỳ vọng).
- Backend: `backend/` (API Express), `backend/apps/telegram-bot` (Bot).
- Map tổng repo: `AGENTS.md` ở root.
