import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  loading: boolean;
  value?: T | undefined;
  error?: string | undefined;
}

export function useReloadableAsyncValue<T>(
  loader: () => Promise<T>,
  dependencies: readonly unknown[]
): AsyncState<T> & { reload: () => void } {
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  const [state, setState] = useState<AsyncState<T>>({
    loading: true
  });

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    let active = true;

    setState({
      loading: true
    });

    void loaderRef.current()
      .then((value) => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          value
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          error:
            error instanceof Error ? error.message : "Unknown interactive loading failure."
        });
      });

    return () => {
      active = false;
    };
  }, [version, ...dependencies]);

  return {
    ...state,
    reload
  };
}
