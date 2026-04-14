
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[--bg-base] text-[--text-primary] selection:bg-[--accent-primary]/30 overflow-x-hidden">
      {/* ── Background Effects ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[--accent-primary]/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[--accent-primary-light]/5 blur-[120px] animate-pulse delay-700" />
      </div>

      {/* ── Navigation ── */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-8 md:px-12 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6c5ce7] to-[#a29bfe] flex items-center justify-center shadow-lg shadow-[#6c5ce7]/20 border border-white/10">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tighter">Finance<span className="text-[--accent-primary-light]">OS</span></h1>
        </div>
        <div className="flex items-center gap-6">
          <Link href={user ? "/dashboard" : "/login"} className="text-sm font-bold text-[--text-muted] hover:text-[--text-primary] transition-colors">
            {user ? "Dashboard" : "Login"}
          </Link>
          <Link href="/login" className="btn-primary !h-11 !px-8 rounded-full shadow-2xl shadow-[--accent-primary]/20">
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative z-10 pt-20 pb-32 px-6 text-center max-w-[1000px] mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card-static border-white/10 mb-8 animate-fade-in">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[--accent-primary-light] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[--accent-primary-light]"></span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[--accent-primary-light]">Version 2.0 Live</span>
        </div>
        
        <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8 animate-scale-in">
          Your Financial <br />
          <span className="bg-gradient-to-r from-[--accent-primary-light] to-[--accent-primary] bg-clip-text text-transparent">Command Center.</span>
        </h2>
        
        <p className="text-lg md:text-xl text-[--text-muted] max-w-[700px] mx-auto mb-12 font-medium leading-relaxed animate-fade-in delay-200">
          The ultimate personal wealth console for elite traders and investors. 
          Manage multi-bank accounts, equity portfolios, and mutual funds from a single, 
          institutional-grade terminal.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in delay-300">
          <Link href="/login" className="btn-primary !h-14 !px-10 !text-base rounded-2xl w-full sm:w-auto shadow-2xl shadow-[--accent-primary]/20">
            Start Your Terminal
          </Link>
          <Link href="#features" className="btn-secondary !h-14 !px-10 !text-base rounded-2xl w-full sm:w-auto border-white/5 bg-white/5 hover:bg-white/10">
            Explore Capabilities
          </Link>
        </div>

        {/* Dashboard Preview */}
        <div className="mt-24 relative animate-fade-in-up delay-500">
          <div className="absolute inset-x-0 -top-20 -bottom-20 bg-[--accent-primary]/10 blur-[100px] rounded-full opacity-50" />
          <div className="glass-card-static rounded-[2rem] p-4 border-white/10 shadow-[0_0_100px_rgba(108,92,231,0.15)] overflow-hidden">
            <div className="aspect-[16/9] w-full bg-[#0c1021] rounded-[1.5rem] relative overflow-hidden flex items-center justify-center group">
               <div className="absolute inset-0 bg-gradient-to-t from-[--bg-base] via-transparent to-transparent z-10" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[--text-muted] opacity-40 mb-4">Enterprise Architecture</p>
                    <div className="flex items-center gap-8 opacity-20 group-hover:opacity-40 transition-opacity duration-700">
                       <div className="w-32 h-20 glass-card-static" />
                       <div className="w-32 h-20 glass-card-static" />
                       <div className="w-32 h-20 glass-card-static" />
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-32 px-6 max-w-[1400px] mx-auto">
        <div className="text-center mb-20">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[--accent-primary-light] mb-4">Capabilities</h3>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">Built for Stability. <br /> Designed for Speed.</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard 
            title="Equity Terminal" 
            desc="Track stock portfolios with real-time LTP, P&L analytics, and transaction indexing."
            icon="📈"
          />
          <FeatureCard 
            title="Direct MF Asset Tracking" 
            desc="Unified mutual fund console. Automated NAV fetching and capital gains tracking."
            icon="💰"
          />
          <FeatureCard 
            title="Audit Vault" 
            desc="A permanent ledger of every financial movement. Zero-latency filtering and search."
            icon="🛡️"
          />
          <FeatureCard 
            title="Entity Syncing" 
            desc="Seamless data synchronization across all your industrial-grade devices."
            icon="⚡"
          />
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="relative z-10 py-32 px-6 border-t border-white/5">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#6c5ce7] to-[#a29bfe] flex items-center justify-center mx-auto mb-10 shadow-3xl shadow-[--accent-primary]/20">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-4xl font-black mb-6 tracking-tight">Institutional Privacy First.</h2>
          <p className="text-[--text-muted] text-lg font-medium leading-relaxed mb-10">
            FinanceOS operates on an encrypted-at-rest architecture. Your data never 
            leaves your control. No ads. No tracking. Just raw financial control.
          </p>
          <Link href="/login" className="btn-primary !h-14 !px-12 rounded-2xl shadow-2xl shadow-[--accent-primary]/20">
             Open Your Account
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-20 px-6 border-t border-white/5 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[--text-muted]">FinanceOS © 2026 • Built for the Elite</p>
      </footer>
    </div>
  );
}

function FeatureCard({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="glass-card p-10 group hover:border-[--accent-primary]/30 transition-all duration-500">
      <div className="text-4xl mb-6 grayscale group-hover:grayscale-0 transition-all duration-500 transform group-hover:scale-110">
        {icon}
      </div>
      <h4 className="text-xl font-bold mb-3 tracking-tight">{title}</h4>
      <p className="text-sm text-[--text-muted] leading-relaxed font-medium">
        {desc}
      </p>
    </div>
  );
}
