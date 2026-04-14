const fs = require('fs');

// 1. Append updateGoal to actions.ts
const actionsPath = "d:/dashboard/src/app/dashboard/goals/actions.ts";
let actionsContent = fs.readFileSync(actionsPath, 'utf8');
if (!actionsContent.includes('export async function updateGoal(')) {
    actionsContent += `
export async function updateGoal(id: string, data: { name: string; target_amount: number; deadline?: string; category: string }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase.from("goals").update({
        name: data.name,
        target_amount: data.target_amount,
        deadline: data.deadline || null,
        category: data.category
    }).eq("id", id).eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/goals");
    return { success: true };
}
`;
    fs.writeFileSync(actionsPath, actionsContent, 'utf8');
}

// 2. Modify GoalsClient.tsx
const clientPath = "d:/dashboard/src/app/dashboard/goals/GoalsClient.tsx";
let clientContent = fs.readFileSync(clientPath, 'utf8');

// Replace imports
clientContent = clientContent.replace(
    /createGoal, updateGoalAmount, deleteGoal \} from "\.\/actions";/,
    'createGoal, updateGoalAmount, deleteGoal, updateGoal } from "./actions";'
);

// Add editingGoalId state
clientContent = clientContent.replace(
    /const \[selectedAccountId, setSelectedAccountId\] = useState<string>\(initialAccounts\[0\]\?\.id \|\| ""\);/,
    'const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccounts[0]?.id || "");\n  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);'
);

if (!clientContent.includes('function startEdit(goal: Goal)')) {
    clientContent = clientContent.replace(
        /async function handleAddGoal\(e: React\.FormEvent\) \{/,
        `function startEdit(goal: Goal) {
    setEditingGoalId(goal.id);
    setFormData({
      name: goal.name,
      target_amount: goal.target_amount.toString(),
      current_amount: goal.current_amount.toString(),
      deadline: goal.deadline || "",
      category: goal.category || "Others",
      account_id: "",
    });
    setShowAddModal(true);
  }

  async function handleAddGoal(e: React.FormEvent) {`
    );
}

// Modify handleAddGoal body
clientContent = clientContent.replace(
    /const res = await createGoal\(\{\r?\n[\s\S]*?\}\);/,
    `let res;
    if (editingGoalId) {
      res = await updateGoal(editingGoalId, {
        name: formData.name,
        target_amount: parseFloat(formData.target_amount),
        deadline: formData.deadline || undefined,
        category: formData.category
      });
    } else {
      res = await createGoal({
        ...formData,
        target_amount: parseFloat(formData.target_amount),
        current_amount: parseFloat(formData.current_amount),
        deadline: formData.deadline || undefined,
      });
    }`
);

// Modify toast messages
clientContent = clientContent.replace(
    /toast\.success\("Goal established\."\);/,
    'toast.success(editingGoalId ? "Goal updated." : "Goal established.");'
);

// Reset edit state on modal close
clientContent = clientContent.replace(
    /setFormData\(.*?\}\);/,
    `setFormData({ name: "", target_amount: "", current_amount: "0", deadline: "", category: "Others", account_id: "" });\n      setEditingGoalId(null);`
);
clientContent = clientContent.replace(
    /<button onClick=\{.*?setShowAddModal\(false\).*?className="text-\[--text-muted\].*?>/g,
    '<button onClick={() => { setShowAddModal(false); setEditingGoalId(null); setFormData({ name: "", target_amount: "", current_amount: "0", deadline: "", category: "Others", account_id: "" }); }} className="text-[--text-muted] hover:text-[--text-primary] transition-colors p-2">'
);

// Add edit button next to delete in goal card
clientContent = clientContent.replace(
    /<button\s*onClick=\{.*?handleDeleteGoal.*?className=".*?group-hover:opacity-100".*?>[\s\S]*?<\/button>/,
    `$&
                  <button 
                    onClick={() => startEdit(goal)} 
                    className="p-2 text-[--text-muted] hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit Goal"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>`
);

// Disable Initial Amount deduction dropdown when editing
clientContent = clientContent.replace(
    /\{Number\(formData\.current_amount\) > 0 && \(/,
    '{!editingGoalId && Number(formData.current_amount) > 0 && ('
);

// Change "Commit Goal" to dynamic text
clientContent = clientContent.replace(
    /\{submitting \? "Establishing\.\.\." : "Commit Goal"\}/,
    '{submitting ? (editingGoalId ? "Updating..." : "Establishing...") : (editingGoalId ? "Update Goal" : "Commit Goal")}'
);
clientContent = clientContent.replace(
    /<h2 className="text-3xl font-black tracking-tight">Set Milestone<\/h2>/,
    '<h2 className="text-3xl font-black tracking-tight">{editingGoalId ? "Update Milestone" : "Set Milestone"}</h2>'
);

// Split goals into Active and Completed
clientContent = clientContent.replace(
    /\{\/\* Goals Grid \*\/\}\r?\n\s*<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">\r?\n\s*\{goals\.map\(\(goal\) => \{/g,
    `{/* Goals Grid */}
      {goals.filter(g => Number(g.current_amount) < Number(g.target_amount)).length > 0 && <h2 className="text-xl font-bold tracking-tight mt-6">Active Milestones</h2>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2">
        {goals.filter(g => Number(g.current_amount) < Number(g.target_amount)).map((goal) => {`
);

clientContent = clientContent.replace(
    /\}\)\}\r?\n\s*<\/div>\r?\n\r?\n\s*\{\/\* Standardized Add Modal \*\/\}/g,
    `})}
      </div>

      {goals.filter(g => Number(g.current_amount) >= Number(g.target_amount)).length > 0 && (
         <>
           <h2 className="text-xl font-bold tracking-tight text-[--success] mt-8 group flex items-center gap-2">
             Completed Achievements <span className="opacity-0 group-hover:opacity-100 text-sm">🎉</span>
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2 opacity-80 hover:opacity-100 transition-opacity">
             {goals.filter(g => Number(g.current_amount) >= Number(g.target_amount)).map((goal) => {
               const category = GOAL_CATEGORIES.find(c => c.label === goal.category) || GOAL_CATEGORIES[7];
               return (
                 <div key={goal.id} className="glass-card p-6 flex flex-col border-[--success]/20 hover:border-[--success]/50 group">
                   <div className="flex items-center justify-between mb-6">
                     <div className="flex flex-col">
                       <h3 className="font-bold text-[15px]">{goal.name}</h3>
                       <p className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wide">Achieved</p>
                     </div>
                     <div className="flex gap-1">
                       <button onClick={() => startEdit(goal)} className="p-2 text-[--text-muted] hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100" title="Edit Goal"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                       <button onClick={() => handleDeleteGoal(goal.id)} className="p-2 text-[--text-muted] hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
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
         </>
      )}

      {/* Standardized Add Modal */}`
);


fs.writeFileSync(clientPath, clientContent, 'utf8');
console.log("Goals updated successfully.");
