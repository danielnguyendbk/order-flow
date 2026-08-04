"use client";

import { useState } from "react";
import { PageHeader, Panel, Badge } from "@/components/ui";
import { settings } from "@/lib/data";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
        copied
          ? "bg-emerald-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95"
      }`}
    >
      {copied ? "✓ Đã sao chép" : "Sao chép"}
    </button>
  );
}

function ConfigField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</label>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <input 
          className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 font-mono text-xs text-slate-800 shadow-inner outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20" 
          value={value} 
          readOnly 
        />
        <CopyButton value={value} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [storeName, setStoreName] = useState("Tiệm Cà phê & Trà Sữa Tele");
  const [hotline, setHotline] = useState(settings.supportZalo);
  const [botToken, setBotToken] = useState("7182938491:AAHk-9X10qZ_example_token");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="w-full pb-12">
      <PageHeader
        title="Cấu hình Hệ thống F&B"
        description="Quản lý thông tin quán, kết nối SePay QR đối soát tự động và Telegram Bot cho nhân viên phục vụ, pha chế."
      >
        <button
          onClick={handleSave}
          type="button"
          className="btn shadow-md shadow-brand-500/10 hover:shadow-lg"
        >
          {saved ? "✓ Đã lưu cài đặt" : "Lưu thay đổi"}
        </button>
      </PageHeader>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Thông tin Quán F&B */}
        <Panel 
          title="Thông tin Quán F&B" 
          subtitle="Tên hiển thị trên hóa đơn và thông tin liên hệ hỗ trợ"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tên cửa hàng / Thương hiệu</label>
              <input 
                className="input" 
                value={storeName} 
                onChange={(e) => setStoreName(e.target.value)} 
                placeholder="Nhập tên quán..." 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hotline / Zalo hỗ trợ</label>
              <input 
                className="input" 
                value={hotline} 
                onChange={(e) => setHotline(e.target.value)} 
                placeholder="0901234567" 
              />
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Tích hợp SePay QR (Đối soát tự động) */}
          <Panel 
            title="Tích hợp SePay QR (Đối soát tự động)" 
            subtitle="Tự động bắt giao dịch ngân hàng & xác nhận đơn"
          >
            <div className="space-y-5">
              {settings.isLocalPublicBaseUrl && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-900 shadow-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-white text-[11px]">!</span>
                  <div>
                    <strong className="block font-bold">PUBLIC_BASE_URL là localhost</strong>
                    Cần dùng ngrok để SePay gửi webhook thực tế.
                  </div>
                </div>
              )}

              <ConfigField 
                label="PUBLIC BASE URL (Domain hệ thống)" 
                value={settings.publicBaseUrl} 
                hint="Domain nhận webhook" 
              />

              <ConfigField 
                label="SePay Webhook URL" 
                value={settings.sepayWebhookUrl} 
                hint="Dán URL này vào cấu hình SePay.vn" 
              />

              {/* Trạng thái SePay */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    </span>
                    <h3 className="text-sm font-bold text-slate-800">Trạng thái SePay Webhook</h3>
                  </div>
                  <Badge tone="green">Đã kết nối thành công</Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tự động gạch nợ đơn hàng và bắn thông báo sang nhóm Pha chế ngay khi ngân hàng báo Có.
                </p>
              </div>
            </div>
          </Panel>

          {/* Telegram Bot Staff (Phục vụ & Pha chế) */}
          <Panel 
            title="Telegram Bot Nhân viên" 
            subtitle="Cấu hình kết nối Bot cho Phục vụ & Pha chế"
          >
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Bot API Token</label>
                <input 
                  type="password"
                  className="input font-mono" 
                  value={botToken} 
                  onChange={(e) => setBotToken(e.target.value)} 
                />
              </div>

              <ConfigField 
                label="Telegram Webhook URL" 
                value={settings.telegramWebhookUrl} 
                hint="Tự động cập nhật qua Telegram API" 
              />

              {/* Bot Role Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">1. Phục vụ</span>
                    <Badge tone="blue">WAITER</Badge>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Tạo đơn nhanh cho khách tại bàn bằng Bot Telegram.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">2. Pha chế</span>
                    <Badge tone="amber">BARISTA</Badge>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Nhận đơn realtime & nhấn "Hoàn tất món".
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </div>

      </form>
    </div>
  );
}
