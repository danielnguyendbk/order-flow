# Hướng dẫn kiểm thử Web Admin (FE) — Order Flow

File này là **checklist kiểm thử thủ công** cho toàn bộ giao diện quản trị. Mọi chức năng đều đọc/ghi dữ liệu **thật** từ backend Express + PostgreSQL qua proxy `/api/backend/*`.

---

## 1. Chuẩn bị môi trường

### Backend + Database

```bash
# 1. Khởi động PostgreSQL + Redis (thư mục backend/)
cd backend
docker compose up -d postgres redis

# 2. Đảm bảo file `.env.local` ở root repo có:
#    DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, BOT_INTERNAL_SECRET,
#    SEED_OWNER_USERNAME, SEED_OWNER_PASSWORD (tham khảo .env.example)

# 3. Tạo Prisma client + seed dữ liệu mẫu
npm run generate:prisma
npm run db:seed            # tạo tài khoản OWNER
npm run seed:thai006       # dữ liệu demo: danh mục, món, nhân viên, đơn hàng, giao dịch

# 4. Chạy API
npm run dev:api            # http://localhost:3001
```

> Nếu cần webhook SePay để test luồng QR: `npm run dev:notification-worker` (tùy chọn).

### Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:3000
```

### Đăng nhập

Mở `http://localhost:3000` → tự chuyển về `/login`. Dùng đúng **username/password** đã khai trong `SEED_OWNER_USERNAME` / `SEED_OWNER_PASSWORD` (mặc định thường là `owner`).

> Nếu thấy **"API backend chưa sẵn sàng" (503)** → backend chưa chạy hoặc sai `API_UPSTREAM_URL`.
> Nếu thấy **401 khi điều hướng** → phiên hết hạn, FE tự refresh token; nếu refresh lỗi sẽ đưa về trang login.

---

## 2. Checklist theo trang

### 2.1 Đăng nhập / Phiên (`/login`)

- [ ] Đăng nhập sai mật khẩu → hiện lỗi đỏ, không vào được.
- [ ] Đăng nhập đúng → chuyển về `/dashboard`.
- [ ] Bấm **Đăng xuất** (góc dưới sidebar) → về `/login`, quay lại `/dashboard` phải bị đá ra.
- [ ] (Nâng cao) Để hết hạn access token 15 phút, thao tác tiếp vẫn chạy (proxy tự refresh).

### 2.2 Tổng quan (`/dashboard`)

- [ ] 4 thẻ KPI: Doanh thu đã thu, TB/đơn, Chờ thanh toán, Đang chờ pha chế — số khớp dữ liệu thật.
- [ ] Biểu đồ **Doanh thu theo ngày** (7 ngày gần nhất có đơn PAID).
- [ ] Panel **Cần chú ý**: chỉ gồm giao dịch Thiếu/Thừa/Sai mã; bấm vào card → `/payments` **đã lọc đúng mã** giao dịch đó.
- [ ] **Đơn mới nhất**: 8 đơn gần nhất, có mã đơn + trạng thái.
- [ ] Nút **Làm mới** → dữ liệu cập nhật **không bị flash màn hình "Đang tải"**.

### 2.3 Đơn hàng — danh sách (`/orders`)

- [ ] Bảng hiển thị: mã đơn, vị trí, món, tổng tiền, hình thức, người tạo, trạng thái, thời gian.
- [ ] Tìm kiếm theo mã đơn/username/món.
- [ ] Lọc **TT Thanh toán**, **TT Thực hiện**, tick **Chỉ đơn cần xử lý**.
- [ ] Đơn trạng thái **Cần kiểm tra (PAYMENT_REVIEW)** hoặc **QUEUED** được tô nền đỏ.
- [ ] Nút **Bỏ kiểm tra** (đơn REVIEW) → chuyển sang PAID.
- [ ] Nút **Xử lý xong** (đơn QUEUED) → modal ghi chú → DELIVERED.
- [ ] Nút **Hủy đơn** (đơn PENDING/UNPAID) → CANCELLED.
- [ ] Nút **+ Tạo đơn** ở góc phải → sang `/orders/new`.

### 2.4 Tạo đơn thủ công (`/orders/new`)

- [ ] Chọn **Người tạo** (mặc định là chính admin, hoặc chọn nhân viên phục vụ).
- [ ] Chọn **Phương thức thanh toán**: Tiền mặt / Chuyển khoản QR.
- [ ] Nhập **Vị trí / ghi chú đơn**.
- [ ] Thêm nhiều dòng món (chọn theo danh mục, chỉ hiện món đang bán), sửa SL + ghi chú từng món; tổng tiền tự tính.
- [ ] Không chọn món nào → báo lỗi "chọn ít nhất một món".
- [ ] Bấm **Tạo đơn** → toast thành công → tự chuyển sang **Chi tiết đơn** vừa tạo.
- [ ] Đơn mới có trạng thái **Chưa thanh toán / Chờ thanh toán** và đã có bản ghi thanh toán.

### 2.5 Chi tiết đơn (`/orders/[id]`)

**Món trong đơn**
- [ ] Bảng món: tên, ghi chú món, đơn giá, SL, thành tiền, tổng cộng.
- [ ] Đơn còn **UNPAID + PENDING_PAYMENT** → có nút **+ Thêm món**, nút **Sửa / Xóa** từng dòng (món cuối không xóa được).
- [ ] Thêm/sửa/xóa món → **tổng tiền tự tính lại**, toast thành công.
- [ ] Đơn đã thanh toán → không còn nút sửa món (backend chặn 409).

**Thanh toán**
- [ ] Đơn tiền mặt chưa thanh toán → **Xác nhận tiền mặt** → PAID.
- [ ] Đơn QR chưa thanh toán → **Khởi tạo QR** → hiện nội dung chuyển khoản → **Đã nhận tiền (PAID)**.
- [ ] Đơn thiếu tiền (UNDERPAID) → nút **Xác nhận đã thu đủ** (+số thiếu) và **Hoàn lại số đã nhận**.
- [ ] Đơn PAID/OVERPAID → **Hoàn tiền** (nhập số tiền + lý do bắt buộc) → REFUNDED.

**Hủy / đổi trạng thái**
- [ ] Nút **Hủy đơn** chỉ hiện khi trạng thái PENDING_PAYMENT/QUEUED/PREPARING; lý do bắt buộc.
- [ ] Dropdown **Đổi trạng thái thực hiện** (admin override) vẫn hoạt động với đơn không ở trạng thái cuối.

**Timeline**
- [ ] Chuỗi sự kiện theo thời gian: tạo đơn → thanh toán → xử lý → giao; mỗi bước đều có ghi chú + người thực hiện.

### 2.6 Thanh toán (`/payments`)

- [ ] Thống kê: Tổng, Đã khớp, Chờ SePay, Cần kiểm tra (Lệch), Tổng tiền thu.
- [ ] Lọc theo trạng thái (Chờ khớp / Đã khớp / Thiếu / Thừa / Sai mã).
- [ ] Tick **Chỉ dòng cần xử lý** → chỉ còn dòng Thiếu/Thừa/Sai mã (tô nền đỏ).
- [ ] Nút **Chi tiết** → modal chỉ đọc: SePay ID, số tiền, chênh lệch, đơn liên quan, hướng dẫn xử lý tại Đơn hàng/Đối soát.
- [ ] Không còn các nút "Duyệt & giao hàng"/"Xóa giao dịch" (đã gỡ).

### 2.7 Đối soát (`/reconciliations`)

- [ ] Thống kê: Đúng tiền, Sai lệch, Sai mã, Trùng lặp, Đã xử lý.
- [ ] Mã đơn liên quan là link → bấm sang được Chi tiết đơn.
- [ ] Giao dịch **Chưa xử lý** → nút **Xử lý** → modal chọn cách xử lý (ACCEPT/REJECT/REFUND_REQUIRED/LINK_MANUALLY/NONE) + ghi chú → lưu thành công, chuyển thành "Đã xử lý".
- [ ] Giao dịch **Đã xử lý** → nút **Chi tiết** hiển thị người xử lý, thời gian, ghi chú.
- [ ] Lọc theo phân loại / trạng thái / thời gian (Ngày/Tuần/Tháng/Năm).

### 2.8 Thực đơn — Catalog (`/catalog`)

- [ ] Form **Thêm món**: danh mục, tên, giá, thứ tự, mô tả → thêm thành công, xuất hiện trong bảng.
- [ ] Nút **Tắt bán / Bật bán** → đổi trạng thái.
- [ ] Nút **Xóa** → có hộp thoại xác nhận → xóa món khỏi thực đơn.

### 2.9 Danh mục (`/categories`)

- [ ] Thống kê: Tổng, Đang bật, Món trong thực đơn.
- [ ] **Thêm danh mục** (modal): tên + thứ tự.
- [ ] **Sửa** (đổi tên/đóng bật) và **Xóa** (chỉ khi không còn món; nếu còn món → báo lỗi).

### 2.10 Nhân viên (`/users`)

- [ ] Danh sách: họ tên, @username, Telegram ID, vai trò, trạng thái.
- [ ] **Thêm nhân viên**: họ tên, username, Telegram ID, vai trò (Phục vụ/Pha chế).
- [ ] **Sửa** nhân viên (modal điền sẵn dữ liệu).
- [ ] **Khóa / Mở** tài khoản → đổi trạng thái Hoạt động/Tạm khóa.

### 2.11 Pha chế — Barista (`/barista`)

- [ ] 3 thẻ: Chờ nhận đơn / Đang pha chế / Sẵn sàng giao.
- [ ] Hàng đợi hiển thị đơn **QUEUED + đã thanh toán** (món, ghi chú, tổng tiền, thời gian).
- [ ] Bấm **Nhận đơn** → đơn chuyển sang "Đang pha chế" (biến mất khỏi hàng đợi).
- [ ] Đơn PREPARING → **Hoàn thành (READY)** → chuyển vào trạng thái sẵn sàng.
- [ ] Đơn READY → **Giao món (DELIVERED)**.
- [ ] Hai admin cùng nhấn "Nhận đơn" một lúc → một người thắng, người kia báo lỗi 409 (không nhân đôi).
- [ ] Nút **Làm mới** cập nhật hàng đợi.

### 2.12 Báo cáo doanh thu (`/reports/revenue`)

- [ ] Vào trang → dữ liệu tự tải ngay (mặc định **30 ngày gần nhất**, không cần bấm nút).
- [ ] Thay đổi ngày Từ/Đến hoặc bộ lọc Phương thức → **biểu đồ và bảng tự cập nhật tức thì** (không cần nút "Xem báo cáo").
- [ ] Thống kê tóm tắt: Doanh thu thuần, Đã hoàn tiền (REFUNDED), Số đơn hợp lệ, Trung bình/ngày.
- [ ] Biểu đồ cột theo ngày: chỉ hiện cột **có dữ liệu > 0đ**, không vẽ cột rỗng cho ngày không có giao dịch.
- [ ] Bảng "Chi tiết theo ngày": chỉ liệt kê những ngày **có giao dịch thực sự**, không xuất hiện các dòng 0đ.
- [ ] Badge góc trên bảng hiển thị đúng số ngày có giao dịch (vd: "6 ngày có giao dịch").
- [ ] Lọc **Tiền mặt** / **Chuyển khoản QR** → biểu đồ và bảng chỉ tính đúng phương thức đó.
- [ ] Cột "Đã hoàn (REFUNDED)" hiển thị dấu `−` màu đỏ khi có hoàn tiền; hiển thị `—` khi không có.

### 2.13 Nhật ký (`/audit`)

- [ ] Bảng: thời gian, người thao tác, hành động, đối tượng, chi tiết (JSON).
- [ ] Sau khi làm 1 thao tác (vd: xác nhận tiền mặt, hủy đơn) → làm mới trang → có bản ghi mới.

---

## 3. Luồng nghiệp vụ hoàn chỉnh (test end-to-end)

Mục tiêu: tạo đơn → thu tiền → pha chế → giao → báo cáo.

1. Vào **Danh mục** → thêm 1 danh mục (vd: "Cà phê"), vào **Catalog** → thêm món (vd: "Cà phê sữa", giá 35.000).
2. Vào **Nhân viên** → thêm 1 nhân viên phục vụ + 1 nhân viên pha chế (Telegram ID bất kỳ).
3. Vào **Đơn hàng → + Tạo đơn**: chọn người tạo = nhân viên phục vụ, phương thức = Tiền mặt, thêm 2 món, tổng = 70.000 → **Tạo đơn**.
4. Trong **Chi tiết đơn**: thêm thêm 1 món nữa (tổng tăng lên), sửa SL, rồi **Xác nhận tiền mặt** → PAID, trạng thái thực hiện → QUEUED.
5. Vào **Barista**: đơn xuất hiện ở hàng đợi → **Nhận đơn** → **Hoàn thành** → **Giao món**.
6. Về **Dashboard**: doanh thu đã thu tăng 105.000, "Đang chờ pha chế" giảm.
7. Vào **Báo cáo doanh thu** (khoảng ngày hôm nay): có dòng Tiền mặt = 105.000, 1 đơn.
8. Vào **Nhật ký**: thấy chuỗi sự kiện tạo đơn, thanh toán, nhận đơn, hoàn thành, giao.

---

## 4. Các trường hợp lỗi nên kiểm tra

| Tình huống | Kỳ vọng |
|---|---|
| Backend tắt, mở FE | Trang báo lỗi rõ ràng (hoặc 503 khi proxy) |
| Đăng nhập sai | Lỗi đỏ, không điều hướng |
| Hủy đơn không nhập lý do | Báo "Vui lòng nhập lý do hủy đơn" |
| Hoàn tiền số âm / = 0 | Báo lỗi "Số tiền hoàn phải lớn hơn 0" |
| Xóa danh mục còn món | Báo "Không thể xóa vì còn N món" |
| Xóa món cuối cùng của đơn | Nút bị disable + tooltip giải thích |
| Sửa món khi đơn đã thanh toán | Nút không hiển thị (backend trả 409 nếu gọi thẳng) |
| Nhận đơn đã bị người khác nhận | Toast báo lỗi 409, danh sách cập nhật |
| Access token hết hạn | Tự refresh; nếu refresh fail → về /login |
