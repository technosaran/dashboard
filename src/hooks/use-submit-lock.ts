import { useRef, useState, useCallback } from "react";

type SubmitHandler<T = void> = () => Promise<T>;

export function useSubmitLock<T = void>(): [boolean, (handler: SubmitHandler<T>) => Promise<T | undefined>] {
  const [submitting, setSubmitting] = useState(false);
  const lockRef = useRef(false);

  const withLock = useCallback(async (handler: SubmitHandler<T>): Promise<T | undefined> => {
    if (lockRef.current) {
      return undefined;
    }

    lockRef.current = true;
    setSubmitting(true);

    try {
      const result = await handler();
      return result;
    } finally {
      setSubmitting(false);
      lockRef.current = false;
    }
  }, []);

  return [submitting, withLock];
}
