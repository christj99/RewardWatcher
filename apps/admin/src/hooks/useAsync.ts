import { useCallback, useEffect, useState } from "react";

export function useAsync<T>(
  load: () => Promise<T>,
  dependencies: unknown[] = [],
): {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  reload: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await load());
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Request failed."));
    } finally {
      setIsLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, isLoading, reload, setData };
}
