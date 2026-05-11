"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { addIncome } from "./actions";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";

import { exportToCSV } from "@/lib/export-csv";

import { CHART_COLOURS } from "@/lib/chart-colours";
function getColorByLabel(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return CHART_COLOURS[hash % CHART_COLOURS.length];
}

const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false, loading: () => <div className="skeleton h-full w-full rounded-2xl border border-white/5" /> }
);
const PieChart = dynamic(() => import("recharts").then((mod) => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((mod) => mod.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((mod) => mod.Cell), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((mod) => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((mod) => mod.Area), { ssr: false });



const INCOME_CATEGORIES = [
  { label: "Salary", icon: "🏢", color: CHART_COLOURS[0] },
  { label: "Work", icon: "💻", color: CHART_COLOURS[1] },
  { label: "Freelance", icon: "🚀", color: CHART_COLOURS[2] },
  { label: "Gift", icon: "💝", color: CHART_COLOURS[3] },
  { label: "Bonus", icon: "✨", color: CHART_COLOURS[4] },
  { label: "Refund", icon: "↩️", color: CHART_COLOURS[5] },
  { label: "Others", icon: "📦", color: CHART_COLOURS[6] },
];



export default function IncomeClient({ initialData }: { initialData?: FinanceData }) {

  const { data: { incomes, accounts }, isValidating } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams.get("action") === "new");
  const [submitting, setSubmitting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Salary",
    date: new Date().toISOString().split("T")[0],
    account_id: "",
  });



  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = incomes.filter(i => i.date && isWithinInterval(parseISO(i.date), { start: startOfMonth(now), end: endOfMonth(now) }));
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
    const monthlyTotal = currentMonth.reduce((s, i) => s + Number(i.amount), 0);
    
    // YoY comparison - same month last year
    const lastYearSameMonth = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const lastYearIncomes = incomes.filter(i => 
      i.date && isWithinInterval(parseISO(i.date), { 
        start: startOfMonth(lastYearSameMonth), 
        end: endOfMonth(lastYearSameMonth) 
      })
    );
    const lastYearTotal = lastYearIncomes.reduce((s, i) => s + Number(i.amount), 0);
    const yoyChange = lastYearTotal > 0 ? ((monthlyTotal - lastYearTotal) / lastYearTotal) * 100 : 0;
    const yoyAbsolute = monthlyTotal - lastYearTotal;
    
    const catMap: Record<string, number> = {};
    incomes.forEach(i => {
      catMap[i.category] = (catMap[i.category] || 0) + Number(i.amount);
    });
    const pieData = Object.entries(catMap)
      .map(([name, value]) => {
        const categoryColor = INCOME_CATEGORIES.find((c) => c.label === name)?.color;
        const resolvedColor =
          categoryColor ||
          getColorByLabel(name);

        return {
          name,
          value,
          fill: resolvedColor,
          color: resolvedColor,
        };
      })
      .sort((a, b) => b.value - a.value);

    const trendMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      trendMap[format(d, "MMM")] = 0;
    }
    incomes.forEach(i => {
      if (!i.date) return;
      const m = format(parseISO(i.date), "MMM");
      if (trendMap[m] !== undefined) trendMap[m] += Number(i.amount);
    });
    const trendData = Object.entries(trendMap).map(([name, value]) => ({ name, value }));

    return { totalIncome, monthlyTotal, pieData, trendData, yoyChange, yoyAbsolute, lastYearTotal };
  }, [incomes]);

  const filteredIncomes = useMemo(() => {
    const filtered = incomes.filter(i => {
      const matchCat = categoryFilter === "All" || i.category === categoryFilter;
      return matchCat;
    });
    
    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [incomes, categoryFilter, currentPage]);

  const totalFilteredCount = useMemo(() => {
    return incomes.filter(i => {
      const matchCat = categoryFilter === "All" || i.category === categoryFilter;
      return matchCat;
    }).length;
  }, [incomes, categoryFilter]);

  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await addIncome({ 
      ...formData, 
      amount: parseFloat(formData.amount), 
      account_id: formData.account_id || undefined 
    });
    if (!result?.error) {
      toast.success("Revenue inflow registered successfully");
      setFormData({ description: "", amount: "", category: "Salary", date: new Date().toISOString().split("T")[0], account_id: "" });
      setShowAddModal(false);
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="md:hidden p-4 rounded-xl border border-success/20 bg-success/5 text-center mt-4">
             <h2 className="text-xl font-black text-white">Record Income</h2>
             <p className="text-[10px] text-[--text-muted] uppercase tracking-widest mt-1">Mobile Data Node</p>
             <button onClick={() => setShowAddModal(true)} className="btn-primary w-full mt-4 shadow-xl shadow-[--success]/20 bg-success hover:bg-success">Log Now</button>
             <Link href="/dashboard" className="block text-center mt-4 text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white">← System Home</Link>
          </div>
        <div className="hidden md:block">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Income Strategy</h1>
            <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
          </div>
          <p className="text-[--text-secondary] text-[13px] md:text-sm mt-1">Monitor your revenue streams and track financial growth.</p>
        </div>
        <div className="hidden md:flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => {
              try {
                exportToCSV(
                  incomes.map(i => ({
                    date: i.date ? format(parseISO(i.date), "yyyy-MM-dd") : "",
                    description: i.description,
                    category: i.category,
                    amount: Number(i.amount),
                    account: accounts.find(a => a.id === i.account_id)?.name || "Direct Log"
                  })),
                  "income_data",
                  [
                    { key: "date", label: "Date" },
                    { key: "description", label: "Description" },
                    { key: "category", label: "Category" },
                    { key: "amount", label: "Amount" },
                    { key: "account", label: "Account" }
                  ]
                );
                toast.success("Income data exported successfully");
              } catch {
                toast.error("Failed to export data");
              }
            }}
            className="btn-secondary gap-2"
            title="Export to CSV"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4M3 16v2a2 2 0 002 2h14a2 2 0 002-2v-2" /></svg>
            Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex-1 md:flex-none gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            Log Income
          </button>
        </div>
      </div>

      <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between group">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Net Throughput</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate text-success">
              +₹{stats.totalIncome.toLocaleString()}
            </h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-bold">Lifetime</span>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Monthly Flow</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate text-success">
              +₹{stats.monthlyTotal.toLocaleString()}
            </h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-[--accent-primary]/10 text-[--accent-primary] border border-[--accent-primary]/20 font-bold">{format(new Date(), "MMM")}</span>
          </div>
          {stats.lastYearTotal > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs font-black ${stats.yoyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.yoyChange >= 0 ? '↑' : '↓'} {Math.abs(stats.yoyChange).toFixed(1)}%
              </span>
              <span className="text-[9px] text-[--text-muted] font-bold">vs last year</span>
            </div>
          )}
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Average</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate text-success">
              +₹{(incomes.length ? stats.totalIncome / incomes.length : 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
            </h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-white/5 text-[--text-muted]">{incomes.length} pts</span>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between bg-gradient-to-br from-sky-500/10 to-transparent">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Primary Source</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate">{stats.pieData[0]?.name || "None"}</h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-white/5 text-[--text-muted]">Top</span>
          </div>
        </div>
      </div>

      <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card-static p-5 md:p-8">
          <div className="flex items-center justify-between mb-8"><h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">Income Velocity</h3><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-[--text-muted]">Inbound Flow</span></div></div>
          <div className="h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.trendData}><defs><linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={10} /><YAxis hide /><Tooltip contentStyle={{background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px'}} cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1}} /><Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#incomeGradient)" /></AreaChart></ResponsiveContainer></div>
        </div>
        <div className="glass-card-static p-5 md:p-8"><h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-8">Source Distribution</h3><div className="h-[240px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value">{stats.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">{stats.pieData.slice(0, 4).map((item) => (<div key={item.name} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background: item.color}} /><span className="text-[10px] font-bold text-[--text-secondary] truncate">{item.name}</span></div>))}</div></div>
      </div>

      <div className="hidden md:block glass-card-static overflow-hidden border-white/5">
        <div className="p-5 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto"><select className="input-premium py-2 text-sm w-32 md:w-40" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="All">All Sources</option>{INCOME_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}</select></div>
          <div className="text-[10px] font-bold text-[--text-muted]">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalFilteredCount)} of {totalFilteredCount} results
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          {incomes.length === 0 ? (
            <div className="py-24 flex flex-col items-center text-center">
               <h3 className="text-2xl font-black text-white mb-2">Track Your Wealth Inflow</h3>
               <p className="text-sm text-[--text-muted] max-w-sm mb-8">No revenue streams detected. Start by logging your first income to visualize your growth strategy.</p>
               <button onClick={() => setShowAddModal(true)} className="btn-primary shadow-2xl shadow-[--success]/20 px-10 bg-success hover:bg-success">Log Your First Income</button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[650px] md:min-w-0">
              <thead><tr className="bg-white/[0.02] border-b border-white/5"><th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</th><th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Source</th><th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Segment</th><th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] hidden sm:table-cell">Destination</th><th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Credit</th></tr></thead>
              <tbody className="divide-y divide-white/10">
                {filteredIncomes.length === 0 ? (<tr><td colSpan={5} className="px-6 py-20 text-center text-[--text-muted] text-sm italic">Infrastructure query returned no income data.</td></tr>) : (filteredIncomes.map((inc) => { const theme = INCOME_CATEGORIES.find(c => c.label === inc.category) || INCOME_CATEGORIES[6]; const account = accounts.find(a => a.id === inc.account_id); return (<tr key={inc.id} className="hover:bg-white/[0.015] transition-colors group text-[--text-primary]"><td className="px-4 md:px-6 py-5 whitespace-nowrap"><p className="text-[13px] font-bold">{inc.date ? format(parseISO(inc.date), "MMM d, yy") : "N/A"}</p><p className="text-[9px] text-success/60 font-bold uppercase">Credit</p></td><td className="px-4 md:px-6 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">{theme.icon}</div><p className="text-[13px] font-medium group-hover:text-success transition-colors truncate max-w-[120px] md:max-w-none">{inc.description}</p></div></td><td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] bg-success/5 border border-success/10 text-success">{inc.category}</span></td><td className="px-4 md:px-6 py-5 whitespace-nowrap hidden sm:table-cell"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(0,184,148,0.5)]" /><span className="text-[11px] font-medium text-[--text-secondary]">{account?.name || "Direct Log"}</span></div></td><td className="px-4 md:px-6 py-4 whitespace-nowrap text-right"><p className="text-[15px] md:text-base font-black text-success">+₹{Number(inc.amount).toLocaleString()}</p></td></tr>); }))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
            >
              Previous
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                      currentPage === pageNum
                        ? 'bg-success text-white'
                        : 'bg-white/5 hover:bg-white/10 text-[--text-muted]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in shadow-2xl">
          <div className="glass-card-static w-full max-w-2xl p-6 md:p-10 border-emerald-500/20 shadow-[0_0_100px_rgba(16,185,129,0.1)] max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8 md:mb-10"><div className="flex items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center"><svg className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg></div><h2 className="text-xl md:text-3xl font-black">Declare Revenue</h2></div><button onClick={() => setShowAddModal(false)} className="text-[--text-muted] hover:text-[--text-primary] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"><svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleSubmit} className="space-y-8"><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">{formData.category === "Salary" ? "Company / Employer" : "Description / Source"}</label><input type="text" required className="input-premium" placeholder={formData.category === "Salary" ? "e.g. Google" : "e.g. Freelance Web Design"} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Amount Received</label><input type="number" required className="input-premium" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} /></div><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Income Stream</label><select className="input-premium" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>{INCOME_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}</select></div><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Deposit into Account</label><select className="input-premium" value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: e.target.value })}><option value="">Suspense (No Account)</option>{accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select></div></div><button type="submit" disabled={submitting} className="btn-primary w-full shadow-xl shadow-[--accent-primary]/20 mt-4">{submitting ? "Deploying..." : "Finalize Entry"}</button>
</form>
          </div>
        </div>
      )}
    </div>
  );
}
