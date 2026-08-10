# Bot Tele — Web Admin (Next.js + Tailwind)

Giao diện quản trị (admin UI) cho hệ thống Order Flow — Next.js App Router + React 19, dữ liệu **đọc/ghi trực tiếp từ backend Express + PostgreSQL** thông qua route proxy `/api/backend`.

> ⚠️ Bản UI prototype cũ dùng mock data tĩnh đã được thay thế: `src/lib/data.ts` chỉ còn giữ **type & nhãn trạng thái** dùng chung, không còn fixture dữ liệu.

## Công nghệ

- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4**
- Font **Be Vietnam Pro** (self-hosted, giữ subset tiếng Việt)
- Backend API: `backend/apps/api` (Express) — gọi qua route proxy `src/app/api/backend/[...path]/route.ts`
- Auth: login qua `src/app/api/auth/login/route.ts` (admin JWT từ backend)

## Chạy

```bash
npm install
npm run dev        # http://localhost:3000/login
npm run build      # build production
npm run start      # chạy bản production
```

Cần backend đang chạy tại `API_UPSTREAM_URL` (mặc định `http://localhost:3001`) để proxy trả dữ liệu thật.

## Trang đã nối backend

| Khu vực | Trang | API |
|---|---|---|
| Tổng quan | Dashboard (`/dashboard`) | `admin/orders` |
| Bán hàng | Đơn hàng (`/orders`), Chi tiết đơn (`/orders/[id]`) | `admin/orders`, `orders/:id/payments/*` |
| Bán hàng | Thanh toán (`/payments`) | `admin/orders` → view-model |
| Bán hàng | Đối soát (`/reconciliations`) | `admin/transactions`, `admin/reconciliations/:id/resolve` |
| Thực đơn | Catalog (`/catalog`), Danh mục (`/categories`) | `admin/menu-items`, `admin/menu-categories` |
| Nhân sự | Nhân viên (`/users`) | `admin/employees` |
| Báo cáo | Doanh thu (`/reports/revenue`) | `admin/reports/revenue` |
| Hệ thống | Nhật ký (`/audit`) | `admin/audit-logs` |

> Trang Cấu hình (`/settings`) đã được gỡ — backend chưa có API cấu hình nên trang chỉ toàn dữ liệu demo, không nối được dữ liệu thật.

## Cấu trúc

```
src/
├── app/
│   ├── login/            # Trang đăng nhập (độc lập, không sidebar)
│   ├── (admin)/          # Nhóm trang có layout sidebar/topbar
│   │   └── layout.tsx    # Bọc AppShell
│   └── api/
│       ├── backend/[...path]/route.ts   # Proxy mọi call tới backend Express
│       └── auth/login|logout/route.ts   # Đăng nhập/đăng xuất admin JWT
├── components/
│   ├── AppShell.tsx      # Sidebar tối + topbar + drawer mobile
│   ├── Toast.tsx         # Hệ thống toast
│   └── ui.tsx            # Panel, Badge, Modal, Stats, Field...
└── lib/
    ├── api.ts            # apiRequest + toàn bộ hàm gọi backend + types API
    ├── view-models.ts    # Map ApiOrder → Order / Payment (view-model)
    ├── use-api-data.ts   # Hook tải dữ liệu (loading/error/reload)
    ├── data.ts           # Type & nhãn trạng thái dùng chung (không mock)
    ├── format.ts         # formatVnd, formatDateTime...
    └── period.ts         # Lọc theo kỳ (hôm nay/tuần/tháng)
```

## Kiểm thử

Checklist kiểm thử thủ công toàn bộ tính năng (đăng nhập, đơn hàng, thanh toán, đối soát, barista, báo cáo...) nằm ở [TESTING.md](./TESTING.md).

## Lưu ý kỹ thuật

- **Build**: đang dùng `next build --debug-prerender` vì Next.js 16.3 + React 19.2 có bug upstream khi prerender trang `/_global-error`.
- **Proxy**: mọi request đi qua `/api/backend/*`; nếu backend chưa sẵn sàng trả `503` với message rõ ràng.
- **Cấu hình cần thiết**: `BOT_INTERNAL_SECRET` ở backend và `.env.local` để admin JWT hoạt động.
