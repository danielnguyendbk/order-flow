"use client";

import { useMemo, useState, type FormEvent } from "react";
import { PageHeader, Panel, Badge, EmptyState, Field, Modal, Stats } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { staffMembers as initialStaff, STAFF_ROLE_LABEL, type Staff, type StaffRole } from "@/lib/data";

export default function StaffPage() {
  const toast = useToast();
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Staff[]>(initialStaff);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formTelegramId, setFormTelegramId] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<StaffRole>("WAITER");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((s) => {
      if (roleFilter && s.role !== roleFilter) return false;
      if (term) {
        const hay = `${s.firstName} ${s.lastName} ${s.username} ${s.telegramId} ${s.phone}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, roleFilter]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      waiters: rows.filter((s) => s.role === "WAITER").length,
      baristas: rows.filter((s) => s.role === "BARISTA").length,
      managers: rows.filter((s) => s.role === "MANAGER").length,
      active: rows.filter((s) => s.active).length,
    }),
    [rows]
  );

  const toggleStatus = (staff: Staff) => {
    setRows((prev) =>
      prev.map((s) => (s.id === staff.id ? { ...s, active: !s.active } : s))
    );
    toast.push(`Đã ${staff.active ? "khóa" : "kích hoạt"} tài khoản ${staff.firstName} ${staff.lastName}.`, "success");
  };

  const openAdd = () => {
    setIsAdding(true);
    setFormName("");
    setFormUsername("");
    setFormTelegramId("");
    setFormPhone("");
    setFormRole("WAITER");
  };

  const openEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setFormName(`${staff.firstName} ${staff.lastName}`);
    setFormUsername(staff.username);
    setFormTelegramId(staff.telegramId);
    setFormPhone(staff.phone);
    setFormRole(staff.role);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();

    // Kiểm tra Telegram ID trùng khi thêm/sửa
    const duplicate = rows.find(
      (s) => s.telegramId === formTelegramId && (isAdding || s.id !== editingStaff?.id)
    );
    if (duplicate) {
      toast.push(
        `Telegram ID ${formTelegramId} đã thuộc về ${duplicate.firstName} ${duplicate.lastName}. Vui lòng kiểm tra lại.`,
        "error"
      );
      return;
    }

    if (isAdding) {
      const parts = formName.trim().split(" ");
      const firstName = parts[0] || "Nhân viên";
      const lastName = parts.slice(1).join(" ") || "";
      const newStaff: Staff = {
        id: `stf_${Date.now()}`,
        telegramId: formTelegramId || `${Math.floor(10000000 + Math.random() * 90000000)}`,
        firstName,
        lastName,
        username: formUsername.replace("@", ""),
        phone: formPhone,
        role: formRole,
        active: true,
        orderCount: 0,
        createdAt: new Date().toISOString(),
      };
      setRows((prev) => [newStaff, ...prev]);
      toast.push(`Đã thêm nhân viên ${formName} thành công!`, "success");
      setIsAdding(false);
    } else if (editingStaff) {
      const parts = formName.trim().split(" ");
      const firstName = parts[0] || editingStaff.firstName;
      const lastName = parts.slice(1).join(" ");
      setRows((prev) =>
        prev.map((s) =>
          s.id === editingStaff.id
            ? {
                ...s,
                firstName,
                lastName,
                username: formUsername.replace("@", ""),
                telegramId: formTelegramId,
                phone: formPhone,
                role: formRole,
              }
            : s
        )
      );
      toast.push(`Đã cập nhật thông tin nhân viên ${formName}.`, "success");
      setEditingStaff(null);
    }
  };

  const roleTone = (role: StaffRole) => {
    switch (role) {
      case "MANAGER":
        return "teal";
      case "WAITER":
        return "blue";
      case "BARISTA":
        return "green";
      default:
        return "gray";
    }
  };

  return (
    <div>
      <PageHeader
        title="Quản lý Nhân viên Quán"
        description="Quản lý danh sách nhân viên phục vụ, nhân viên pha chế và quản lý. Tích hợp Telegram ID để nhận diện qua Bot Telegram."
      >
        <button type="button" className="btn" onClick={openAdd}>
          + Thêm nhân viên
        </button>
      </PageHeader>

      <Stats
        items={[
          { label: "Tổng nhân sự", value: stats.total },
          { label: "Phục vụ (Bot)", value: stats.waiters, tone: "blue" },
          { label: "Pha chế (Bot)", value: stats.baristas, tone: "teal" },
          { label: "Quản lý / Chủ quán", value: stats.managers, tone: "teal" },
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
                placeholder="Tên, Telegram ID, SĐT, Username..."
              />
            </Field>
          </div>
          <div className="w-full sm:w-64">
            <Field label="Vai trò">
              <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">Tất cả vai trò</option>
                <option value="WAITER">Nhân viên Phục vụ (Bot)</option>
                <option value="BARISTA">Nhân viên Pha chế (Bot)</option>
                <option value="MANAGER">Quản lý / Chủ quán (Web)</option>
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
        right={<span className="text-sm text-muted">Hiển thị <strong className="text-ink">{filtered.length}</strong> nhân sự</span>}
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Nhân viên</th>
                <th className="th">Telegram ID</th>
                <th className="th">Vai trò</th>
                <th className="th">Số ĐT</th>
                <th className="th">Trạng thái</th>
                <th className="th">Số đơn đã tạo/xử lý</th>
                <th className="th">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState>Không tìm thấy nhân viên phù hợp.</EmptyState>
                  </td>
                </tr>
              )}
              {filtered.map((staff) => (
                <tr key={staff.id} className="hover:bg-surface-soft transition-colors">
                  <td className="td">
                    <strong className="block text-sm text-ink">
                      {staff.firstName} {staff.lastName}
                    </strong>
                    <small className="text-xs text-muted">@{staff.username || "chua_co_username"}</small>
                  </td>
                  <td className="td">
                    <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-brand-700">
                      {staff.telegramId}
                    </code>
                  </td>
                  <td className="td">
                    <Badge tone={roleTone(staff.role)}>{STAFF_ROLE_LABEL[staff.role]}</Badge>
                  </td>
                  <td className="td text-sm text-ink">{staff.phone || "—"}</td>
                  <td className="td">
                    <Badge tone={staff.active ? "green" : "gray"}>
                      {staff.active ? "Hoạt động" : "Tạm khóa"}
                    </Badge>
                  </td>
                  <td className="td font-bold tabular-nums text-ink">{staff.orderCount} đơn</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <button type="button" className="btn-ghost text-xs" onClick={() => openEdit(staff)}>
                        Sửa
                      </button>
                      <button
                        type="button"
                        className={staff.active ? "btn-danger text-xs" : "btn-ghost text-xs text-emerald-600"}
                        onClick={() => toggleStatus(staff)}
                      >
                        {staff.active ? "Khóa" : "Mở khóa"}
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
        title={isAdding ? "Thêm nhân viên mới" : `Sửa thông tin ${editingStaff?.firstName} ${editingStaff?.lastName}`}
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Số điện thoại">
              <input
                className="input"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="0901234567"
              />
            </Field>
            <Field label="Vai trò (Role)">
              <select className="input" value={formRole} onChange={(e) => setFormRole(e.target.value as StaffRole)}>
                <option value="WAITER">Nhân viên Phục vụ (Telegram Bot)</option>
                <option value="BARISTA">Nhân viên Pha chế (Telegram Bot)</option>
                <option value="MANAGER">Quản lý / Chủ quán (Web Admin)</option>
              </select>
            </Field>
          </div>

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
            <button type="submit" className="btn">
              {isAdding ? "Thêm mới" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
