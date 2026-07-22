"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { login, signup } from "./actions";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import zxcvbn from "zxcvbn";
import "./login.css";

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15000;

const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 30 } }
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
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
      setTimeout(() => {
        setError(decodeURIComponent(urlError));
      }, 0);
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

  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (lockoutUntil && Date.now() < lockoutUntil) return;

    setError("");
    setSuccessMessage("");
    setLoading(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      const result = isSignUp 
        ? await signup(formData)
        : await login(formData);
        
      if (result?.error) {
        failCountRef.current += 1;
        localStorage.setItem("failCount", failCountRef.current.toString());
        setError(result.error);
        setLoading(false);

        if (failCountRef.current >= MAX_ATTEMPTS) {
          const multiplier = Math.pow(2, failCountRef.current - MAX_ATTEMPTS);
          startLockout(LOCKOUT_DURATION_MS * multiplier);
        }
      } else if (result?.requiresVerification) {
        setLoading(false);
        setError("");
        setSuccessMessage(result.message || "Account created! Please check your email or sign in.");
        setIsSignUp(false);
      } else {
        failCountRef.current = 0;
        localStorage.removeItem("failCount");
        localStorage.removeItem("lockoutUntil");
        
        window.location.href = "/dashboard";
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  const isLockedOut = lockoutSeconds > 0;
  const passwordStrength = zxcvbn(passwordInput);

  return (
    <div className="login-wrapper relative min-h-screen w-full flex flex-col lg:flex-row bg-[#03050a] font-sans selection:bg-sky-500/30">
      
      {/* Background Noise Texture */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* Left Pane - Branding & Effects */}
      <div className="relative hidden lg:flex flex-col w-1/2 overflow-hidden bg-[#03050a] justify-between p-12 lg:p-20 border-r border-white/5">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-[120px] mix-blend-screen animate-blob" />
          <div className="absolute top-1/3 -right-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-2000" />
          <div className="absolute -bottom-1/4 left-1/3 w-[700px] h-[700px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-4000" />
          
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] opacity-20" />
        </div>

        <div className="relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20 mb-8">
            <svg width="24" height="24" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-[clamp(2.5rem,4vw,3.5rem)] font-black text-white tracking-tight mb-4">
            artha<span className="text-sky-400">X</span>
          </h1>
          <p className="text-lg font-medium text-white/50 max-w-md leading-relaxed">
            Enterprise Wealth Terminal. Unify your assets, optimize your portfolio, and track performance in real-time.
          </p>
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </div>
            <span className="text-xs font-semibold text-white/80 tracking-wide uppercase">Systems Operational</span>
          </div>
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="relative flex flex-col items-center justify-center w-full lg:w-1/2 p-6 sm:p-12 min-h-screen lg:min-h-0 bg-[#03050a] lg:bg-transparent overflow-hidden">
        
        {/* Mobile Background Fallback */}
        <div className="absolute inset-0 z-0 lg:hidden">
          <div className="absolute top-0 -left-1/4 w-[400px] h-[400px] bg-sky-500/10 rounded-full blur-[80px] mix-blend-screen animate-blob" />
          <div className="absolute bottom-0 -right-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[80px] mix-blend-screen animate-blob animation-delay-2000" />
        </div>

        {/* The Premium Glass Card */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="relative z-10 w-full max-w-[440px] glass-card-static bg-white/[0.02] border border-white/5 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-2xl"
        >
          {/* Mobile Logo */}
          <motion.div variants={itemVariants} className="flex lg:hidden flex-col items-center text-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20 mb-4">
              <svg width="20" height="20" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              artha<span className="text-sky-400">X</span>
            </h1>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-white/50 text-sm font-medium">
              {isSignUp ? "Secure your wealth today." : "Authenticate to access your terminal."}
            </p>
          </motion.div>

          {/* Seamless Toggle Switch */}
          <motion.div variants={itemVariants} className="relative flex bg-black/40 p-1.5 rounded-[14px] mb-8 w-full border border-white/5 shadow-inner">
            <motion.div 
              className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-[10px] z-0"
              initial={false}
              animate={{ 
                x: isSignUp ? "100%" : "0%",
                backgroundColor: isSignUp ? "rgba(16, 185, 129, 0.15)" : "rgba(14, 165, 233, 0.15)",
                border: isSignUp ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(14, 165, 233, 0.3)"
              }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
            <button 
              type="button" 
              onClick={() => { setIsSignUp(false); setError(""); }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-[0.1em] rounded-lg z-10 transition-colors ${!isSignUp ? "text-white" : "text-white/40 hover:text-white/70"}`}
            >
              Sign In
            </button>
            <button 
              type="button" 
              onClick={() => { setIsSignUp(true); setError(""); }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-[0.1em] rounded-lg z-10 transition-colors ${isSignUp ? "text-white" : "text-white/40 hover:text-white/70"}`}
            >
              Sign Up
            </button>
          </motion.div>

          <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-5">
            <AnimatePresence mode="popLayout">
              {/* Floating Label Email Field */}
              <motion.div variants={itemVariants} layout key="email-field" className="relative group">
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  disabled={isLockedOut}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="peer w-full bg-white/[0.03] border border-white/10 text-white text-sm rounded-xl px-4 pt-6 pb-2 outline-none focus:border-sky-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_15px_rgba(14,165,233,0.1)] transition-all placeholder-transparent"
                  placeholder=" "
                />
                <label 
                  htmlFor="login-email"
                  className="absolute left-4 top-2 text-[0.55rem] font-black text-white/50 transition-all duration-300 pointer-events-none uppercase tracking-wider peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:text-white/30 peer-focus:top-2 peer-focus:text-[0.55rem] peer-focus:font-black peer-focus:text-sky-400"
                >
                  Email Address
                </label>
              </motion.div>

              {/* Floating Label Password Field */}
              <motion.div variants={itemVariants} layout key="password-field" className="relative group">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  disabled={isLockedOut}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="peer w-full bg-white/[0.03] border border-white/10 text-white text-sm rounded-xl px-4 pt-6 pb-2 pr-12 outline-none focus:border-sky-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_15px_rgba(14,165,233,0.1)] transition-all placeholder-transparent"
                  placeholder=" "
                />
                <label 
                  htmlFor="login-password"
                  className="absolute left-4 top-2 text-[0.55rem] font-black text-white/50 transition-all duration-300 pointer-events-none uppercase tracking-wider peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:text-white/30 peer-focus:top-2 peer-focus:text-[0.55rem] peer-focus:font-black peer-focus:text-sky-400"
                >
                  Password
                </label>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </motion.div>

              {/* Password Strength Meter (Sign Up Only) */}
              {isSignUp && passwordInput ? (
                <motion.div 
                  key="password-strength"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="text-xs pt-1">
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
                    <div className="flex gap-1.5 h-1">
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
                      <p className="text-rose-400 mt-2 text-xs">{passwordStrength.feedback.warning}</p>
                    )}
                    {passwordInput.length > 0 && passwordInput.length < 12 && (
                      <p className="text-rose-400 mt-2 text-xs">At least 12 characters required.</p>
                    )}
                  </div>
                </motion.div>
              ) : null}

              {/* Extras (Remember me & Forgot password) */}
              {!isSignUp && (
                <motion.div variants={itemVariants} layout key="extras" className="flex items-center justify-between mt-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${rememberMe ? 'bg-sky-500 border-sky-500' : 'bg-black/30 border-white/20 group-hover:border-white/40'} border`}>
                      {rememberMe && (
                        <svg width="10" height="10" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs font-medium text-white/50 group-hover:text-white/80 transition-colors select-none">Remember me</span>
                    <input type="checkbox" className="hidden" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} />
                  </label>
                  
                  <Link href="/reset-password" className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors">
                    Forgot password?
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {successMessage ? (
                <motion.div 
                  key="success-message"
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: "auto", scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-medium mt-1">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{successMessage}</span>
                  </div>
                </motion.div>
              ) : null}

              {error ? (
                <motion.div 
                  key="error-message"
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: "auto", scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium mt-1">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="flex-shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    <span>{error}</span>
                  </div>
                </motion.div>
              ) : null}
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
              variants={itemVariants}
              layout
              type="submit"
              disabled={loading || isLockedOut}
              whileTap={{ scale: (loading || isLockedOut) ? 1 : 0.98 }}
              className="relative w-full h-12 mt-4 rounded-xl text-white text-sm font-bold tracking-wide overflow-hidden transition-all shadow-[0_4px_20px_rgba(0,0,0,0.3)] disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              <div className={`absolute inset-0 transition-colors duration-300 ${isSignUp ? 'bg-emerald-500 hover:bg-emerald-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]' : 'bg-sky-500 hover:bg-sky-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'}`} />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              
              <div className="relative flex items-center justify-center gap-2 h-full">
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    {isSignUp ? "Creating Account..." : "Authenticating..."}
                  </>
                ) : (
                  <>
                    {isSignUp ? "Create Account" : "Access Terminal"}
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </>
                )}
              </div>
            </motion.button>
          </form>

          <motion.div variants={itemVariants} className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-[0.65rem] font-bold text-white/30 uppercase tracking-[0.2em]">Or connect with</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/10" />
          </motion.div>

          <motion.button
            variants={itemVariants}
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || isLockedOut}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl text-white text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Google</span>
          </motion.button>

          <motion.div variants={itemVariants} className="mt-8 pt-6 border-t border-white/5 flex flex-col justify-center items-center">
            <div className="flex items-center gap-4 text-xs font-medium text-white/30">
              <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy Policy</Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-white/70 transition-colors">Terms of Service</Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
