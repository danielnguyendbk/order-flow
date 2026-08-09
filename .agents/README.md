# AI Agent Instructions

## Mục đích

Thư mục `.agents` chứa ngữ cảnh kỹ thuật và nghiệp vụ dành cho
các AI coding agent làm việc với dự án OrderFlow.

Không đọc toàn bộ tài liệu nếu task chỉ liên quan một module.

## Thứ tự đọc mặc định

Trước khi sửa code, đọc:

1. `.agents/project-context.md`
2. `.agents/architecture.md`
3. File nghiệp vụ liên quan trực tiếp đến task
4. Code hiện tại của module
5. Test hiện tại của module

## Bản đồ tài liệu

| Tài liệu | Khi nào cần đọc |
|---|---|
| `project-context.md` | Mọi task |
| `architecture.md` | Tạo module hoặc thay đổi kiến trúc |
| `business-rules.md` | Sửa nghiệp vụ |
| `state-machine.md` | Sửa trạng thái order/payment |
| `api-conventions.md` | Thêm hoặc sửa API |
| `database-rules.md` | Sửa Prisma hoặc migration |
| `coding-standards.md` | Viết hoặc review code |
| `testing-rules.md` | Viết test |
| `module-ownership.md` | Xác định phạm vi module |
| `workflows/implement-api.md` | Triển khai endpoint |
| `workflows/change-database.md` | Thay đổi schema |

## Nguyên tắc làm việc

- Không suy đoán business rule khi tài liệu đã quy định.
- Không refactor ngoài phạm vi task.
- Không sửa public API nếu task không yêu cầu.
- Không truy cập database trực tiếp từ Telegram Bot hoặc Frontend.
- Không tạo migration phá hủy dữ liệu nếu chưa được yêu cầu.
- Không commit token, secret hoặc credential.
- Luôn kiểm tra code hiện tại trước khi tạo implementation mới.
- Thay đổi nghiệp vụ phải có test.
- Khi tài liệu và code mâu thuẫn, báo rõ trước khi quyết định.

## Báo cáo sau khi hoàn thành

1. Tóm tắt thay đổi.
2. Danh sách file đã sửa.
3. Business rule đã áp dụng.
4. Test và lệnh đã chạy.
5. Migration hoặc biến môi trường mới.
6. Rủi ro hoặc phần chưa hoàn thành.