"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    window.setTimeout(() => {
      if (username.trim() === "admin" && password === "admin12345") {
        router.push("/dashboard");
      } else {
        setError("Tài khoản hoặc mật khẩu không đúng.");
        setBusy(false);
      }
    }, 500);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 font-sans selection:bg-brand-500 selection:text-white">
      {/* Background gradients for light theme */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -left-1/4 -top-1/4 h-[800px] w-[800px] animate-pulse rounded-full bg-brand-100/60 blur-[100px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[800px] w-[800px] animate-pulse rounded-full bg-amber-100/60 blur-[100px]" style={{ animationDelay: "1.5s" }} />
      </div>

      <div className="z-10 w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="mb-8 flex flex-col items-center gap-4">
          {/* Logo Badge */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-extrabold text-white shadow-xl shadow-brand-500/20">
            F&B
            <div className="absolute -inset-0.5 -z-10 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 opacity-40 blur-sm" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý Quán</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Telegram Bot & SePay POS</p>
          </div>
        </div>

        {/* Form Container with Light Glassmorphism */}
        <form 
          onSubmit={submit} 
          className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-8 shadow-2xl shadow-slate-200/50 backdrop-blur-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <h2 className="text-xl font-bold text-slate-800">Đăng nhập Admin</h2>
            <p className="mt-1.5 text-sm text-slate-500">Vui lòng nhập thông tin quản trị viên để vào hệ thống quán.</p>

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-in fade-in slide-in-from-top-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">!</span>
                {error}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Tài khoản</label>
                <input 
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Nhập tên đăng nhập" 
                  autoComplete="username" 
                  autoFocus 
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Mật khẩu</label>
                <input 
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                  autoComplete="current-password" 
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={busy} 
              className="mt-8 flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-slate-900/10 transition-all hover:bg-slate-800 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-slate-900/20 disabled:opacity-70 disabled:hover:bg-slate-900"
            >
              {busy ? (
                <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                "Vào hệ thống"
              )}
            </button>
            <p className="mt-4 text-center text-xs text-slate-400">
              Chỉ dành cho Admin & Chủ quán.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
