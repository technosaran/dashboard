const fs = require('fs');

const files = [
    "d:/dashboard/src/app/dashboard/mutual-funds/MutualFundsClient.tsx",
    "d:/dashboard/src/app/dashboard/stocks/StocksClient.tsx",
    "d:/dashboard/src/app/dashboard/transfers/TransfersClient.tsx"
];

files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    if (!c.includes('useSearchParams')) {
       // but it says "Cannot find name 'useSearchParams'". This means the hook is used but not imported.
       c = c.replace(/import \{ useCallback/, 'import { useSearchParams } from "next/navigation";\nimport { useCallback');
       if(!c.includes('next/navigation')) { // if useCallback wasn't there
          c = c.replace(/import \{ useState/, 'import { useSearchParams } from "next/navigation";\nimport { useState');
       }
    } else if (!c.includes('next/navigation')) {
       // it has the hook usage but not the import
       c = c.replace(/import \{ useCallback/, 'import { useSearchParams } from "next/navigation";\nimport { useCallback');
    }
    fs.writeFileSync(f, c, 'utf8');
});
console.log("Fixed imports");
