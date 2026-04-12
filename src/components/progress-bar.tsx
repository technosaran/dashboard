"use client";

import { useEffect } from "react";
import NProgress from "nprogress";
import { usePathname, useSearchParams } from "next/navigation";

export default function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.configure({ showSpinner: false });
  }, []);

  useEffect(() => {
    // ── Instant Interaction Feedback ────────────────────────
    // Listen for all clicks on the page. If it's a link, start the progress bar.
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (
        anchor && 
        anchor.href && 
        anchor.href.startsWith(window.location.origin) && 
        !anchor.href.includes("#") &&
        anchor.target !== "_blank"
      ) {
        NProgress.start();
      }
    };

    window.addEventListener("click", handleAnchorClick);
    return () => window.removeEventListener("click", handleAnchorClick);
  }, []);

  useEffect(() => {
    // Whenever the route changes (or finishes), complete the progress bar
    NProgress.done();
    
    // Clear any stuck progress bars
    const timer = setTimeout(() => {
      NProgress.done();
    }, 8000);
    
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  return null;
}
