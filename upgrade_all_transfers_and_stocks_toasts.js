/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

// --- Upgrading StocksClient.tsx ---
const stocksPath = "d:/dashboard/src/app/dashboard/stocks/StocksClient.tsx";
let stocksContent = fs.readFileSync(stocksPath, 'utf8');
stocksContent = stocksContent.replace('toast.success(editingId ? "Stock updated" : "Stock added");', 'toast.success(editingId ? "Equity position updated successfully" : "New equity position registered in portfolio");');
stocksContent = stocksContent.replace('toast.success("Stock deleted");', 'toast.success("Investment record purged from architecture");');
fs.writeFileSync(stocksPath, stocksContent, 'utf8');

// --- Upgrading TransfersClient.tsx ---
const transfersPath = "d:/dashboard/src/app/dashboard/transfers/TransfersClient.tsx";
let transfersContent = fs.readFileSync(transfersPath, 'utf8');

// 1. Add toast import
if (!transfersContent.includes('import { toast } from "react-hot-toast";')) {
    transfersContent = transfersContent.replace('import { format } from "date-fns";', 'import { format } from "date-fns";\nimport { toast } from "react-hot-toast";');
}

// 2. Remove local error state in handleSubmit and use toast
transfersContent = transfersContent.replace(/setError\(\"Cannot transfer to the same account\"\);/g, 'toast.error("Security block: Source and destination accounts must be distinct");');
transfersContent = transfersContent.replace(/setError\(\"Amount must be greater than 0\"\);/g, 'toast.error("Illegal amount: Transfer value must be positive");');
transfersContent = transfersContent.replace(/setError\(\"Insufficient balance in source account\"\);/g, 'toast.error("Insufficient balance: Source account cannot fund this movement");');
transfersContent = transfersContent.replace(/if \(result\?\.error\) \{[\s\S]*?setError\(result\.error\);[\s\S]*?return;[\s\S]*?\}/, 
`if (result?.error) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }`);

// 3. Add success toast
transfersContent = transfersContent.replace('resetForm();', 'toast.success("Capital movement executed: Accounts updated");\n    resetForm();');

// 4. Remove the {error && ...} div
transfersContent = transfersContent.replace(/\{error && \(<div className="mb-8 animate-fade-in px-5 py-3 rounded-xl bg-\[--danger\]\/5 border border-\[--danger\]\/20 text-\[--danger\] text-xs font-bold">\{error\}<\/div>\)\}/, '');

fs.writeFileSync(transfersPath, transfersContent, 'utf8');

// --- Upgrading FamilyClient.tsx ---
const familyPath = "d:/dashboard/src/app/dashboard/family/FamilyClient.tsx";
let familyContent = fs.readFileSync(familyPath, 'utf8');
familyContent = familyContent.replace('toast.success(`${newName} has been added!`);', 'toast.success(`Recipient initialized: ${newName} added to directory`);');
familyContent = familyContent.replace('toast.success(`₹${amount.toLocaleString()} sent to ${selectedRecipient.name}!`);', 'toast.success(`Wealth transfer successful: ₹${amount.toLocaleString()} sent to ${selectedRecipient.name}`);');
fs.writeFileSync(familyPath, familyContent, 'utf8');

console.log("Upgraded feedback messages across all modules.");
