"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { login, signup } from "./actions";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import zxcvbn from "zxcvbn";
import "./login.css";

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15000;

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const failCountRef = useRef(0);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLockout = useCallback((durationMs: number, customUntil?: number) => {
    const until = customUntil || (Date.now() + durationMs);
    setLockoutUntil(until);
    setLockoutSeconds(Math.ceil((until - Date.now()) / 1000));

    if (!customUntil) {
      localStorage.setItem("lockoutUntil", until.toString());
    }

    if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
    lockoutTimerRef.current = setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutSeconds(0);
        localStorage.removeItem("lockoutUntil");
        if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
      } else {
        setLockoutSeconds(remaining);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    const savedUntil = localStorage.getItem("lockoutUntil");
    const savedFails = localStorage.getItem("failCount");
    
    if (savedFails) {
      failCountRef.current = parseInt(savedFails, 10);
    }
    
    if (savedUntil) {
      const until = parseInt(savedUntil, 10);
      if (until > Date.now()) {
        setTimeout(() => {
          startLockout(until - Date.now(), until);
        }, 0);
      } else {
        localStorage.removeItem("lockoutUntil");
        localStorage.removeItem("failCount");
        failCountRef.current = 0;
      }
    }
  }, [startLockout]);

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message || "Failed to sign in with Google.");
        setLoading(false);
      } else {
        setTimeout(() => {
          setLoading(false);
        }, 5000);
      }
    } catch {
      setError("An unexpected error occurred during Google sign-in.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (lockoutUntil && Date.now() < lockoutUntil) return;

    setError("");
    setLoading(true);
    
    try {
      const result = isSignUp 
        ? await signup(new FormData(e.currentTarget))
        : await login(new FormData(e.currentTarget));
        
      if (result?.error) {
        failCountRef.current += 1;
        localStorage.setItem("failCount", failCountRef.current.toString());
        setError(result.error);
        setLoading(false);

        if (failCountRef.current >= MAX_ATTEMPTS) {
          const multiplier = Math.pow(2, failCountRef.current - MAX_ATTEMPTS);
          startLockout(LOCKOUT_DURATION_MS * multiplier);
        }
      } else {
        failCountRef.current = 0;
        localStorage.removeItem("failCount");
        localStorage.removeItem("lockoutUntil");
        
        router.refresh();
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  const isLockedOut = lockoutSeconds > 0;
  const passwordStrength = zxcvbn(passwordInput);

  return (
    <div className="login-wrapper relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#03050a]">
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-[120px] mix-blend-screen animate-blob" />
        <div className="absolute top-1/3 -right-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-2000" />
        <div className="absolute -bottom-1/4 left-1/3 w-[700px] h-[700px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-4000" />
        
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] opacity-20" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[440px] px-6 py-12"
      >
        <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20 mb-5">
              <svg width="24" height="24" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">
              artha<span className="text-sky-400">X</span>
            </h1>
            <p className="text-sm font-medium text-white/50">
              Enterprise Wealth Terminal
            </p>
          </div>

          <div className="relative flex bg-white/5 p-1 rounded-xl mb-8 w-full border border-white/10">
            <motion.div 
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg z-0"
              initial={false}
              animate={{ 
                x: isSignUp ? "100%" : "0%",
                backgroundColor: isSignUp ? "#10b981" : "#0ea5e9"
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{ boxShadow: isSignUp ? "0 4px 12px rgba(16, 185, 129, 0.3)" : "0 4px 12px rgba(14, 165, 233, 0.3)" }}
            />
            <button 
              type="button" 
              onClick={() => { setIsSignUp(false); setError(""); }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg z-10 transition-colors ${!isSignUp ? "text-white" : "text-white/50 hover:text-white/80"}`}
            >
              Sign In
            </button>
            <button 
              type="button" 
              onClick={() => { setIsSignUp(true); setError(""); }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg z-10 transition-colors ${isSignUp ? "text-white" : "text-white/50 hover:text-white/80"}`}
            >
              Sign Up
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || isLockedOut}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Or Email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-5">
            <AnimatePresence mode="popLayout">
              <motion.div 
                layout 
                className={`relative transition-colors duration-300 ${focused === "email" ? "text-sky-400" : "text-white/40"}`}
              >
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="2" y="4" width="20" height="16" rx="3" />
                    <path d="M22 7l-10 7L2 7" />
                  </svg>
                </div>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  disabled={isLockedOut}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  className="w-full bg-black/20 border border-white/10 text-white text-sm rounded-xl px-11 py-3.5 outline-none focus:border-sky-500/50 focus:bg-black/40 transition-all placeholder:text-white/20"
                />
              </motion.div>

              <motion.div 
                layout 
                className={`relative transition-colors duration-300 ${focused === "password" ? "text-sky-400" : "text-white/40"}`}
              >
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="3" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                    <circle cx="12" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  disabled={isLockedOut}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  className="w-full bg-black/20 border border-white/10 text-white text-sm rounded-xl px-11 py-3.5 outline-none focus:border-sky-500/50 focus:bg-black/40 transition-all placeholder:text-white/20"
                />
              </motion.div>

              {isSignUp && passwordInput && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="text-[11px] mt-1">
                    <div className="flex justify-between mb-2 font-medium">
                      <span className="text-white/40">Strength</span>
                      <span className={
                        passwordStrength.score === 0 ? "text-rose-500" :
                        passwordStrength.score === 1 ? "text-rose-400" :
                        passwordStrength.score === 2 ? "text-amber-400" :
                        passwordStrength.score === 3 ? "text-emerald-400" :
                        "text-emerald-500 font-bold"
                      }>
                        {["Very Weak", "Weak", "Fair", "Strong", "Very Strong"][passwordStrength.score]}
                      </span>
                    </div>
                    <div className="flex gap-1.5 h-1.5">
                      {[0,1,2,3].map((idx) => (
                        <div 
                          key={idx}
                          className={`flex-1 rounded-full transition-all duration-300 ${
                            passwordStrength.score > idx 
                              ? (passwordStrength.score < 3 ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]") 
                              : (passwordStrength.score === 0 && idx === 0 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" : "bg-white/10")
                          }`} 
                        />
                      ))}
                    </div>
                    {passwordStrength.feedback.warning && (
                      <p className="text-rose-400 mt-2 text-[10px]">{passwordStrength.feedback.warning}</p>
                    )}
                    {passwordInput.length > 0 && passwordInput.length < 12 && (
                      <p className="text-rose-400 mt-2 text-[10px]">At least 12 characters required.</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isSignUp && (
              <div className="text-right">
                <Link href="/reset-password" className="text-[11px] font-semibold text-white/40 hover:text-white transition-colors">
                  Forgot password?
                </Link>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {isLockedOut && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-xs font-medium"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Too many attempts. Try again in {lockoutSeconds}s
              </motion.div>
            )}

            <motion.button
              layout
              type="submit"
              disabled={loading || isLockedOut}
              whileTap={{ scale: (loading || isLockedOut) ? 1 : 0.98 }}
              className="relative w-full h-12 mt-2 rounded-xl text-white text-sm font-bold tracking-wide overflow-hidden transition-all disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              <div className={`absolute inset-0 transition-colors duration-300 ${isSignUp ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-sky-500 hover:bg-sky-400'}`} />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              
              <div className="relative flex items-center justify-center gap-2 h-full">
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    {isSignUp ? "Creating Account..." : "Signing In..."}
                  </>
                ) : (
                  <>
                    {isSignUp ? "Create Account" : "Sign In"}
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </>
                )}
              </div>
            </motion.button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center gap-4">
            <div className="flex items-center gap-4 text-[11px] font-medium text-white/30">
              <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy</Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-white/70 transition-colors">Terms</Link>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
