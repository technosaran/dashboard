const fs = require('fs');

// 1. DASHBOARDCLIENT.TSX: Implement Mobile Hub
const dashPath = "d:/dashboard/src/app/dashboard/DashboardClient.tsx";
let dashContent = fs.readFileSync(dashPath, 'utf8');

const mobileHub = `
      {/* 📱 MOBILE EXCLUSIVE: DATA ENTRY HUB */}
      <div className="flex flex-col gap-6 md:hidden min-h-screen animate-fade-in relative z-20 pb-24">
        {/* Mobile Header / Balance */}
        <div className="glass-card-static p-8 text-center flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-[--accent-primary]/10 blur-3xl rounded-full" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[--text-muted] mb-2">Net Worth</p>
          <h2 className="text-4xl font-black text-white tracking-tighter">
             ₹{stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </h2>
          <div className="mt-4 flex gap-4">
             <div className="flex flex-col items-center">
               <span className="text-[9px] font-bold uppercase text-[--success] tracking-widest">+₹{stats.monthlyIncome.toLocaleString()}</span>
               <span className="text-[8px] text-[--text-muted] uppercase">In</span>
             </div>
             <div className="w-px h-6 bg-white/10" />
             <div className="flex flex-col items-center">
               <span className="text-[9px] font-bold uppercase text-[--danger] tracking-widest">-₹{stats.monthlySpend.toLocaleString()}</span>
               <span className="text-[8px] text-[--text-muted] uppercase">Out</span>
             </div>
          </div>
        </div>

        {/* Quick Action Grid */}
        <div className="px-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted] mb-4">Command Center</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/dashboard/expenses?action=new" className="glass-card-static p-4 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform border-[--danger]/20 bg-[--danger]/5 hover:bg-[--danger]/10">
               <div className="w-12 h-12 rounded-full bg-[--danger]/20 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(255,118,117,0.3)]">🔴</div>
               <span className="text-xs font-bold uppercase tracking-wider text-[--danger]">Expense</span>
            </Link>
            <Link href="/dashboard/income?action=new" className="glass-card-static p-4 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform border-[--success]/20 bg-[--success]/5 hover:bg-[--success]/10">
               <div className="w-12 h-12 rounded-full bg-[--success]/20 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(0,184,148,0.3)]">🟢</div>
               <span className="text-xs font-bold uppercase tracking-wider text-[--success]">Income</span>
            </Link>
            <Link href="/dashboard/transfers?action=new" className="glass-card-static p-4 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform border-[--accent-primary]/20 bg-[--accent-primary]/5 hover:bg-[--accent-primary]/10">
               <div className="w-12 h-12 rounded-full bg-[--accent-primary]/20 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(108,92,231,0.3)]">🔄</div>
               <span className="text-xs font-bold uppercase tracking-wider text-[--accent-primary-light]">Transfer</span>
            </Link>
            <Link href="/dashboard/family" className="glass-card-static p-4 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform border-[--warning]/20 bg-[--warning]/5 hover:bg-[--warning]/10">
               <div className="w-12 h-12 rounded-full bg-[--warning]/20 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(253,203,110,0.3)]">👥</div>
               <span className="text-xs font-bold uppercase tracking-wider text-[--warning]">Send Money</span>
            </Link>
          </div>
        </div>

        {/* Investment Log */}
        <div className="px-1 mt-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted] mb-4">Invest & Capital</h3>
          <div className="flex flex-col gap-3">
             <Link href="/dashboard/stocks?action=new" className="glass-card-static p-4 flex items-center gap-4 active:scale-95 transition-transform">
               <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(59,130,246,0.3)]">📈</div>
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-white">Record Stock Trade</span>
                 <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">Equities & Market</span>
               </div>
               <svg className="w-5 h-5 ml-auto text-[--text-muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
             </Link>
             <Link href="/dashboard/mutual-funds?action=new" className="glass-card-static p-4 flex items-center gap-4 active:scale-95 transition-transform">
               <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(168,85,247,0.3)]">🏦</div>
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-white">Log Mutual Fund</span>
                 <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">SIP & Lumpsum</span>
               </div>
               <svg className="w-5 h-5 ml-auto text-[--text-muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
             </Link>
             <Link href="/dashboard/goals?action=new" className="glass-card-static p-4 flex items-center gap-4 active:scale-95 transition-transform">
               <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]">🎯</div>
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-white">Contribute To Goal</span>
                 <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">Milestone Tracking</span>
               </div>
               <svg className="w-5 h-5 ml-auto text-[--text-muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
             </Link>
          </div>
        </div>
      </div>

      {/* 💻 DESKTOP EXCLUSIVE: FULL ANALYTICS */}
      <div className="hidden md:flex flex-col gap-[var(--section-gap)] animate-fade-in relative z-20">
`;

// Insert the switch right before the first div of the UI
let replacedDash = dashContent;
replacedDash = replacedDash.replace(
  /<div className="flex flex-col gap-\[var\(--section-gap\)\] animate-fade-in">/,
  mobileHub
);
// Close the Desktop div at the very bottom
replacedDash = replacedDash.replace(
    /<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\s*\}\s*$/,
    `      </div>
    </div>
  </div>
</div>
  );
}`
);

fs.writeFileSync(dashPath, replacedDash, 'utf8');
console.log("Dashboard Mobile Hub Created.");

// 2. Hide specific data tables on mobile inside Expenses/Income/Stocks/MFs/Ledger
const clientsToUpdate = [
    "expenses/ExpensesClient.tsx",
    "income/IncomeClient.tsx",
    "stocks/StocksClient.tsx",
    "mutual-funds/MutualFundsClient.tsx",
    "transfers/TransfersClient.tsx",
    "goals/GoalsClient.tsx"
];

clientsToUpdate.forEach(cli => {
    let cp = "d:/dashboard/src/app/dashboard/" + cli;
    let c = fs.readFileSync(cp, 'utf8');
    
    // Auto-open modal logic for URL params in Stocks/MF/Transfers/Goals if they don't have it
    if (cli.includes("StocksClient.tsx") && !c.includes("searchParams.get")) {
        c = c.replace(/const \[showForm, setShowForm\] = useState\(false\);/, 
         'const searchParams = useSearchParams();\n  const [showForm, setShowForm] = useState(searchParams?.get("action") === "new");');
        if (!c.includes('useSearchParams')) {
            c = c.replace(/import \{ useCallback/, 'import { useSearchParams } from "next/navigation";\nimport { useCallback');
        }
    }
    if (cli.includes("MutualFundsClient.tsx") && !c.includes("searchParams.get")) {
        c = c.replace(/const \[showAddModal, setShowAddModal\] = useState\(false\);/, 
         'const searchParams = useSearchParams();\n  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");');
        if (!c.includes('useSearchParams')) {
            c = c.replace(/import \{ useCallback/, 'import { useSearchParams } from "next/navigation";\nimport { useCallback');
        }
    }
    if (cli.includes("TransfersClient.tsx") && !c.includes("searchParams.get")) {
        c = c.replace(/const \[showForm, setShowForm\] = useState\(false\);/, 
         'const searchParams = useSearchParams();\n  const [showForm, setShowForm] = useState(searchParams?.get("action") === "new");');
        if (!c.includes('useSearchParams')) {
            c = c.replace(/import \{ useCallback/, 'import { useSearchParams } from "next/navigation";\nimport { useCallback');
        }
    }
    
    // Hide large grid/tables on mobile
    if (c.includes('className="grid grid-cols-2 md:grid-cols-4')) {
        c = c.replace(/className="grid grid-cols-2 md:grid-cols-4/g, 'className="hidden md:grid grid-cols-2 md:grid-cols-4');
    }
    if (c.includes('className="grid grid-cols-1 lg:grid-cols-3')) {
        c = c.replace(/className="grid grid-cols-1 lg:grid-cols-3/g, 'className="hidden md:grid grid-cols-1 lg:grid-cols-3');
    }
    if (c.includes('className="glass-card-static overflow-hidden border-white/5"')) {
        c = c.replace(/className="glass-card-static overflow-hidden border-white/g, 'className="hidden md:block glass-card-static overflow-hidden border-white');
    }
    // For Goals/Stocks
    if (c.includes('className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3')) {
         c = c.replace(/className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3/g, 'className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3');
    }
    if (c.includes('className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3')) {
         c = c.replace(/className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3/g, 'className="hidden md:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3');
    }
    if (c.includes('className="grid grid-cols-1 md:grid-cols-3')) {
         c = c.replace(/className="grid grid-cols-1 md:grid-cols-3/g, 'className="hidden md:grid grid-cols-1 md:grid-cols-3');
    }

    // Replace the Mobile Header to encourage Data Entry
    if (cli.includes("ExpensesClient.tsx")) {
       c = c.replace(/<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">/,
       `<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="md:hidden p-4 rounded-xl border border-[--danger]/20 bg-[--danger]/5 text-center mt-4">
             <h2 className="text-xl font-black text-white">Record Expense</h2>
             <p className="text-[10px] text-[--text-muted] uppercase tracking-widest mt-1">Mobile Data Node</p>
             <button onClick={() => setShowAddModal(true)} className="btn-primary w-full mt-4 shadow-xl shadow-[--danger]/20 bg-[--danger] hover:bg-[--danger]">Log Now</button>
             <Link href="/dashboard" className="block text-center mt-4 text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white">← System Home</Link>
          </div>`);
       // Need Link import
       if (!c.includes('import Link')) {
           c = c.replace(/import \{ useCallback/, 'import Link from "next/link";\nimport { useCallback');
       }
    }

    if (cli.includes("IncomeClient.tsx")) {
       c = c.replace(/<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">/,
       `<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="md:hidden p-4 rounded-xl border border-[--success]/20 bg-[--success]/5 text-center mt-4">
             <h2 className="text-xl font-black text-white">Record Income</h2>
             <p className="text-[10px] text-[--text-muted] uppercase tracking-widest mt-1">Mobile Data Node</p>
             <button onClick={() => setShowAddModal(true)} className="btn-primary w-full mt-4 shadow-xl shadow-[--success]/20 bg-[--success] hover:bg-[--success]">Log Now</button>
             <Link href="/dashboard" className="block text-center mt-4 text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white">← System Home</Link>
          </div>`);
       if (!c.includes('import Link')) {
           c = c.replace(/import \{ useCallback/, 'import Link from "next/link";\nimport { useCallback');
       }
    }

    if (cli.includes("StocksClient.tsx")) {
       c = c.replace(/<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">/,
       `<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
          <div className="md:hidden p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-center mt-4 w-full">
             <h2 className="text-xl font-black text-white">Stock Trade</h2>
             <p className="text-[10px] text-[--text-muted] uppercase tracking-widest mt-1">Mobile Data Node</p>
             <button onClick={() => setShowForm(true)} className="btn-primary w-full mt-4 shadow-xl shadow-blue-500/20 bg-blue-500 hover:bg-blue-600">Log Now</button>
             <Link href="/dashboard" className="block text-center mt-4 text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white">← System Home</Link>
          </div>`);
       if (!c.includes('import Link')) {
           c = c.replace(/import \{ useCallback/, 'import Link from "next/link";\nimport { useCallback');
       }
    }
    
    if (cli.includes("MutualFundsClient.tsx")) {
       c = c.replace(/<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">/,
       `<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="md:hidden w-full p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 text-center mt-4">
             <h2 className="text-xl font-black text-white">Mutual Fund</h2>
             <p className="text-[10px] text-[--text-muted] uppercase tracking-widest mt-1">Mobile Data Node</p>
             <button onClick={() => setShowAddModal(true)} className="btn-primary w-full mt-4 shadow-xl shadow-purple-500/20 bg-purple-500 hover:bg-purple-600">Log Now</button>
             <Link href="/dashboard" className="block text-center mt-4 text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white">← System Home</Link>
          </div>`);
       if (!c.includes('import Link')) {
           c = c.replace(/import \{ useCallback/, 'import Link from "next/link";\nimport { useCallback');
       }
    }

    if (cli.includes("TransfersClient.tsx")) {
       c = c.replace(/<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">/,
       `<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
          <div className="md:hidden w-full p-4 rounded-xl border border-[--accent-primary]/20 bg-[--accent-primary]/5 text-center mt-4">
             <h2 className="text-xl font-black text-white">Transfer Funds</h2>
             <p className="text-[10px] text-[--text-muted] uppercase tracking-widest mt-1">Mobile Data Node</p>
             <button onClick={() => setShowForm(true)} className="btn-primary w-full mt-4 shadow-xl shadow-[--accent-primary]/20">Log Now</button>
             <Link href="/dashboard" className="block text-center mt-4 text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white">← System Home</Link>
          </div>`);
       if (!c.includes('import Link')) {
           c = c.replace(/import \{ useCallback/, 'import Link from "next/link";\nimport { useCallback');
       }
    }

    if (cli.includes("GoalsClient.tsx")) {
       c = c.replace(/<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">/,
       `<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
          <div className="md:hidden w-full p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center mt-4">
             <h2 className="text-xl font-black text-white">Goals & Savings</h2>
             <p className="text-[10px] text-[--text-muted] uppercase tracking-widest mt-1">Mobile Data Node</p>
             <div className="grid grid-cols-2 gap-3 mt-4">
               <button onClick={() => setShowAddModal(true)} className="btn-primary shadow-xl shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-600">Add Goal</button>
               {/* Note: In mobile, to inject capital they will need to see goals. Let's just keep grid visible on mobile but simplified, actually we'll keep the grid hidden and they just add goals? No, to contribute they must click a goal. So let's NOT hide the goals grid on mobile! We will revert the hidden class for Goals Grid... */}
             </div>
             <Link href="/dashboard" className="block text-center mt-4 text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white">← System Home</Link>
          </div>`);
       if (!c.includes('import Link')) {
           c = c.replace(/import \{ useState/, 'import Link from "next/link";\nimport { useState');
       }
       // Goals Mobile Fix: Allow grid to show so they can tap "Contribute"
       c = c.replace(/className="hidden md:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 mt-2"/g, 'className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 mt-2 opacity-100"'); // un-hide goals grid
       c = c.replace(/className="hidden md:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2 opacity-80/g, 'className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2 opacity-80'); 
    }

    // Hide desktop titles/headers
    c = c.replace(/<div>\s*<h1 className="text-2xl font-bold/g, '<div className="hidden md:block">\n          <h1 className="text-2xl font-bold');
    c = c.replace(/<div>\s*<h1 className="text-3xl sm:text-4xl md:text-5xl/g, '<div className="hidden md:block">\n          <h1 className="text-3xl sm:text-4xl md:text-5xl');

    fs.writeFileSync(cp, c, 'utf8');
    console.log(cli + " updated for mobile entry.");
});

// Remove QuickActions to prevent clutter
const layoutPath = "d:/dashboard/src/app/dashboard/layout.tsx";
let layoutContent = fs.readFileSync(layoutPath, 'utf8');
layoutContent = layoutContent.replace(/<QuickActions \/>/g, '{/* QuickActions disabled in favor of Mobile Hub */}');
fs.writeFileSync(layoutPath, layoutContent, 'utf8');

