# API Conventions

## Base URL

`/api/v1`

## Response thành công

```json
{
  "success": true,
  "data": {}
} 



## Response lỗi

```json
{
  "success": false,
  "error": {
    "code": "ORDER_STATE_INVALID",
    "message": "Trạng thái đơn không hợp lệ",
    "details": null
  }
}

## Error code chính

AUTH_FORBIDDEN
ORDER_NOT_FOUND
ORDER_STATE_INVALID
ORDER_NOT_OWNER
ORDER_ALREADY_CLAIMED
PAYMENT_ALREADY_CONFIRMED
WEBHOOK_DUPLICATE
MENU_ITEM_UNAVAILABLE
EMPLOYEE_INACTIVE
VALIDATION_ERROR
VERSION_CONFLICT