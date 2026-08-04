# Bot Tele — Web Admin (Next.js + Tailwind)

Giao diện quản trị (admin UI) cho Bot Telegram bán sản phẩm số — **bản UI prototype thuần túy**, dữ liệu demo tĩnh, không phụ thuộc server/database.

> ⚠️ Dự án cũ (Express + EJS + Prisma + bot Telegram) đã được **xóa hoàn toàn** và thay thế bằng bản chuyển đổi này theo yêu cầu. Backup đầy đủ của bản cũ nằm tại `/tmp/bot-qlct-backup/bot-qlct-full-backup.tar.gz`.

## Công nghệ

- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4**
- Font **Be Vietnam Pro** (self-hosted, giữ subset tiếng Việt)
- Mock data tập trung tại `src/lib/data.ts`

## Chạy

```bash
npm install
npm run dev        # http://localhost:3000/login — tài khoản demo: admin / admin12345
npm run build      # build production
npm run start      # chạy bản production
```

## Trang

| Khu vực | Trang |
|---|---|
| Tổng quan | Dashboard (`/dashboard`) |
| Bán hàng | Đơn hàng, Thanh toán, Khách hàng, Bảo hành |
| Kho hàng | Sản phẩm & kho (3 tab), Catalog, Danh mục, Nhà cung cấp |
| Marketing | Broadcast |
| Hệ thống | Cấu hình, Nhật ký |
| Khác | Đăng nhập, Không có quyền |

## Cấu trúc

```
src/
├── app/
│   ├── login/            # Trang đăng nhập (độc lập, không sidebar)
│   ├── (admin)/          # Nhóm trang có layout sidebar/topbar
│   │   ├── layout.tsx    # Bọc AppShell
│   │   ├── dashboard/    # + orders, payments, users, warranties, stock,
│   │   │                 #   stock/[id], stock-service/[id], catalog,
│   │   │                 #   categories, suppliers, broadcasts, settings, audit, forbidden
│   └── global-error.tsx
├── components/
│   ├── AppShell.tsx      # Sidebar tối + topbar + drawer mobile
│   ├── Toast.tsx         # Hệ thống toast
│   └── ui.tsx            # Panel, Badge, Modal, Stats, Field...
├── lib/
│   ├── data.ts           # Toàn bộ mock data tiếng Việt
│   └── format.ts         # formatVnd, formatDateTime...
└── app/globals.css       # Tailwind v4 theme (màu teal brand) + font
```

## Lưu ý kỹ thuật

- **Build**: đang dùng `next build --debug-prerender` vì Next.js 16.3 + React 19.2 có bug upstream khi prerender trang `/_global-error` (đã tái hiện trên scaffold hoàn toàn mới). Khi Next fix có thể bỏ cờ này ở `package.json`.
- Mọi form/thao tác là demo: gửi lên đều hiển thị toast, dữ liệu chỉ đổi trong state của trang.
