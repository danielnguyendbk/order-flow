# 📌 PROJECT.md

# OrderFlow

> Hệ thống quản lý vận hành dành cho doanh nghiệp F&B vừa và nhỏ

---

# 1. Tổng quan dự án

## 1.1 Giới thiệu

OrderFlow là hệ thống hỗ trợ quản lý quy trình vận hành dành cho các cửa hàng F&B quy mô vừa và nhỏ như quán cà phê, trà sữa, quán ăn nhanh và nhà hàng.

Hệ thống giúp số hóa toàn bộ quy trình từ tạo đơn, thanh toán, pha chế, giao món đến theo dõi doanh thu thông qua Telegram Bot và Website quản trị.

## 1.2 Thông tin dự án

| Thuộc tính | Giá trị |
|------------|----------|
| Tên dự án | OrderFlow |
| Loại dự án | F&B Operations Management Platform |
| Kiến trúc | Modular Monolith |
| Backend | Node.js + Express.js + TypeScript |
| Frontend | Next.js |
| Telegram Bot | Telegraf.js |
| Database | PostgreSQL |
| ORM | Prisma |
| Thanh toán | Cash + SePay QR |

---

# 2. Bài toán đặt ra

Các cửa hàng F&B quy mô nhỏ hiện nay vẫn vận hành chủ yếu bằng giấy, ghi nhớ hoặc các công cụ rời rạc, dẫn đến nhiều bất cập trong quá trình phục vụ khách hàng.

Các vấn đề phổ biến bao gồm:

- Ghi sai hoặc thiếu món khi nhận order.
- Khó theo dõi tiến độ pha chế.
- Khó xác minh khách đã thanh toán chuyển khoản.
- Không có quy trình xử lý đơn thống nhất.
- Không theo dõi được lịch sử thao tác của nhân viên.
- Khó tổng hợp doanh thu cuối ngày.

---

# 3. Mục tiêu dự án

## 3.1 Mục tiêu kinh doanh

- Chuẩn hóa quy trình Order → Thanh toán → Pha chế → Giao món.
- Giảm sai sót trong quá trình vận hành.
- Rút ngắn thời gian xử lý đơn.
- Tự động xác nhận thanh toán QR.
- Hỗ trợ quản lý doanh thu theo thời gian thực.

## 3.2 Mục tiêu kỹ thuật

- Xây dựng RESTful API theo kiến trúc Modular Monolith.
- Áp dụng JWT Authentication và Role-Based Access Control.
- Chuẩn hóa API bằng Swagger/OpenAPI.
- Triển khai bằng Docker.
- Tích hợp Telegram Bot và SePay.
- Đảm bảo hệ thống có Integration Test và End-to-End Test.

---

# 4. Khách hàng mục tiêu

## Đối tượng

- Quán cà phê
- Quán trà sữa
- Quán ăn nhanh
- Nhà hàng nhỏ
- Quầy đồ uống

## Đặc điểm

- Quy mô từ 3 đến 30 nhân viên.
- Khoảng 50–500 đơn hàng mỗi ngày.
- Không sử dụng hệ thống POS phức tạp.
- Mong muốn triển khai nhanh với chi phí thấp.
- Nhân viên sử dụng Telegram trong công việc hằng ngày.

---

# 5. Pain Points

## Nhân viên phục vụ

- Dễ ghi sai order.
- Khó theo dõi trạng thái đơn.
- Không biết món đã hoàn thành hay chưa.

## Nhân viên pha chế

- Không biết đơn nào đã thanh toán.
- Dễ bỏ sót đơn.
- Không có hàng đợi xử lý rõ ràng.

## Quản lý

- Khó kiểm soát doanh thu.
- Khó xác minh chuyển khoản.
- Thiếu báo cáo và lịch sử thao tác.
- Không theo dõi được hiệu suất làm việc.

---

# 6. Giải pháp đề xuất

OrderFlow cung cấp một nền tảng quản lý tập trung bao gồm:

- Telegram Bot dành cho nhân viên phục vụ.
- Telegram Bot dành cho nhân viên pha chế.
- Website quản trị.
- Thanh toán tiền mặt và QR.
- Tích hợp SePay để xác nhận giao dịch tự động.
- Dashboard doanh thu.
- Notification theo thời gian thực.
- Audit Log.

---

# 7. Phạm vi dự án

## Trong phạm vi (In Scope)

- Quản lý nhân viên.
- Quản lý thực đơn.
- Quản lý đơn hàng.
- Thanh toán tiền mặt.
- Thanh toán QR.
- Tích hợp SePay.
- Telegram Bot.
- Dashboard quản trị.
- Báo cáo doanh thu.
- Notification.

## Ngoài phạm vi (Out of Scope)

- Quản lý kho.
- Chương trình khách hàng thân thiết.
- Mobile App.
- Quản lý nhiều chi nhánh.
- AI Recommendation.

---

# 8. Các phân hệ chính

| Phân hệ | Chức năng |
|----------|-----------|
| Authentication | Đăng nhập và phân quyền |
| Employee | Quản lý nhân viên |
| Menu | Quản lý danh mục và món |
| Order | Quản lý đơn hàng |
| Kitchen | Quản lý pha chế |
| Payment | Thanh toán |
| SePay | Xác nhận giao dịch |
| Revenue | Báo cáo doanh thu |
| Notification | Thông báo Telegram |
| Audit | Lưu lịch sử thao tác |

---

# 9. Kiến trúc hệ thống

```text
Telegram Bot
        │
        ▼
Express REST API
        │
 ┌─────────────┐
 │             │
 ▼             ▼
PostgreSQL  SePay
        │
        ▼
Admin Dashboard
```

---

# 10. Cơ cấu nhóm phát triển

| Thành viên | Vai trò | Phạm vi phụ trách |
|------------|----------|-------------------|
| Nhân | Kỹ sư Nền tảng Backend | Authentication, Authorization, Employee, Menu, Shared Infrastructure |
| Tâm | Kỹ sư Phát triển Nghiệp vụ Backend | Order, Kitchen Workflow, Delivery |
| Thái | Kỹ sư Hệ thống Thanh toán | Payment, SePay, Revenue, Reconciliation |
| Khoa | Kỹ sư Tích hợp Hệ thống | Telegram Bot, Notification, Integration, E2E Testing |
| Đạt | Kỹ sư Frontend | Website quản trị và Dashboard |

---

# 11. Kế hoạch phát triển

| Giai đoạn | Nội dung |
|------------|----------|
| Sprint 1 | Foundation, Authentication, Employee, Menu |
| Sprint 2 | Order Management |
| Sprint 3 | Payment & SePay |
| Sprint 4 | Telegram Bot |
| Sprint 5 | Dashboard & Testing |
| Sprint 6 | Integration & Deployment |

---

# 12. Tiêu chí hoàn thành

Dự án được xem là hoàn thành khi đáp ứng các điều kiện sau:

- Hoàn thành đầy đủ các chức năng trong phạm vi MVP.
- Telegram Bot hoạt động ổn định.
- Thanh toán Cash và QR hoạt động chính xác.
- SePay xác nhận giao dịch tự động.
- Dashboard hiển thị doanh thu đúng.
- API được tài liệu hóa bằng Swagger.
- Có Integration Test và End-to-End Test.
- Toàn bộ chức năng được kiểm thử và nghiệm thu.

---

# 13. Quy trình phát triển

```text
Phân tích yêu cầu
        ↓
Thiết kế cơ sở dữ liệu
        ↓
Thiết kế API
        ↓
Phát triển Backend
        ↓
Phát triển Telegram Bot
        ↓
Phát triển Frontend
        ↓
Kiểm thử tích hợp
        ↓
Triển khai hệ thống
```

---

# 14. Công nghệ sử dụng

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- BullMQ
- Telegraf.js
- Next.js
- Docker
- Swagger
- Jest
- Supertest


