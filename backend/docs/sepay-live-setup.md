# Kết nối QR thật và SePay Live

## 1. Điều kiện cần

- Tài khoản ngân hàng nhận tiền đã được liên kết và đồng bộ giao dịch trên SePay.
- API chạy trên một URL HTTPS công khai, ổn định. `localhost:3001` không nhận được webhook từ SePay.
- PostgreSQL, Redis và notification worker cùng chạy với database production.
- Không gửi API key, mật khẩu ngân hàng hoặc token qua chat hay commit vào Git.

## 2. Cấu hình QR trên API

Điền trực tiếp vào `.env.local`:

```dotenv
SEPAY_BANK_ACCOUNT="SO_TAI_KHOAN_NHAN_TIEN"
SEPAY_BANK_NAME="MA_NGAN_HANG"
SEPAY_ACCOUNT_HOLDER="TEN CHU TAI KHOAN KHONG DAU"
SEPAY_QR_IMAGE_BASE_URL="https://vietqr.app/img"
```

`SEPAY_BANK_NAME` dùng `code`, `bin`, `short_name` hoặc `alias` trong danh sách ngân hàng VietQR, ví dụ `VCB`, `970436` hoặc `Vietcombank`. Số tài khoản chỉ gồm chữ và số, tối đa 19 ký tự.

Khi staff chọn QR, backend tự tạo ảnh với đủ `acc`, `bank`, `amount`, `des` và `template=compact`. `des` là mã thanh toán duy nhất dạng `PAYYYMMDDXXXX`; khách phải giữ nguyên nội dung này để webhook đối soát đúng đơn.

Trong **Cấu hình Công ty** → **Cấu trúc mã thanh toán** của SePay, tạo mẫu:

- Tiền tố: `PAY`
- Hậu tố: `10` ký tự
- Loại hậu tố: `Số nguyên`

Trong giai đoạn chuyển đổi, để trống bộ lọc mã thanh toán và tắt **Bỏ qua giao dịch không có mã** cho tới khi các đơn cũ dạng `PAYORD...` đã được xử lý xong.

## 3. Tạo API key webhook

Tạo một chuỗi ngẫu nhiên mạnh, tối thiểu 32 byte. Ví dụ trên PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLowerInvariant()
```

Đặt kết quả vào `.env.local`:

```dotenv
SEPAY_WEBHOOK_API_KEY="KHOA_VUA_TAO"
```

Restart API sau khi đổi `.env.local`.

## 3.1. Cấu hình đối soát chủ động

Webhook vẫn là luồng chính. Để nút **Kiểm tra thanh toán** có thể phục hồi một giao dịch bị webhook bỏ lỡ, tạo API Token mới tại **Cấu hình Công ty** → **API Access** và đặt vào `.env.local`:

```dotenv
SEPAY_API_TOKEN="TOKEN_MOI_TAO"
SEPAY_API_BASE_URL="https://userapi.sepay.vn/v2/transactions"
```

Khi kiểm thử bằng **Test Mode**, token Sandbox không dùng được với endpoint Live. Đổi URL thành:

```dotenv
SEPAY_API_BASE_URL="https://userapi-sandbox.sepay.vn/v2/transactions"
```

Trước lần chạy API đầu tiên sau khi nâng cấp, áp dụng migration hỗ trợ UUID giao dịch SePay v2:

```bash
cd backend
npm run db:migrate:sepay-v2:docker
```

API chỉ chấp nhận giao dịch tiền vào khi khớp đồng thời tài khoản nhận, số tiền dự kiến và mã thanh toán. Thời gian giao dịch được phép sớm hơn lúc tạo payment tối đa 60 giây để bù sai lệch đồng hồ hoặc độ chính xác thời gian từ ngân hàng/SePay. Giao dịch tìm được vẫn đi qua cùng transaction/idempotency của webhook trước khi cập nhật đơn.

## 4. Tạo webhook trên SePay

Trong `my.sepay.vn` chọn **Webhooks** → **Thêm webhook** và cấu hình:

- Tên: `Order Flow - Payment In`
- Sự kiện: `Có tiền vào` / `In_only`
- URL: `https://TEN-MIEN-API/api/v1/webhooks/sepay`
- Tài khoản: đúng tài khoản trong `SEPAY_BANK_ACCOUNT`
- Bộ lọc mã thanh toán: tiền tố `PAY`
- Kiểu chứng thực: `API Key`
- API Key: đúng giá trị `SEPAY_WEBHOOK_API_KEY`
- Content type: `JSON`
- Trạng thái: bật

SePay sẽ gửi header `Authorization: Apikey KHOA_VUA_TAO`. Endpoint thành công trả HTTP 200 và JSON có `{"success":true}`.

## 5. Kiểm thử trước khi dùng tiền thật

1. Bật **Test Mode** trên SePay, tạo API Access Test Mode và dùng endpoint `userapi-sandbox.sepay.vn` như phần 3.1.
2. Tạo webhook test với URL và API key ở trên.
3. Tạo một đơn QR trong Telegram Bot, ghi lại chính xác mã `PAYORD...` và số tiền.
4. Dùng chức năng mô phỏng giao dịch của SePay với đúng số tiền và nội dung đó.
5. Xác nhận đơn chuyển từ `Chờ xác nhận thanh toán` sang `Đã thanh toán · Chờ pha`.
6. Xác nhận Barista nhận thông báo và nút `NHẬN & PHA ĐƠN`.
7. Kiểm tra Nhật ký webhook trên SePay: HTTP 200, body có `success: true`.

Sau khi Test Mode đạt đủ 7 bước, tạo lại webhook tương tự trong Live rồi chuyển thử một khoản nhỏ thật.

## 6. Quy tắc đối soát

- Đúng mã và đúng tiền: đơn thành `PAID/QUEUED`, Barista được thông báo.
- Thiếu tiền: `UNDERPAID`, không đưa vào hàng chờ pha.
- Thừa tiền: `OVERPAID`, không đưa vào hàng chờ pha.
- Sai mã: lưu giao dịch `WRONG_CODE`, không gắn nhầm đơn.
- Webhook trùng `id`: xử lý idempotent, không cập nhật hoặc thông báo hai lần.

Tài liệu chính thức:

- https://docs.sepay.vn/tich-hop-webhooks.html
- https://docs.sepay.vn/tao-qr-code-vietqr-dong.html
- https://docs.sepay.vn/test-mode.html
