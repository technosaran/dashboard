"use client";

import { useEffect, useState } from "react";

export default function PwaSecurityManager() {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    // 1. PWA Service Worker Registration
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("Service Worker registered successfully with scope: ", reg.scope);
          })
          .catch((err) => {
            console.warn("Service Worker registration failed: ", err);
          });
      });
    }

    // 2. Window Blur/Focus Event Listeners for Privacy Shield
    const handleBlur = () => {
      setIsBlurred(true);
    };

    const handleFocus = () => {
      setIsBlurred(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
      } else {
        setIsBlurred(false);
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!isBlurred) return null;

  return (
    <div 
      className="window-blur-overlay active"
      onClick={() => setIsBlurred(false)}
    >
      <div className="flex flex-col items-center justify-center p-6 text-center max-w-xs space-y-4 animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-[--accent-primary]/15 border border-[--accent-primary]/30 flex items-center justify-center shadow-lg shadow-[--accent-primary]/10">
          <svg className="w-8 h-8 text-[--accent-primary-light] animate-pulse" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-black tracking-tight text-white">Console Locked</h3>
          <p className="text-xs text-[--text-secondary]">Visual shielding active. Tap anywhere to resume your session.</p>
        </div>
        <button type="button" 
          className="btn-primary !h-10 text-[10px] font-black uppercase tracking-widest px-6 w-full"
          onClick={() => setIsBlurred(false)}
        >
          Unlock Session
        </button>
      </div>
    </div>
  );
}
