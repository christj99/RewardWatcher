import { useCallback, useEffect, useState } from "react";

import { errorMessage } from "../api/errors.js";

export type AsyncState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  reload: () => void;
};

export function useAsync<T>(
  load: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    load()
      .then((value) => {
        if (!cancelled) {
          setData(value);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [version, ...deps]);

  return { data, error, isLoading, reload };
}
