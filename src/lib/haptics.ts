
/**
 * Utility for triggering haptic feedback on mobile devices.
 * Uses the Vibration API and the newer Haptic Feedback API if available.
 */
export const triggerHaptic = (type: "light" | "medium" | "heavy" | "success" | "error" | "warning" = "light") => {
  if (typeof window === "undefined" || !window.navigator.vibrate) return;

  const patterns: Record<string, number[]> = {
    light: [10],
    medium: [20],
    heavy: [50],
    success: [10, 30, 10],
    error: [50, 50, 50],
    warning: [30, 10, 30]
  };

  const pattern = patterns[type] || patterns.light;
  window.navigator.vibrate(pattern);
};
