/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

// --- Upgrading GoalsClient.tsx ---
const goalsPath = "d:/dashboard/src/app/dashboard/goals/GoalsClient.tsx";
let goalsContent = fs.readFileSync(goalsPath, 'utf8');

// Add activeTab state
goalsContent = goalsContent.replace(
    /const \[submitting, setSubmitting\] = useState\(false\);/,
    `const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');`
);

// Add Tab Switcher and filter goals
const goalsHeaderSearch = /<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">/;
goalsContent = goalsContent.replace(
    goalsHeaderSearch,
    `<div className="flex flex-col gap-6 px-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">`
);

goalsContent = goalsContent.replace(
    /<\/div>\s*<button/,
    `</div>
          <button`
);

// Insert Tab Switcher after the header row
goalsContent = goalsContent.replace(
    /<\/div>\s*\{(\/\* Clean Summary Bar)/,
    `</div>
        
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('active')}
            className={\`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all \${activeTab === 'active' ? 'bg-[--accent-primary] text-white shadow-lg shadow-[--accent-primary]/20' : 'text-[--text-muted] hover:text-[--text-primary]'}\`}
          >
            Active
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={\`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all \${activeTab === 'completed' ? 'bg-[--success] text-white shadow-lg shadow-[--success]/20' : 'text-[--text-muted] hover:text-[--text-primary]'}\`}
          >
            Completed
          </button>
        </div>
      </div>
      
      {/* Clean Summary Bar`
);

// Conditionally render Active and Completed sections
goalsContent = goalsContent.replace(
    /\{goals\.filter\(g => Number\(g\.current_amount\) < Number\(g\.target_amount\)\)\.length > 0 && <h2 className="text-xl font-bold tracking-tight mt-6">Active Milestones<\/h2>\}\s*<div className="hidden md:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2">[\s\S]*?<\/div>\s*<\/div>/,
    `{activeTab === 'active' ? (
        <div className="space-y-6">
          {goals.filter(g => Number(g.current_amount) < Number(g.target_amount)).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2">
              {goals.filter(g => Number(g.current_amount) < Number(g.target_amount)).map((goal) => {
                const category = GOAL_CATEGORIES.find(c => c.label === goal.category) || GOAL_CATEGORIES[7];
                const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
                const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;

                return (
                  <div key={goal.id} className="glass-card p-6 flex flex-col border-white/5 hover:border-[--accent-primary]/30 group">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">
                          {category.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-[15px]">{goal.name}</h3>
                          <p className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wide">{goal.category}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => startEdit(goal)} 
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[--text-muted] hover:text-blue-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                          title="Edit Goal"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button 
                          onClick={() => handleDeleteGoal(goal.id)} 
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[--text-muted] hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                          title="Delete Goal"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-end justify-between">
                        <div className="flex flex-col flex-1">
                          <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider mb-1">Saved</span>
                          <span className="text-xl font-bold">₹{Number(goal.current_amount).toLocaleString()}</span>
                        </div>
                        
                        {Number(goal.current_amount) < Number(goal.target_amount) && daysLeft !== null && daysLeft > 0 && (
                          <div className="flex flex-col items-center flex-1 border-x border-white/10 px-2 mx-2">
                            <span className="text-[9px] font-bold text-[--text-muted] uppercase tracking-wider mb-1">Needs</span>
                            <span className="text-[13px] font-black text-[--accent-primary-light]">₹{Math.ceil((Number(goal.target_amount) - Number(goal.current_amount)) / Math.max(1, Math.ceil(daysLeft / 30.44))).toLocaleString()}/mo</span>
                          </div>
                        )}
                        
                        <div className="flex flex-col items-end flex-1">
                          <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider mb-1">Target</span>
                          <span className="text-[13px] font-semibold opacity-80">₹{Number(goal.target_amount).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-1000"
                          style={{ 
                            width: \`\${Math.min(progress, 100)}%\`,
                            backgroundColor: category.color,
                            boxShadow: \`0 0 4px \${category.color}40\`
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[10px] font-bold" style={{ color: category.color }}>{progress.toFixed(0)}% Achieved</span>
                        {daysLeft !== null && (
                          <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wide">
                            {daysLeft > 0 ? \`\${daysLeft}d left\` : 'Due'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-8">
                      <button 
                        onClick={() => { setSelectedGoalId(goal.id); setShowContributeModal(true); }}
                        className="w-full py-2.5 rounded-xl bg-[--accent-primary]/10 border border-[--accent-primary]/20 text-[10px] font-black uppercase tracking-[0.2em] text-[--accent-primary-light] hover:bg-[--accent-primary] hover:text-white transition-all shadow-lg shadow-transparent hover:shadow-[--accent-primary]/20 active:scale-[0.98]"
                      >
                        Inject Capital
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-24 text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold">No Active Goals</h3>
              <p className="text-sm text-[--text-muted] mt-1">Start by setting a new financial milestone.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {goals.filter(g => Number(g.current_amount) >= Number(g.target_amount)).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2">
              {goals.filter(g => Number(g.current_amount) >= Number(g.target_amount)).map((goal) => {
                const category = GOAL_CATEGORIES.find(c => c.label === goal.category) || GOAL_CATEGORIES[7];
                return (
                  <div key={goal.id} className="glass-card p-6 flex flex-col border-[--success]/20 hover:border-[--success]/50 group">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex flex-col">
                        <h3 className="font-bold text-[15px]">{goal.name}</h3>
                        <p className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wide">Achieved</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(goal)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[--text-muted] hover:text-blue-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100" title="Edit Goal"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                        <button onClick={() => handleDeleteGoal(goal.id)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[--text-muted] hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider mb-1">Final Amount</span>
                          <span className="text-xl font-bold text-[--success]">₹{Number(goal.current_amount).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-24 text-center">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-xl font-bold">No Completed Goals Yet</h3>
              <p className="text-sm text-[--text-muted] mt-1">Consistency is key. Keep saving!</p>
            </div>
          )}
        </div>
      )}`
);

// Remove the old "Completed Achievements" redundant block
goalsContent = goalsContent.replace(
    /\{goals\.filter\(g => Number\(g\.current_amount\) >= Number\(g\.target_amount\)\)\.length > 0 && \([\s\S]*?<\/div>\s*<>\s*\)\s*\}/,
    ''
);

fs.writeFileSync(goalsPath, goalsContent, 'utf8');
console.log("GoalsClient upgraded with tabs.");

// --- Upgrading MutualFundsClient.tsx ---
const mfPath = "d:/dashboard/src/app/dashboard/mutual-funds/MutualFundsClient.tsx";
let mfContent = fs.readFileSync(mfPath, 'utf8');

// Add mfTrades state
mfContent = mfContent.replace(
    /type MF = Tables<"mutual_funds"> & \{ scheme_code\?: string; fund_symbol\?: string \| null \};/,
    `type MF = Tables<"mutual_funds"> & { scheme_code?: string; fund_symbol?: string | null };
type MFTrade = Tables<"mutual_fund_trades">;`
);

mfContent = mfContent.replace(
    /const \[refreshing, setRefreshing\] = useState\(false\);/,
    `const [refreshing, setRefreshing] = useState(false);
  const [trades, setTrades] = useState<MFTrade[]>([]);`
);

// Update fetchData to include trades
mfContent = mfContent.replace(
    /const \[mfRes, accRes\] = await Promise\.all\(\[[\s\S]*?\]\);/,
    `const [mfRes, accRes, tradeRes] = await Promise.all([
        supabase.from("mutual_funds").select("*").eq("user_id", user.id).order("fund_name"),
        supabase.from("accounts").select("*").eq("user_id", user.id).order("name"),
        supabase.from("mutual_fund_trades").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(20)
    ]);`
);

mfContent = mfContent.replace(
    /if \(accRes\.data\) setAccounts\(accRes\.data\);/,
    `if (accRes.data) setAccounts(accRes.data);
    if (tradeRes.data) setTrades(tradeRes.data);`
);

// Add trade channel to useEffect
mfContent = mfContent.replace(
    /\.on\("postgres_changes", \{ event: "\*", schema: "public", table: "mutual_funds" \}, \(\) => startTransition\(fetchData\)\)/,
    `.on("postgres_changes", { event: "*", schema: "public", table: "mutual_funds" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "mutual_fund_trades" }, () => startTransition(fetchData))`
);

// Add History Section at the bottom
const mfTableEnd = /<\/div>\) : mfs\.map\(\(mf\) => \{/; // This is tricky due to the map.
// Let's find the end of the table div.
mfContent = mfContent.replace(
    /<\/table>\s*<\/div>/,
    `</table>
      </div>

      {/* Trade History Section */}
      <div className="mx-4 mt-8">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black tracking-tight">Trade History</h2>
            <span className="text-[10px] font-black text-[--text-muted] uppercase tracking-widest">Recent 20 Logs</span>
        </div>
        <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest">Date</th>
                        <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest">Scheme</th>
                        <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest">Action</th>
                        <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Units</th>
                        <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">NAV</th>
                        <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Amount</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                    {trades.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-[#666] italic text-sm">No transaction history recorded yet.</td></tr>
                    ) : trades.map((trade) => (
                        <tr key={trade.id} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-6 py-4 text-[12px] font-bold text-[--text-muted] tabular-nums">
                                {trade.date}
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-[13px] font-bold text-[#eee]">{trade.fund_name}</span>
                            </td>
                            <td className="px-6 py-4">
                                <span className={\`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider \${trade.trade_type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}\`}>
                                    {trade.trade_type}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right font-medium tabular-nums text-[#eee] text-[13px]">
                                {Number(trade.units).toFixed(3)}
                            </td>
                            <td className="px-6 py-4 text-right font-medium tabular-nums text-[#666] text-[13px]">
                                ₹{Number(trade.nav).toFixed(3)}
                            </td>
                            <td className="px-6 py-4 text-right font-black tabular-nums text-[#eee] text-[14px]">
                                ₹{Number(trade.amount).toLocaleString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>`
);

fs.writeFileSync(mfPath, mfContent, 'utf8');
console.log("MutualFundsClient upgraded with history.");
