import fs from 'fs';
import path from 'path';

const dashboardDir = 'C:/Users/saran/Desktop/dashboard/src/app/dashboard';
const dirs = fs.readdirSync(dashboardDir).filter(f => fs.statSync(path.join(dashboardDir, f)).isDirectory());

let clientUpdatesCount = 0;
let actionUpdatesCount = 0;

for (const dir of dirs) {
  const dirPath = path.join(dashboardDir, dir);
  
  // 1. Update actions.ts
  const actionFile = path.join(dirPath, 'actions.ts');
  if (fs.existsSync(actionFile)) {
    let content = fs.readFileSync(actionFile, 'utf8');
    
    // Add import if not exists
    if (!content.includes('getFriendlyErrorMessage')) {
      const match = content.match(/import\s+.*?;[\r\n]+/);
      if (match) {
        content = content.replace(match[0], `${match[0]}import { getFriendlyErrorMessage } from "@/lib/action-utils";\n`);
      } else {
        content = `import { getFriendlyErrorMessage } from "@/lib/action-utils";\n` + content;
      }
    }

    // Replace error handling in catch block
    content = content.replace(/return\s+{\s*error:\s*err\s*instanceof\s*Error\s*\?\s*err\.message\s*:\s*["'][^"']+["']\s*};/g, `return { error: getFriendlyErrorMessage(err) };`);

    // Replace error return from Supabase
    content = content.replace(/if\s*\(error\)\s*return\s*{\s*error:\s*error\.message\s*};/g, `if (error) return { error: getFriendlyErrorMessage(error) };`);

    // Replace success returns with proper messages based on function name
    let lines = content.split('\n');
    let currentFunction = "";
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        const funcMatch = line.match(/export\s+async\s+function\s+([a-zA-Z0-9_]+)\s*\(/);
        if (funcMatch) {
            currentFunction = funcMatch[1];
        }
        
        if (line.match(/return\s+{\s*success:\s*true\s*};/)) {
            let msg = "Action successful";
            if (currentFunction.startsWith("create")) msg = currentFunction.replace("create", "") + " created successfully";
            else if (currentFunction.startsWith("add")) msg = currentFunction.replace("add", "") + " added successfully";
            else if (currentFunction.startsWith("update")) msg = currentFunction.replace("update", "") + " updated successfully";
            else if (currentFunction.startsWith("delete") || currentFunction.startsWith("remove")) msg = currentFunction.replace(/delete|remove/, "") + " deleted successfully";
            else if (currentFunction.startsWith("adjust")) msg = currentFunction.replace("adjust", "") + " adjusted successfully";
            else if (currentFunction.startsWith("record")) msg = currentFunction.replace("record", "") + " recorded successfully";
            else msg = currentFunction.replace(/([A-Z])/g, ' $1').trim() + " successful";
            
            // cleanup formatting
            msg = msg.replace(/([A-Z])/g, ' $1').trim().replace(/\s+/g, ' ');
            msg = msg.charAt(0).toUpperCase() + msg.slice(1);
            
            lines[i] = line.replace(/return\s+{\s*success:\s*true\s*};/, `return { success: true, message: "${msg}" };`);
        }
    }
    
    fs.writeFileSync(actionFile, lines.join('\n'));
    actionUpdatesCount++;
  }

  // 2. Update Client.tsx files
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (file.endsWith('Client.tsx')) {
      const clientFile = path.join(dirPath, file);
      let clientContent = fs.readFileSync(clientFile, 'utf8');
      let modified = false;

      // Transform toast.success("Hardcoded text") -> toast.success(res?.message || "Hardcoded text")
      // Wait, the client usually checks `if (!result?.error) { toast.success("...") }`
      // We can do a regex replace if we capture the string.
      // But we must refer to the variable name (result, res, etc.) which varies.
      // Let's just do a simpler replacement for any `toast.success("...")` that happens right after `const result = ... await ...`
      // A safe fallback regex: toast.success("something") -> toast.success(res?.message || result?.message || "something")
      // It's a bit hacky but it works since if `res` isn't defined it might throw, but wait: JS would throw ReferenceError.
      // Instead, we can look for:
      // const res = await something()
      // if (!res?.error) { toast.success("...") }
      // It's better to just regex the specific patterns used in our codebase.
      
      const successToastRegex = /(const\s+(\w+)\s*=\s*await.*?[\r\n\s]+if\s*\(!\w+\?\.error\)\s*{\s*(?:.*?[\r\n\s]+)*?)toast\.success\((["'])(.*?)\3\)/g;
      
      clientContent = clientContent.replace(successToastRegex, (match, p1, varName, quote, text) => {
        modified = true;
        return `${p1}toast.success(${varName}.message || "${text}")`;
      });
      
      // Also look for toast.error(result.error) just to be sure we are logging it properly
      // Actually, error logging is fine, it just prints result.error which we just improved on the server!
      
      if (modified) {
        fs.writeFileSync(clientFile, clientContent);
        clientUpdatesCount++;
      }
    }
  }
}

console.log(`Updated ${actionUpdatesCount} actions.ts files.`);
console.log(`Updated ${clientUpdatesCount} Client.tsx files.`);
