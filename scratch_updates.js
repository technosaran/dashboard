const fs = require('fs');

// 1. Update GoalsClient.tsx
let goalsPath = "d:/dashboard/src/app/dashboard/goals/GoalsClient.tsx";
let goalsContent = fs.readFileSync(goalsPath, 'utf8');

const goalsTarget = `<div className="flex items-end justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider mb-1">Saved</span>
                    <span className="text-xl font-bold">₹{Number(goal.current_amount).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider mb-1">Target</span>
                    <span className="text-sm font-semibold opacity-60">₹{Number(goal.target_amount).toLocaleString()}</span>
                  </div>
                </div>`;
const goalsReplacement = `<div className="flex items-end justify-between">
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
                </div>`;
goalsContent = goalsContent.split(goalsTarget).join(goalsReplacement);
fs.writeFileSync(goalsPath, goalsContent, 'utf8');
console.log("GoalsClient updated.");

// 2. Update ExpensesClient.tsx
let expensesPath = "d:/dashboard/src/app/dashboard/expenses/ExpensesClient.tsx";
let expensesContent = fs.readFileSync(expensesPath, 'utf8');

const oldCategories = `const CATEGORIES = [
  { label: "Rent", icon: "🏠", color: "var(--accent-primary-light)" },
  { label: "Food", icon: "🍔", color: "#fab1a0" },
  { label: "Transport", icon: "🚌", color: "var(--accent-secondary)" },
  { label: "Utilities", icon: "⚡", color: "var(--warning)" },
  { label: "Entertainment", icon: "🎬", color: "#a29bfe" },
  { label: "Shopping", icon: "🛍️", color: "#ff7675" },
  { label: "Subscription", icon: "💳", color: "var(--success)" },
  { label: "Others", icon: "📦", color: "var(--text-muted)" },
];`;

const newCategories = `export const CATEGORIES = [
  { label: "Rent", icon: "🏠", color: "var(--accent-primary-light)" },
  { label: "Food", icon: "🍔", color: "#fab1a0" },
  { label: "Travel", icon: "✈️", color: "#00cec9" },
  { label: "Investment", icon: "📈", color: "#81ecec" },
  { label: "Transport", icon: "🚌", color: "var(--accent-secondary)" },
  { label: "Utilities", icon: "⚡", color: "var(--warning)" },
  { label: "Entertainment", icon: "🎬", color: "#a29bfe" },
  { label: "Shopping", icon: "🛍️", color: "#ff7675" },
  { label: "Subscription", icon: "💳", color: "var(--success)" },
  { label: "Others", icon: "📦", color: "var(--text-muted)" },
];`;
expensesContent = expensesContent.replace(oldCategories, newCategories);
if (!expensesContent.includes('export const CATEGORIES')) {
    expensesContent = expensesContent.replace(/const CATEGORIES = \[([\s\S]*?)\];/, newCategories);
}
fs.writeFileSync(expensesPath, expensesContent, 'utf8');
console.log("ExpensesClient updated.");

