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
    // Whenever the route changes, complete the progress bar
    NProgress.done();
    
    // As a backup, if nprogress is stuck, clear it after a delay
    const timer = setTimeout(() => {
      NProgress.done();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  return null;
}
