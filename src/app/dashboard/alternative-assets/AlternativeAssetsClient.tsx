"use client";

import { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { addAlternativeAsset, updateAlternativeAsset, deleteAlternativeAsset } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { format, parseISO } from "date-fns";

const CATEGORIES = [
  { label: "Real Estate", icon: "🏙️" },
  { label: "Gold / Precious Metals", icon: "🏆" },
  { label: "Physical Assets", icon: "📦" },
  { label: "Collectibles", icon: "🎨" },
  { label: "Private Equity", icon: "🤝" },
  { label: "Crypto (Cold Storage)", icon: "🔐" },
  { label: "Others", icon: "🎯" },
];

export default function AlternativeAssetsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { alternativeAssets }, isValidating } = useFinanceData(initialData);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    category: "Real Estate",
    purchase_price: "",
    current_value: "",
    purchase_date: "",
    notes: "",
  });

  const stats = useMemo(() => {
    const totalValue = alternativeAssets.reduce((s, a) => s + Number(a.current_value), 0);
    const totalCost = alternativeAssets.reduce((s, a) => s + Number(a.purchase_price), 0);
    const netGrowth = totalValue - totalCost;
    const growthPercent = totalCost > 0 ? (netGrowth / totalCost) * 100 : 0;
    return { totalValue, netGrowth, growthPercent };
  }, [alternativeAssets]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...formData,
      purchase_price: parseFloat(formData.purchase_price),
      current_value: parseFloat(formData.current_value),
      purchase_date: formData.purchase_date || undefined,
    };

    const res = editingId 
      ? await updateAlternativeAsset(editingId, payload)
      : await addAlternativeAsset(payload);

    if (!res.error) {
      toast.success(editingId ? "Asset updated" : "Asset established");
      setShowAddModal(false);
      setEditingId(null);
      setFormData({ name: "", category: "Real Estate", purchase_price: "", current_value: "", purchase_date: "", notes: "" });
    } else toast.error(res.error);
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Alternative Assets</h1>
          <p className="text-xs text-[--text-muted] font-bold uppercase tracking-[0.3em] mt-2">Physical & Private Equity Holdings</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary !h-11 shadow-[0_0_20px_rgba(var(--accent-primary-rgb),0.4)]">Add New Asset</button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Valuation", value: stats.totalValue, sub: "Market Value", color: "text-white", icon: "🏛️" },
          { label: "Net Growth", value: stats.netGrowth, sub: "Unrealized Gain", color: stats.netGrowth >= 0 ? "text-[--success]" : "text-[--danger]", icon: "📈" },
          { label: "ROI", value: stats.growthPercent, sub: "Historical Appreciation", color: stats.netGrowth >= 0 ? "text-[--success]" : "text-[--danger]", icon: "💎", isPercent: true },
        ].map((s, i) => (
          <div key={i} className="glass-card-static p-6 border-white/5 hover:border-white/10 transition-all group relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-4xl opacity-[0.03] group-hover:opacity-[0.07] transition-opacity rotate-12">{s.icon}</div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">{s.label}</p>
            <p className={`text-2xl font-black tabular-nums ${s.color}`}>
              {s.isPercent ? `${s.value.toFixed(1)}%` : `₹${s.value.toLocaleString()}`}
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {alternativeAssets.map((asset) => {
          const category = CATEGORIES.find(c => c.label === asset.category) || CATEGORIES[6];
          const gain = Number(asset.current_value) - Number(asset.purchase_price);
          const gainPercent = (gain / Number(asset.purchase_price)) * 100;
          
          return (
            <div key={asset.id} className="glass-card flex flex-col min-h-[280px] p-6 relative overflow-hidden transition-transform hover:-translate-y-1 group border-white/5">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[--accent-primary] via-[--accent-secondary] to-[--accent-tertiary]" />
              
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                 <button onClick={() => {
                   setEditingId(asset.id);
                   setFormData({
                     name: asset.name,
                     category: asset.category,
                     purchase_price: asset.purchase_price.toString(),
                     current_value: asset.current_value.toString(),
                     purchase_date: asset.purchase_date || "",
                     notes: asset.notes || "",
                   });
                   setShowAddModal(true);
                 }} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-[--text-muted] flex items-center justify-center hover:bg-white/10 hover:text-white transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                 </button>
                 <button onClick={() => { if(confirm("Delete this asset record?")) deleteAlternativeAsset(asset.id); }} className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 </button>
              </div>

              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[--accent-primary]/10 flex items-center justify-center text-xl shadow-inner border border-white/5">
                    {category.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white group-hover:text-[--accent-primary-light] transition-colors">{asset.name}</h3>
                    <p className="text-[10px] font-bold text-[--text-muted] uppercase tracking-[0.2em] mt-0.5">{asset.category}</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto space-y-6">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Market Valuation</span>
                  <span className="text-2xl font-black text-white tabular-nums">₹{asset.current_value.toLocaleString()}</span>
                </div>
                
                <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-[8px] font-black text-[--text-muted] uppercase tracking-widest mb-1">Buy Price</p>
                    <p className="text-[13px] font-black text-white tabular-nums">₹{asset.purchase_price.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-right">
                    <p className="text-[8px] font-black text-[--text-muted] uppercase tracking-widest mb-1">Appreciation</p>
                    <p className={`text-[13px] font-black tabular-nums ${gain >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
                      {gain >= 0 ? "+" : "-"}{Math.abs(gainPercent).toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                {asset.purchase_date && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <div className="status-dot scale-75 bg-[--success]" />
                    <span className="text-[9px] font-bold text-[--text-muted] uppercase tracking-widest">Holding Since {format(parseISO(asset.purchase_date), "MMM yyyy")}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/90 backdrop-blur-xl animate-fade-in shadow-2xl">
          <div className="glass-card-static w-full max-w-2xl p-6 md:p-10 border-[--accent-primary]/20 shadow-[0_0_100px_rgba(14,165,233,0.1)] max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-black">{editingId ? "Update Asset" : "Establish Asset"}</h2>
              <button onClick={() => { setShowAddModal(false); setEditingId(null); }} className="text-[--text-muted] hover:text-white transition-colors"><svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Asset Name</label>
                  <input required className="input-premium" placeholder="e.g. 2BHK Apartment - Mumbai" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Classification</label>
                  <select className="input-premium" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Acquisition Cost (₹)</label>
                  <input required type="number" className="input-premium" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Current Valuation (₹)</label>
                  <input required type="number" className="input-premium" value={formData.current_value} onChange={e => setFormData({...formData, current_value: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Acquisition Date</label>
                  <input type="date" className="input-premium" value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Inventory Notes / Location</label>
                  <textarea className="input-premium min-h-[100px] py-4" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full shadow-xl shadow-[--accent-primary]/20 mt-4">
                {submitting ? "Processing..." : editingId ? "Update Entry" : "Establish Entry"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
