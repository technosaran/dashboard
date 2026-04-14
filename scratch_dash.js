const fs = require('fs');

const path = "d:/dashboard/src/app/dashboard/DashboardClient.tsx";
let content = fs.readFileSync(path, 'utf8');

// 1. Add recharts imports
const importsToAdd = `
const BarChart = dynamic(() => import("recharts").then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((mod) => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((mod) => mod.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((mod) => mod.Cell), { ssr: false });
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false });
import { CATEGORIES } from "./expenses/ExpensesClient";
import { parseISO, subMonths } from "date-fns";
`;

content = content.replace(
  /const Tooltip = dynamic[\s\S]*?;/,
  `$&${importsToAdd}`
);

// 2. Add subMonths to date-fns import if not there
if (content.match(/import \{ format.*\} from "date-fns";/) && !content.includes("subMonths")) {
    content = content.replace(/import \{ format/, 'import { subMonths, parseISO, format');
}

// 3. Update stats useMemo
content = content.replace(
    /const expenseTrend =[\s\S]*?\};\r?\n\s*\}, \[accounts, transactions\]\);/,
    `const expenseTrend = transactions
      .filter((transaction) => transaction.type === "expense")
      .slice(0, 15)
      .reverse()
      .map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      }));

    // Income vs Expense past 6 months
    const trendMap: Record<string, {name: string, income: number, expense: number}> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const m = format(d, "MMM");
      trendMap[m] = { name: m, income: 0, expense: 0 };
    }
    transactions.forEach(t => {
      // safe date parsing
      if (!t.date) return;
      try {
        const m = format(parseISO(t.date), "MMM");
        if (trendMap[m]) {
          if (t.type === "income") trendMap[m].income += Number(t.amount);
          if (t.type === "expense") trendMap[m].expense += Number(t.amount);
        }
      } catch (e) {}
    });
    const incomeExpenseData = Object.values(trendMap);

    // Category Pie Chart (Current Month)
    const catMap: Record<string, number> = {};
    currentMonthTxns.filter(t => t.type === 'expense').forEach(t => {
      catMap[t.category || "Others"] = (catMap[t.category || "Others"] || 0) + Number(t.amount);
    });
    const pieData = Object.entries(catMap).map(([name, value]) => {
      const categoryTheme = CATEGORIES.find(c => c.label === name);
      return { 
        name, 
        value,
        color: categoryTheme ? categoryTheme.color : "#8884d8"
      };
    }).sort((a,b) => b.value - a.value);

    return {
      totalBalance,
      monthlySpend,
      monthlyIncome,
      expenseTrend,
      incomeExpenseData,
      pieData,
      accountCount: accounts.length,
    };
  }, [accounts, transactions]);`
);


// 4. Update the bottom section of TSX to add Visual Analytics
const newBottomSections = `
      {/* Visual Analytics Row 1 */}
      <h2 className="text-xl font-bold tracking-tight text-[--text-primary] mt-4 mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-[--accent-primary]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m12-11a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Visual Analytics
      </h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Income vs Expense Graph */}
        <div className="glass-card-static p-6 md:p-8">
          <h3 className="mb-8 text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
            Cashflow Engine (6 Months)
          </h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.incomeExpenseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={10} />
                <YAxis hide />
                <Tooltip
                  cursor={{fill: 'rgba(255,255,255,0.02)'}}
                  contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Pie Chart */}
        <div className="glass-card-static p-6 md:p-8">
          <h3 className="mb-8 text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
            Sector Allocation (Current Month)
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 h-full min-h-[280px]">
            {stats.pieData.length === 0 ? (
               <div className="w-full flex h-full items-center justify-center italic text-[--text-muted] text-sm">No expenses this month.</div>
            ) : (
              <>
                <div className="h-[200px] w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value">
                        {stats.pieData.map((entry, index) => (
                          <Cell key={\`cell-\${index}\`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-3 pb-8">
                  {stats.pieData.slice(0, 5).map((item) => (
                    <div key={item.name} className="flex justify-between items-center group">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-[12px] font-bold text-[--text-secondary] transition-colors group-hover:text-white">{item.name}</span>
                      </div>
                      <span className="text-[12px] font-black tabular-nums">₹{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                  {stats.pieData.length > 5 && (
                    <div className="text-[10px] text-[--text-muted] pt-2 font-bold uppercase tracking-wider">+ {stats.pieData.length - 5} more categories</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Visual Analytics Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card-static p-6 md:p-8">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
              Spending Velocity (Recent Trend)
            </h3>
            <Link
              href="/dashboard/expenses"
              className="text-[10px] font-black uppercase tracking-widest text-[--accent-primary] underline-offset-4 decoration-2 hover:underline"
            >
              Analyze
            </Link>
          </div>
          <div className="h-[280px] w-full">
            {stats.expenseTrend.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] text-sm italic text-[--text-muted]">
                Expense data will appear here once activity is recorded.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.expenseTrend}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "12px",
                    }}
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--accent-primary)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card-static p-6 md:p-8">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
              Recent Activities
            </h3>
            <Link
              href="/dashboard/ledger"
              className="text-[10px] font-black uppercase tracking-widest text-[--accent-primary] underline-offset-4 decoration-2 hover:underline"
            >
              View Ledger
            </Link>
          </div>
          <div className="space-y-4">
`;

// Replace the two grids at the bottom with the enhanced triple-grid layout
content = content.replace(
    /      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">\s*<div className="glass-card-static p-6 md:p-8">\s*<div className="mb-8 flex items-center justify-between">\s*<h3 className="text-sm font-bold uppercase tracking-\[0\.2em\] text-\[--text-muted\]">\s*Wealth Velocity[\s\S]*?<div className="space-y-4">/,
    newBottomSections.trim()
);


fs.writeFileSync(path, content, 'utf8');
console.log("DashboardClient updated successfully.");
