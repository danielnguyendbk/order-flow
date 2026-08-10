"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { PageHeader, Panel, Badge, EmptyState, Field, Modal, Stats } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { apiRequest, getEmployees, type ApiUser } from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";

const ROLE_LABEL = { SERVICE_STAFF: "Nhân viên phục vụ", BARISTA: "Nhân viên pha chế" } as const;

export default function StaffPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => (await getEmployees()).data, []);
  const { data: rows, loading, error, reload } = useApiData(load, [] as ApiUser[]);
  const filtered = useMemo(() => rows.filter((employee) => {
    if (role && employee.role !== role) return false;
    const term = q.trim().toLowerCase();
    return !term || `${employee.fullName} ${employee.username ?? ""} ${employee.telegramUserId ?? ""}`.toLowerCase().includes(term);
  }), [q, role, rows]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const body = {
      fullName: String(values.get("fullName")),
      username: String(values.get("username") || "").replace(/^@/, "") || null,
      telegramUserId: String(values.get("telegramUserId")),
      role: String(values.get("role")),
    };
    try {
      await apiRequest(editing ? `admin/employees/${editing.id}` : "admin/employees", { method: editing ? "PATCH" : "POST", body });
      form.reset(); setCreating(false); setEditing(null); await reload();
      toast.push("Đã lưu nhân viên vào Supabase.", "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể lưu nhân viên.", "error");
    }
  };

  const toggle = async (employee: ApiUser) => {
    const active = employee.status !== "INACTIVE";
    try {
      await apiRequest(`admin/employees/${employee.id}/${active ? "deactivate" : "activate"}`, { method: "POST" });
      await reload();
      toast.push(`Đã ${active ? "khóa" : "kích hoạt"} ${employee.fullName}.`, "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể đổi trạng thái.", "error");
    }
  };

  const stats = { total: rows.length, active: rows.filter((row) => row.status !== "INACTIVE").length, baristas: rows.filter((row) => row.role === "BARISTA").length };
  return <div>
    <PageHeader title="Nhân viên" description="Tài khoản Telegram của nhân viên được đọc trực tiếp từ Supabase."><button className="btn" onClick={() => setCreating(true)}>Thêm nhân viên</button></PageHeader>
    {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading && <div className="mb-4 text-sm text-muted">Đang tải nhân viên...</div>}
    <Stats items={[{ label: "Tổng nhân viên", value: stats.total }, { label: "Đang hoạt động", value: stats.active, tone: "green" }, { label: "Pha chế", value: stats.baristas, tone: "teal" }]} />
    <Panel className="mb-6"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Tìm kiếm"><input className="input" value={q} onChange={(event) => setQ(event.target.value)} /></Field><Field label="Vai trò"><select className="input" value={role} onChange={(event) => setRole(event.target.value)}><option value="">Tất cả</option><option value="SERVICE_STAFF">Phục vụ</option><option value="BARISTA">Pha chế</option></select></Field></div></Panel>
    <Panel title="Danh sách nhân viên" right={<span className="text-sm text-muted">{filtered.length} người</span>}>
      {filtered.length === 0 && !loading && <EmptyState>Không có nhân viên phù hợp.</EmptyState>}
      <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr className="border-b border-line"><th className="th">Nhân viên</th><th className="th">Telegram ID</th><th className="th">Vai trò</th><th className="th">Trạng thái</th><th className="th">Thao tác</th></tr></thead><tbody className="divide-y divide-line-soft">{filtered.map((employee) => <tr key={employee.id}><td className="td"><strong className="block text-ink">{employee.fullName}</strong><small className="text-muted">@{employee.username || "chưa có"}</small></td><td className="td"><code>{employee.telegramUserId || "-"}</code></td><td className="td"><Badge tone={employee.role === "BARISTA" ? "green" : "blue"}>{ROLE_LABEL[employee.role as keyof typeof ROLE_LABEL]}</Badge></td><td className="td"><Badge tone={employee.status !== "INACTIVE" ? "green" : "gray"}>{employee.status !== "INACTIVE" ? "Hoạt động" : "Tạm khóa"}</Badge></td><td className="td"><div className="flex gap-2"><button className="btn-ghost" onClick={() => setEditing(employee)}>Sửa</button><button className="btn-danger" onClick={() => void toggle(employee)}>{employee.status !== "INACTIVE" ? "Khóa" : "Mở"}</button></div></td></tr>)}</tbody></table></div>
    </Panel>
    <Modal open={creating || editing !== null} onClose={() => { setCreating(false); setEditing(null); }} eyebrow="NHÂN SỰ" title={editing ? "Sửa nhân viên" : "Thêm nhân viên"} subtitle="Telegram ID phải chính xác để bot nhận diện.">
      <form key={editing?.id ?? "new"} onSubmit={save} className="space-y-3"><Field label="Họ tên"><input className="input" name="fullName" defaultValue={editing?.fullName} required /></Field><Field label="Username Telegram"><input className="input" name="username" defaultValue={editing?.username ?? ""} /></Field><Field label="Telegram ID"><input className="input" name="telegramUserId" defaultValue={editing?.telegramUserId ?? ""} required /></Field><Field label="Vai trò"><select className="input" name="role" defaultValue={editing?.role ?? "SERVICE_STAFF"}><option value="SERVICE_STAFF">Nhân viên phục vụ</option><option value="BARISTA">Nhân viên pha chế</option></select></Field><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => { setCreating(false); setEditing(null); }}>Đóng</button><button className="btn">Lưu</button></div></form>
    </Modal>
  </div>;
}
