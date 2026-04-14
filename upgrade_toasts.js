const fs = require('fs');

const files = [
    {
        path: "d:/dashboard/src/app/dashboard/accounts/AccountsClient.tsx",
        replacements: [
            ['toast.success(editingId ? "Account updated" : "Account created");', 'toast.success(editingId ? "Financial node updated successfully" : "New account initialized successfully");'],
            ['toast.success("Deleted");', 'toast.success("Account permanently removed from portfolio");'],
            ['toast.success("Balance updated");', 'toast.success("Balance adjustment finalized");'],
            ['toast.success("Transfer complete");', 'toast.success("Inter-account transfer executed successfully");']
        ]
    },
    {
        path: "d:/dashboard/src/app/dashboard/mutual-funds/MutualFundsClient.tsx",
        replacements: [
            ['toast.success(formData.trade_type === \'buy\' ? "Investment deployed successfully" : "Redemption processed successfully");', 'toast.success(formData.trade_type === \'buy\' ? "Wealth deployed into mutual fund" : "Mutual fund units liquidated successfully");']
        ]
    },
    {
        path: "d:/dashboard/src/app/dashboard/expenses/ExpensesClient.tsx",
        replacements: [
            ['toast.success("Expenditure logged successfully");', 'toast.success("Daily expenditure recorded: Ledger updated");']
        ]
    },
    {
        path: "d:/dashboard/src/app/dashboard/income/IncomeClient.tsx",
        replacements: [
            ['toast.success("Income record deployed successfully");', 'toast.success("Revenue inflow registered successfully");']
        ]
    },
    {
        path: "d:/dashboard/src/app/dashboard/goals/GoalsClient.tsx",
        replacements: [
            ['toast.success(editingGoalId ? "Goal updated." : "Goal established.");', 'toast.success(editingGoalId ? "Target parameters updated successfully" : "New financial milestone established successfully");'],
            ['toast.success("Capital injected.");', 'toast.success("Capital injected into savings goal");'],
            ['toast.success("Goal deleted.");', 'toast.success("Milestone deleted from registry");']
        ]
    }
];

files.forEach(file => {
    if (fs.existsSync(file.path)) {
        let content = fs.readFileSync(file.path, 'utf8');
        file.replacements.forEach(([oldStr, newStr]) => {
            content = content.replace(oldStr, newStr);
        });
        fs.writeFileSync(file.path, content, 'utf8');
        console.log(`Updated toasts in: ${file.path}`);
    }
});
