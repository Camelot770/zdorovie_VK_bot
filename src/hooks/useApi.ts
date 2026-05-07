import { useState, useEffect, useCallback } from "react";
import { clearCache } from "../api/client";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => {
    // Clear the frontend cache so pull-to-refresh gets fresh data
    clearCache();
    setRefreshing(true);
    setTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    let canceled = false;
    if (!refreshing) setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (!canceled) {
          setData(result);
          setLoading(false);
          setRefreshing(false);
        }
      })
      .catch((err) => {
        if (!canceled) {
          setError(err.message || "Ошибка загрузки");
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, ...deps]);

  return { data, loading, error, refreshing, refetch };
}
