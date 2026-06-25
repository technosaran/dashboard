"use client";

import { useState, useMemo, useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { logFnoTrade, closeFnoTrade, deleteFnoTrade } from "./actions";
import { useFinanceData, type FinanceData, type FnoTrade } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

import FNODataTable from "./components/FNODataTable";

export default function FnoClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { fnoTrades, accounts, profile }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showLogForm, setShowLogForm] = useState(searchParams?.get("action") === "new");
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<FnoTrade | null>(null);
  const [submitting, withLock] = useSubmitLock();
  
  // Kite uses tabs: Positions (Open), History (Closed)
  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions");

  const mounted = useHasMounted();

  const [logFormData, setLogFormData] = useState({
    symbol: "", instrument_type: "FUT" as "FUT" | "CE" | "PE", strike_price: "",
    expiry_date: "", trade_type: "BUY" as "BUY" | "SELL", quantity: "",
    entry_price: "", account_id: "", notes: "", trade_date: ""
  });

  const [closeFormData, setCloseFormData] = useState({
    exit_price: "", close_date: ""
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setLogFormData(prev => ({ ...prev, trade_date: new Date().toISOString().split("T")[0] }));
      setCloseFormData(prev => ({ ...prev, close_date: new Date().toISOString().split("T")[0] }));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && showLogForm && !logFormData.account_id) {
      const defaultAccId = profile?.default_accounts?.fno;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      if (defaultAccExists) {
        setTimeout(() => {
          setLogFormData(prev => ({ ...prev, account_id: defaultAccId }));
        }, 0);
      }
    }
  }, [accounts, profile, showLogForm, logFormData.account_id]);

  const activePositions = useMemo(() => fnoTrades.filter(t => t.status === "OPEN"), [fnoTrades]);
  const closedHistory = useMemo(() => fnoTrades.filter(t => t.status === "CLOSED"), [fnoTrades]);

  const stats = useMemo(() => {
    const totalRealizedPnL = closedHistory.reduce((acc, t) => acc + Number(t.pnl || 0), 0);
    const activeCost = activePositions.reduce((acc, t) => acc + (Number(t.quantity) * Number(t.entry_price)), 0);
    
    return { totalRealizedPnL, activeCost };
  }, [activePositions, closedHistory]);

  const pieChartData = useMemo(() => {
    const map: Record<string, number> = {};
    fnoTrades.forEach(t => {
      map[t.instrument_type] = (map[t.instrument_type] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      fill: name === "FUT" ? "#2185d0" : name === "CE" ? "#10b981" : "#f43f5e"
    }));
  }, [fnoTrades]);

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      try {
        const qty = parseFloat(logFormData.quantity);
        const price = parseFloat(logFormData.entry_price);
        const strike = logFormData.strike_price ? parseFloat(logFormData.strike_price) : undefined;
        if (isNaN(qty) || qty <= 0) { toast.error("Valid quantity required"); return; }
        if (isNaN(price) || price < 0) { toast.error("Valid entry price required"); return; }

        const res = await logFnoTrade({
          symbol: logFormData.symbol.toUpperCase().trim(),
          instrument_type: logFormData.instrument_type,
          strike_price: strike,
          expiry_date: logFormData.expiry_date,
          trade_type: logFormData.trade_type,
          quantity: qty,
          entry_price: price,
          account_id: logFormData.account_id || undefined,
          notes: logFormData.notes || undefined,
          trade_date: logFormData.trade_date
        });
        if (!res.error) {
          toast.success("FnO Trade logged successfully!");
          setShowLogForm(false);
          setLogFormData({
            symbol: "", instrument_type: "FUT", strike_price: "", expiry_date: "",
            trade_type: "BUY", quantity: "", entry_price: "", account_id: "", notes: "", trade_date: new Date().toISOString().split("T")[0]
          });
          mutate();
        } else toast.error(res.error);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to log trade.");
      }
    });
  }

  async function handleCloseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTrade) return;
    await withLock(async () => {
      try {
        const exitPrice = parseFloat(closeFormData.exit_price);
        if (isNaN(exitPrice) || exitPrice < 0) { toast.error("Valid exit price required"); return; }

        const res = await closeFnoTrade(selectedTrade.id, {
          exit_price: exitPrice,
          close_date: closeFormData.close_date
        });
        if (!res.error) {
          toast.success("Position closed successfully!");
          setShowCloseForm(false);
          setSelectedTrade(null);
          setCloseFormData({ exit_price: "", close_date: new Date().toISOString().split("T")[0] });
          mutate();
        } else toast.error(res.error);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to close position.");
      }
    });
  }

  async function handleDeleteTrade(id: string) {
    if (!confirm("Are you sure you want to delete this trade log? Reverting this log will restore linked bank/broker accounts to their pre-trade balances.")) return;
    await withLock(async () => {
      try {
        const res = await deleteFnoTrade(id);
        if (!res.error) {
          toast.success("Trade deleted");
          mutate();
        } else toast.error(res.error);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete trade.");
      }
    });
  }

  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col animate-in fade-in duration-700 w-full bg-[#121212] min-h-screen">
      {/* Kite-style Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setActiveTab("positions")} 
            className={`text-xl font-semibold transition-colors ${activeTab === "positions" ? "text-[--text-primary]" : "text-[--text-muted] hover:text-[--text-primary]"}`}
          >
            Positions ({activePositions.length})
          </button>
          <button 
            onClick={() => setActiveTab("history")} 
            className={`text-xl font-semibold transition-colors ${activeTab === "history" ? "text-[--text-primary]" : "text-[--text-muted] hover:text-[--text-primary]"}`}
          >
            History ({closedHistory.length})
          </button>
        </div>
        <button 
          onClick={() => setShowLogForm(true)}
          className="bg-[#2185d0] hover:bg-[#1678c2] text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
        >
          Add Trade
        </button>
      </div>

      <div className="p-6">
        {activeTab === "positions" && (
          <div className="animate-in fade-in">
            <FNODataTable 
              trades={activePositions}
              onCloseTrade={(trade) => {
                setSelectedTrade(trade);
                setCloseFormData(prev => ({ ...prev, close_date: new Date().toISOString().split("T")[0], exit_price: "" }));
                setShowCloseForm(true);
              }}
              onDeleteTrade={handleDeleteTrade}
              onAdd={() => setShowLogForm(true)}
              showActions={true}
            />
            
            {activePositions.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 bg-[#0a0a0a] p-4 border border-white/10 rounded-md">
                <div>
                  <p className="text-xs text-[--text-muted] mb-1">Total invested</p>
                  <p className="text-xl font-normal text-[--text-primary]">₹{formatMoney(stats.activeCost)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="animate-in fade-in">
            <FNODataTable 
              trades={closedHistory}
              onDeleteTrade={handleDeleteTrade}
              showActions={true}
            />

            {closedHistory.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 bg-[#0a0a0a] p-4 border border-white/10 rounded-md">
                <div>
                  <p className="text-xs text-[--text-muted] mb-1">Realized P&L</p>
                  <p className={`text-xl font-medium ${stats.totalRealizedPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {stats.totalRealizedPnL >= 0 ? '+' : ''}{formatMoney(stats.totalRealizedPnL)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Breakdown Donut */}
        {fnoTrades.length > 0 && (
          <div className="mt-8 bg-[#0a0a0a] border border-white/10 rounded-md p-6 max-w-md">
            <h3 className="text-sm font-medium text-[--text-primary] mb-4">Instrument Split (Total)</h3>
            <div className="flex items-center">
              <div className="w-[160px] h-[160px]">
                {mounted && pieChartData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                        {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "#1e1e1e", border: "1px solid #333", borderRadius: "4px" }}
                        itemStyle={{ color: "#fff", fontSize: "12px" }}
                        formatter={(value: any) => [`${value} Trades`, "Count"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="ml-6 flex-1 flex flex-col gap-2">
                {pieChartData.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between text-xs w-[80px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.fill }} />
                      <span className="text-[--text-secondary] font-medium">{entry.name}</span>
                    </div>
                    <span className="text-[--text-primary] font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Log Form */}
      {showLogForm && (
        <Drawer
          isOpen={showLogForm}
          onClose={() => setShowLogForm(false)}
          title="New Position"
        >
          <div className="p-2 max-w-lg mx-auto w-full">
            <div className="flex bg-[#1e1e1e] rounded-md p-1 border border-white/10 mb-6">
              <button 
                type="button"
                onClick={() => setLogFormData({ ...logFormData, trade_type: "BUY" })}
                className={`flex-1 py-2 rounded text-xs font-semibold transition-all ${
                  logFormData.trade_type === "BUY" ? "bg-[#2185d0] text-white shadow-md" : "text-[--text-muted] hover:text-white"
                }`}
              >
                Buy
              </button>
              <button 
                type="button"
                onClick={() => setLogFormData({ ...logFormData, trade_type: "SELL" })}
                className={`flex-1 py-2 rounded text-xs font-semibold transition-all ${
                  logFormData.trade_type === "SELL" ? "bg-rose-500 text-white shadow-md" : "text-[--text-muted] hover:text-white"
                }`}
              >
                Sell
              </button>
            </div>

            <form onSubmit={handleLogSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Instrument / Symbol</label>
                  <input required className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none uppercase" placeholder="e.g. NIFTY" value={logFormData.symbol} onChange={e => setLogFormData({...logFormData, symbol: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Type</label>
                  <select className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={logFormData.instrument_type} onChange={e => setLogFormData({...logFormData, instrument_type: e.target.value as any})}>
                    <option value="FUT">Futures (FUT)</option>
                    <option value="CE">Call Option (CE)</option>
                    <option value="PE">Put Option (PE)</option>
                  </select>
                </div>
              </div>

              {logFormData.instrument_type !== "FUT" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Strike Price</label>
                  <input required type="number" step="any" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" placeholder="e.g. 21000" value={logFormData.strike_price} onChange={e => setLogFormData({...logFormData, strike_price: e.target.value})} inputMode="decimal" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Quantity (Lot Size)</label>
                  <input required type="number" step="any" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" placeholder="e.g. 50" value={logFormData.quantity} onChange={e => setLogFormData({...logFormData, quantity: e.target.value})} inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Avg. Price</label>
                  <input required type="number" step="any" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={logFormData.entry_price} onChange={e => setLogFormData({...logFormData, entry_price: e.target.value})} inputMode="decimal" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Trade Date</label>
                  <input required type="date" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={logFormData.trade_date} onChange={e => setLogFormData({...logFormData, trade_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Expiry Date (Optional)</label>
                  <input type="date" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={logFormData.expiry_date} onChange={e => setLogFormData({...logFormData, expiry_date: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[--text-muted]">Deduct/Credit Margin Account</label>
                <select className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={logFormData.account_id} onChange={e => setLogFormData({...logFormData, account_id: e.target.value})}>
                  <option value="">No Account (Track Only)</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div className="pt-6">
                <button type="submit" disabled={submitting} className={`w-full py-2.5 rounded text-sm font-semibold transition-colors ${logFormData.trade_type === 'SELL' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-[#2185d0] hover:bg-[#1678c2] text-white'}`}>
                  {submitting ? "Processing..." : (logFormData.trade_type === 'BUY' ? "Buy" : "Sell")}
                </button>
              </div>
            </form>
          </div>
        </Drawer>
      )}

      {/* Close Form */}
      {showCloseForm && selectedTrade && (
        <Drawer
          isOpen={showCloseForm}
          onClose={() => { setShowCloseForm(false); setSelectedTrade(null); }}
          title={`Exit ${selectedTrade.symbol}`}
        >
          <div className="p-2 max-w-lg mx-auto w-full">
            <div className="bg-[#1e1e1e] p-4 rounded-md border border-white/10 mb-6">
              <p className="text-xs text-[--text-muted] mb-1">Entry details</p>
              <div className="flex justify-between items-center text-sm">
                <span className="text-white font-medium">{selectedTrade.quantity} Qty</span>
                <span className="text-white font-medium">@ ₹{selectedTrade.entry_price}</span>
              </div>
            </div>

            <form onSubmit={handleCloseSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Exit Price</label>
                  <input required type="number" step="any" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" placeholder="e.g. 150" value={closeFormData.exit_price} onChange={e => setCloseFormData({...closeFormData, exit_price: e.target.value})} inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Exit Date</label>
                  <input required type="date" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={closeFormData.close_date} onChange={e => setCloseFormData({...closeFormData, close_date: e.target.value})} />
                </div>
              </div>

              <div className="pt-6">
                <button type="submit" disabled={submitting} className="w-full py-2.5 rounded text-sm font-semibold bg-[#2185d0] hover:bg-[#1678c2] text-white transition-colors">
                  {submitting ? "Processing..." : "Exit Position"}
                </button>
              </div>
            </form>
          </div>
        </Drawer>
      )}
    </div>
  );
}
