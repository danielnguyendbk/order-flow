"use client";

import { useCallback } from "react";
import { PageHeader, Panel, Badge, EmptyState, PageLoading } from "@/components/ui";
import { formatDateTime, formatVnd } from "@/lib/format";
import { getAuditLogs, type ApiAuditLog } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";

const ACTION_MAP: Record<string, string> = {
  "RECONCILIATION_RESOLVED": "Xử lý đối soát",
  "MANUAL_RECONCILIATION_LINKED": "Ghép nối ĐS thủ công",
  "MANUAL_REFUND_RECORDED": "Ghi nhận hoàn tiền",
  "MENU_ITEM_CREATED": "Tạo món mới",
  "MENU_ITEM_UPDATED": "Cập nhật món",
  "MENU_ITEM_DELETED": "Xóa món",
  "CATEGORY_CREATED": "Tạo danh mục",
  "CATEGORY_UPDATED": "Cập nhật danh mục",
  "CATEGORY_DELETED": "Xóa danh mục",
  "PAYMENT_REVIEW_FLAGGED": "Cắm cờ TT cần xem xét",
  "SEPAY_WEBHOOK_RECEIVED": "Nhận Webhook SePay",
  "ORDER_CREATED": "Tạo đơn hàng",
  "ORDER_UPDATED": "Cập nhật đơn hàng",
  "ORDER_STATUS_CHANGED": "Đổi trạng thái ĐH",
  "EMPLOYEE_CREATED": "Tạo nhân viên",
  "EMPLOYEE_UPDATED": "Cập nhật nhân viên",
  "EMPLOYEE_ACTIVATED": "Kích hoạt nhân viên",
  "EMPLOYEE_DEACTIVATED": "Vô hiệu hóa nhân viên",
  "USER_LOGIN_SUCCESS": "Đăng nhập thành công",
  "USER_LOGIN_FAILED": "Đăng nhập thất bại",
  "USER_LOGOUT": "Đăng xuất",
};

const ENTITY_MAP: Record<string, string> = {
  "SEPAY_TRANSACTION": "Giao dịch SePay",
  "PAYMENT": "Thanh toán",
  "MENU_ITEM": "Món",
  "CATEGORY": "Danh mục",
  "ORDER": "Đơn hàng",
  "USER": "Người dùng",
  "EMPLOYEE": "Nhân viên",
};

const KEY_MAP: Record<string, string> = {
  "reason": "Lý do",
  "note": "Ghi chú",
  "paymentId": "Mã TT",
  "orderId": "Mã ĐH",
  "orderCode": "Mã đơn",
  "amount": "Số tiền",
  "amountIn": "Tiền vào",
  "amountVnd": "Tổng tiền",
  "refundAmount": "Tiền hoàn",
  "newMatchStatus": "Trạng thái mới",
  "matchStatus": "Trạng thái ĐS",
  "itemName": "Tên món",
  "expected": "Dự kiến",
  "actual": "Thực nhận",
  "received": "Đã nhận",
  "newPrice": "Giá mới",
  "oldPrice": "Giá cũ",
  "isAvailable": "Còn hàng",
  "gateway": "Ngân hàng",
  "sepayTxId": "Mã GD SePay",
  "channel": "Kênh tạo",
  "location": "Vị trí",
  "ip": "Địa chỉ IP",
  "role": "Vai trò",
  "userAgent": "Trình duyệt",
  "resolutionNote": "Ghi chú xử lý",
  "differenceAmount": "Tiền chênh lệch",
  "resolutionAction": "Hành động xử lý",
  "previousMatchStatus": "Trạng thái ĐS cũ",
  "previousResolutionAction": "Hành động xử lý cũ",
  "action": "Hành động",
  "paymentMethod": "Phương thức TT",
  "receivedAmount": "Đã nhận",
  "previousPaymentStatus": "Trạng thái TT cũ",
};

const VALUE_MAP: Record<string, string> = {
  "UNDERPAID": "Thiếu tiền",
  "OVERPAID": "Dư tiền",
  "UNMATCHED": "Chưa khớp",
  "MATCHED": "Đã khớp",
  "RESOLVED": "Đã xử lý",
  "TELEGRAM_BOT": "Bot Telegram",
  "OWNER": "Chủ quán",
  "MANAGER": "Quản lý",
  "BARISTA": "Pha chế",
  "STAFF": "Nhân viên",
  "ACCEPT": "Chấp nhận",
  "NONE": "Không",
  "REVIEWED": "Đã xem xét",
  "REFUND_REQUIRED": "Cần hoàn tiền",
  "WRONG_CODE": "Sai mã",
  "LINK_MANUALLY": "Liên kết thủ công",
  "CASH": "Tiền mặt",
  "QR": "Mã QR",
  "PAID": "Đã thanh toán",
};

function formatKey(k: string) {
  return KEY_MAP[k] || k;
}

function formatValue(k: string, v: unknown) {
  if (v === null || v === undefined) return "Trống";
  if (typeof v === "boolean") return v ? "Có" : "Không";
  
  if (typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)))) {
    // Check if key relates to currency
    const lowerK = k.toLowerCase();
    if (lowerK.includes("amount") || lowerK.includes("price") || lowerK === "expected" || lowerK === "actual" || lowerK === "received") {
      return formatVnd(Number(v));
    }
  }

  if (typeof v === "string" && VALUE_MAP[v]) {
    return VALUE_MAP[v];
  }

  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function formatAction(action: string) {
  return ACTION_MAP[action] || action;
}

function formatEntity(entity: string) {
  return ENTITY_MAP[entity] || entity;
}

export default function AuditPage() {
  const load = useCallback(async () => (await getAuditLogs()).data, []);
  const { data: logs, loading, error } = useApiData(load, [] as ApiAuditLog[]);
  
  if (loading && logs.length === 0) {
    return <PageLoading label="Đang tải nhật ký thao tác..." subText="Đang lấy thông tin audit log từ hệ thống..." />;
  }

  return (
    <div className="animate-[fadeUp_.35s_ease-out]">
      <PageHeader title="Nhật ký thao tác" description="Theo dõi lịch sử thay đổi trên hệ thống dễ dàng." />
      
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      
      <Panel>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-line text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="th text-left w-36">Thời gian</th>
                <th className="th text-left w-36">Người thao tác</th>
                <th className="th text-left w-48">Hành động</th>
                <th className="th text-left w-48">Đối tượng</th>
                <th className="th text-left">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>Chưa có nhật ký thao tác.</EmptyState>
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="td whitespace-nowrap text-sm font-medium text-slate-600">
                    {formatDateTime(log.createdAt)}
                  </td>
                  
                  <td className="td">
                    <Badge tone={log.actor ? "teal" : "violet"}>
                      {log.actor?.username ?? log.actor?.fullName ?? "Hệ thống"}
                    </Badge>
                  </td>
                  
                  <td className="td">
                    <strong className="text-sm font-bold text-slate-800">
                      {formatAction(log.action)}
                    </strong>
                  </td>
                  
                  <td className="td">
                    <div className="text-sm font-semibold text-slate-700">
                      {formatEntity(log.entityType)}
                    </div>
                    {log.entityId && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                        <span className="truncate w-32" title={log.entityId}>{log.entityId}</span>
                      </div>
                    )}
                  </td>
                  
                  <td className="td py-3">
                    {!log.details ? (
                      <span className="text-xs text-slate-400 italic">Không có</span>
                    ) : (
                      <div className="inline-block rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 shadow-sm min-w-[200px] max-w-[320px]">
                        {typeof log.details !== 'object' ? (
                          <div className="text-xs font-mono text-slate-700 break-all">{String(log.details)}</div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {Object.entries(log.details as Record<string, unknown>).map(([k, v]) => (
                              <div key={k} className="flex gap-2 text-xs leading-relaxed">
                                <span className="font-semibold text-slate-500 whitespace-nowrap min-w-[60px]">
                                  {formatKey(k)}:
                                </span>
                                <span className="text-slate-800 break-words font-medium overflow-hidden">
                                  {formatValue(k, v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
