"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "warning";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<{ push: (message: string, type?: ToastType) => void }>({
  push: () => {},
});

export const useToast = () => useContext(ToastContext);

const ICONS: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
};

const STYLES: Record<ToastType, string> = {
  success: "border-emerald-200 bg-white",
  error: "border-red-200 bg-white",
  warning: "border-amber-200 bg-white",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++idRef.current;
      setItems((prev) => [...prev.slice(-3), { id, type, message }]);
      if (type !== "error") {
        window.setTimeout(() => remove(id), 4000);
      }
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg shadow-slate-900/10 animate-[toastIn_.25s_ease-out] ${STYLES[t.type]}`}
            role={t.type === "error" ? "alert" : "status"}
          >
            <span className="text-base leading-none">{ICONS[t.type]}</span>
            <p className="flex-1 text-sm leading-snug text-ink">{t.message}</p>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => remove(t.id)}
              className="cursor-pointer text-slate-400 transition hover:text-slate-600"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
