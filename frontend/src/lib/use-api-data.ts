"use client";

import { useCallback, useEffect, useState } from "react";

export function useApiData<T>(loader: () => Promise<T>, initialValue: T) {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    const task = Promise.resolve().then(reload);
    return () => { void task; };
  }, [reload]);
  return { data, setData, loading, error, reload };
}
