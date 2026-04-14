
import { useEffect } from "react";

/**
 * A hook to handle mobile PWA real-time synchronization.
 * It forces a refresh of data when the app returns from background.
 */
export function useRealTimeSync(onSync: () => void) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("PWA Resumed: Triggering real-time sweep...");
        onSync();
      }
    };

    const handleFocus = () => {
       // Also sync on window focus (useful for desktop tabs)
       onSync();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [onSync]);
}
