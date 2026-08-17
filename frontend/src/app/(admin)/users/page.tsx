"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { PageHeader, Panel, Badge, EmptyState, Field, Modal, Stats, PageLoading, type Tone } from "@/components/ui";
import { useToast } from "@/components/Toast";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  activateEmployee,
  deactivateEmployee,
  type ApiUser,
} from "@/lib/api";
import { useApiData } from "@/lib/use-api-data";

const ROLE_LABEL: Record<string, string> = {
  SERVICE_STAFF: "Nhân viên Phục vụ (Bot)",
  BARISTA: "Nhân viên Pha chế (Bot)",
  OWNER: "Quản lý / Chủ quán",
};

const ROLE_OPTIONS: { value: "SERVICE_STAFF" | "BARISTA"; label: string }[] = [
  { value: "SERVICE_STAFF", label: "Nhân viên Phục vụ (Bot)" },
  { value: "BARISTA", label: "Nhân viên Pha chế (Bot)" },
];

function roleTone(role: string): Tone {
  switch (role) {
    case "OWNER":
      return "teal";
    case "SERVICE_STAFF":
      return "blue";
    case "BARISTA":
      return "green";
    default:
      return "gray";
  }
}

export default function StaffPage() {
  const toast = useToast();

  const load = useCallback(async () => {
    const payload = await getEmployees(500);
    return payload.data;
  }, []);

  const { data: rows, loading, error, reload } = useApiData<ApiUser[]>(load, []);

  const [roleFilter, setRoleFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [editingStaff, setEditingStaff] = useState<ApiUser | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formTelegramId, setFormTelegramId] = useState("");
  const [formRole, setFormRole] = useState<"SERVICE_STAFF" | "BARISTA">("SERVICE_STAFF");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((s) => {
      if (roleFilter && s.role !== roleFilter) return false;
      if (term) {
        const hay = `${s.fullName} ${s.username ?? ""} ${s.telegramUserId ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, roleFilter]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      waiters: rows.filter((s) => s.role === "SERVICE_STAFF").length,
      baristas: rows.filter((s) => s.role === "BARISTA").length,
      active: rows.filter((s) => s.status !== "INACTIVE").length,
    }),
    [rows]
  );

  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      await reload();
      toast.push(success, "success");
    } catch (actionError) {
      toast.push(actionError instanceof Error ? actionError.message : "Không thể thực hiện thao tác.", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = (staff: ApiUser) => {
    const isActive = staff.status !== "INACTIVE";
    const action = isActive
      ? () => deactivateEmployee(staff.id)
      : () => activateEmployee(staff.id);
    void act(action, `Đã ${isActive ? "khóa" : "kích hoạt"} tài khoản ${staff.fullName}.`);
  };

  const openAdd = () => {
    setIsAdding(true);
    setEditingStaff(null);
    setFormName("");
    setFormUsername("");
    setFormTelegramId("");
    setFormRole("SERVICE_STAFF");
  };

  const openEdit = (staff: ApiUser) => {
    setEditingStaff(staff);
    setIsAdding(false);
    setFormName(staff.fullName);
    setFormUsername(staff.username ?? "");
    setFormTelegramId(staff.telegramUserId ?? "");
    setFormRole(staff.role === "BARISTA" ? "BARISTA" : "SERVICE_STAFF");
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.push("Vui lòng nhập họ tên nhân viên.", "error");
      return;
    }
    if (!formTelegramId.trim()) {
      toast.push("Vui lòng nhập Telegram ID.", "error");
      return;
    }
    const body = {
      fullName: formName.trim(),
      telegramUserId: formTelegramId.trim(),
      username: formUsername.trim() ? formUsername.trim().replace(/^@/, "") : null,
      role: formRole,
    };
    if (editingStaff) {
      void act(() => updateEmployee(editingStaff.id, body), `Đã cập nhật thông tin nhân viên ${formName.trim()}.`);
    } else {
      void act(() => createEmployee(body), `Đã thêm nhân viên ${formName.trim()} thành công!`);
    }
    setIsAdding(false);
    setEditingStaff(null);
  };

  if (loading && rows.length === 0) {
    return <PageLoading label="Đang tải danh sách nhân viên..." subText="Đang lấy thông tin tài khoản nhân sự từ hệ thống..." />;
  }

  return (
    <div className="animate-[fadeUp_.35s_ease-out]">
      <PageHeader
        title="Quản lý Nhân viên Quán"
        description="Quản lý danh sách nhân viên phục vụ và pha chế. Tích hợp Telegram ID để nhận diện qua Bot Telegram."
      >
        <button type="button" className="btn" onClick={openAdd}>
          + Thêm nhân viên
        </button>
      </PageHeader>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Stats
        items={[
          { label: "Tổng nhân sự", value: stats.total },
          { label: "Phục vụ (Bot)", value: stats.waiters, tone: "blue" },
          { label: "Pha chế (Bot)", value: stats.baristas, tone: "teal" },
          { label: "Đang hoạt động", value: stats.active, tone: "green" },
        ]}
      />

      {/* Tra cứu & Bộ lọc */}
      <Panel className="mb-6">
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-end gap-3.5">
          <div className="flex-1 min-w-[280px]">
            <Field label="Tìm kiếm">
              <input
                className="input"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tên, Telegram ID, Username..."
              />
            </Field>
          </div>
          <div className="w-full sm:w-64">
            <Field label="Vai trò">
              <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">Tất cả vai trò</option>
                <option value="SERVICE_STAFF">Nhân viên Phục vụ (Bot)</option>
                <option value="BARISTA">Nhân viên Pha chế (Bot)</option>
              </select>
            </Field>
          </div>
          {Boolean(q || roleFilter) && (
            <button
              type="button"
              className="btn-ghost h-10 px-3.5"
              onClick={() => {
                setQ("");
                setRoleFilter("");
              }}
            >
              Xóa lọc
            </button>
          )}
        </form>
      </Panel>

      {/* Bảng danh sách */}
      <Panel
        title="Danh sách Nhân viên"
        right={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">Hiển thị <strong className="text-ink">{filtered.length}</strong> nhân sự</span>
            <button type="button" className="btn-ghost text-xs" onClick={() => void reload()} disabled={loading}>Làm mới</button>
          </div>
        }
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Nhân viên</th>
                <th className="th">Telegram ID</th>
                <th className="th">Vai trò</th>
                <th className="th">Trạng thái</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>Không tìm thấy nhân viên phù hợp.</EmptyState>
                  </td>
                </tr>
              )}
              {filtered.map((staff) => (
                <tr key={staff.id} className="hover:bg-surface-soft transition-colors">
                  <td className="td">
                    <strong className="block text-sm text-ink">{staff.fullName}</strong>
                    <small className="text-xs text-muted">@{staff.username || "chua_co_username"}</small>
                  </td>
                  <td className="td">
                    <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-brand-700">
                      {staff.telegramUserId}
                    </code>
                  </td>
                  <td className="td">
                    <Badge tone={roleTone(staff.role)}>{ROLE_LABEL[staff.role] ?? staff.role}</Badge>
                  </td>
                  <td className="td">
                    <Badge tone={staff.status === "INACTIVE" ? "gray" : "green"}>
                      {staff.status === "INACTIVE" ? "Tạm khóa" : "Hoạt động"}
                    </Badge>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <button type="button" className="btn-ghost text-xs" onClick={() => openEdit(staff)}>
                        Sửa
                      </button>
                      <button
                        type="button"
                        className={staff.status === "INACTIVE" ? "btn-ghost text-xs text-emerald-600" : "btn-danger text-xs"}
                        disabled={busy}
                        onClick={() => toggleStatus(staff)}
                      >
                        {staff.status === "INACTIVE" ? "Mở khóa" : "Khóa"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Modal Thêm/Sửa nhân viên */}
      <Modal
        open={isAdding || editingStaff !== null}
        onClose={() => {
          setIsAdding(false);
          setEditingStaff(null);
        }}
        eyebrow="NHÂN SỰ"
        title={isAdding ? "Thêm nhân viên mới" : `Sửa thông tin ${editingStaff?.fullName ?? ""}`}
        subtitle="Vui lòng điền Telegram ID chính xác để bot nhận diện role khi thao tác."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Họ và Tên">
            <input
              className="input"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn An"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Username Telegram">
              <input
                className="input"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                placeholder="nguyenan"
              />
            </Field>
            <Field label="Telegram ID (bắt buộc)">
              <input
                className="input font-mono"
                value={formTelegramId}
                onChange={(e) => setFormTelegramId(e.target.value)}
                placeholder="12345678"
                required
              />
            </Field>
          </div>

          <Field label="Vai trò (Role)">
            <select className="input" value={formRole} onChange={(e) => setFormRole(e.target.value as "SERVICE_STAFF" | "BARISTA")}>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setIsAdding(false);
                setEditingStaff(null);
              }}
            >
              Hủy
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Đang lưu..." : isAdding ? "Thêm mới" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
