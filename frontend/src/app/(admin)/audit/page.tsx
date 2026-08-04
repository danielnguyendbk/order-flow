import { PageHeader, Panel, Badge, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { auditLogs } from "@/lib/data";

export default function AuditPage() {
  return (
    <div>
      <PageHeader title="Nhật ký thao tác" description="Ghi lại các thao tác quan trọng của admin trên hệ thống." />

      <Panel>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Thời gian</th>
                <th className="th">Admin</th>
                <th className="th">Thao tác</th>
                <th className="th">Đối tượng</th>
                <th className="th">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {auditLogs.length === 0 && <tr><td colSpan={5}><EmptyState>Chưa có nhật ký thao tác.</EmptyState></td></tr>}
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-soft">
                  <td className="td whitespace-nowrap text-sm text-ink">{formatDateTime(log.createdAt)}</td>
                  <td className="td">
                    <Badge tone={log.actor === "system" ? "violet" : "teal"}>{log.actor}</Badge>
                  </td>
                  <td className="td"><strong className="text-sm text-ink">{log.actionLabel}</strong></td>
                  <td className="td">
                    <span className="text-sm text-ink">{log.entity}</span>
                    {log.entityId !== "-" && <code className="mt-1 block w-fit rounded bg-slate-100 px-1.5 py-0.5 text-xs">{log.entityId}</code>}
                  </td>
                  <td className="td">
                    <code className="block w-fit max-w-full rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">{log.metadataPreview}</code>
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
