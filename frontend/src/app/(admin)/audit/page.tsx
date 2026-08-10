"use client";

import { useCallback } from "react";
import { PageHeader, Panel, Badge, EmptyState, PageLoading } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getAuditLogs, type ApiAuditLog } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";

export default function AuditPage() {
  const load = useCallback(async () => (await getAuditLogs()).data, []);
  const { data: logs, loading, error } = useApiData(load, [] as ApiAuditLog[]);
  if (loading && logs.length === 0) {
    return <PageLoading label="Đang tải nhật ký thao tác..." subText="Đang lấy thông tin audit log từ hệ thống..." />;
  }

  return (
    <div>
      <PageHeader title="Nhật ký thao tác" description="Nhật ký hệ thống được đọc trực tiếp từ backend." />
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Panel>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="th">Thời gian</th>
                  <th className="th">Người thao tác</th>
                  <th className="th">Hành động</th>
                  <th className="th">Đối tượng</th>
                  <th className="th">Chi tiết</th>
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
                  <tr key={log.id} className="hover:bg-surface-soft">
                    <td className="td whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="td">
                      <Badge tone={log.actor ? "teal" : "violet"}>{log.actor?.username ?? log.actor?.fullName ?? "system"}</Badge>
                    </td>
                    <td className="td">
                      <strong>{log.action}</strong>
                    </td>
                    <td className="td">
                      {log.entityType}
                      <code className="mt-1 block text-xs">{log.entityId ?? "-"}</code>
                    </td>
                    <td className="td">
                      <code className="block max-w-md truncate text-xs font-mono text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60" title={JSON.stringify(log.details)}>
                        {JSON.stringify(log.details)}
                      </code>
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
