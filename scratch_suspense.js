const fs = require('fs');
const path = require('path');

const folders = ["expenses", "income", "stocks", "mutual-funds", "transfers", "goals"];

folders.forEach(folder => {
    const pagePath = `d:/dashboard/src/app/dashboard/${folder}/page.tsx`;
    if (!fs.existsSync(pagePath)) return;
    
    let content = fs.readFileSync(pagePath, 'utf8');

    // Add Suspense import if not exists
    if (!content.includes('import { Suspense }') && !content.includes('import {Suspense}')) {
        content = 'import { Suspense } from "react";\n' + content;
    }

    // Wrap the returned Client Component in Suspense
    // It looks like: return ( <Component ... /> );
    // We will replace `<ComponentName` with `<Suspense fallback={null}><ComponentName`
    // and `/>` with `/></Suspense>`
    // The easiest way is to use a regex that matches the return statement block.
    
    // In these pages it usually ends with:
    //   return (
    //     <SomeClient 
    //       props={props}
    //     />
    //   );
    // }
    
    // For safety, let's do a direct replace of the return block:
    const returnRegex = /return\s*\(\s*(<[A-Za-z]+Client[\s\S]*?\/>)\s*\);/;
    const match = content.match(returnRegex);
    
    if (match) {
        const clientComponentStr = match[1];
        if (!clientComponentStr.includes("<Suspense")) {
             const wrapped = `<Suspense fallback={null}>\n      ${clientComponentStr}\n    </Suspense>`;
             content = content.replace(returnRegex, `return (\n    ${wrapped}\n  );`);
        }
    }

    fs.writeFileSync(pagePath, content, 'utf8');
    console.log("Wrapped " + folder + " in Suspense");
});
