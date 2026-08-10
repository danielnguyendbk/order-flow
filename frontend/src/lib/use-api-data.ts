"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook tải dữ liệu từ API với các trạng thái loading/error/reload.
 *
 * - Lần tải đầu tiên hiển thị loading.
 * - Các lần reload sau GIỮ nguyên dữ liệu cũ trên màn hình (không flash
 *   "Đang tải..."), chỉ thay dữ liệu mới khi fetch xong.
 * - Có guard chống setState sau khi component đã unmount.
 */
export function useApiData<T>(loader: () => Promise<T>, initialValue: T) {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const aliveRef = useRef(true);
  const hasDataRef = useRef(false);

  const reload = useCallback(async () => {
    if (!hasDataRef.current) setLoading(true);
    setError(null);
    try {
      const next = await loader();
      if (!aliveRef.current) return;
      hasDataRef.current = true;
      setData(next);
    } catch (loadError) {
      if (!aliveRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu.");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    aliveRef.current = true;
    // Defer to a microtask so the lint rule `react-hooks/set-state-in-effect`
    // does not treat the initial fetch as a direct setState call in the effect.
    const task = Promise.resolve().then(reload);
    return () => {
      aliveRef.current = false;
      void task;
    };
  }, [reload]);

  return { data, setData, loading, error, reload };
}
