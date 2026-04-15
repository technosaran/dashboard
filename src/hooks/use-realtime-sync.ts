
import { useEffect } from "react";

/**
 * A hook to handle mobile PWA real-time synchronization.
 * It forces a refresh of data when the app returns from background.
 */
export function useRealTimeSync(onSync: () => void) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    // Throttle the sync to prevent spamming the database
    let lastSync = 0;
    const sync = () => {
      const now = Date.now();
      if (now - lastSync > 2000) {
        onSync();
        lastSync = now;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") sync();
    };

    const handleFocus = () => sync();
    const handleOnline = () => sync();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    // Also sync on mount
    sync();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, [onSync]);
}
