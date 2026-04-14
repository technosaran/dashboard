const fs = require('fs');

// 1. StocksClient.tsx
let path = "d:/dashboard/src/app/dashboard/stocks/StocksClient.tsx";
let content = fs.readFileSync(path, 'utf8');

// Replace button
content = content.replace(
    /<button onClick=\{handleRefreshAll\} disabled=\{refreshing\} className="btn-secondary.*?>[\s\S]*?<\/button>/,
    '{/* Auto refresh enabled */}'
);

// Replace auto-refresh
content = content.replace(
    /const lastRefresh = localStorage\.getItem\("last_stock_refresh"\);[\s\S]*?\}\);[\s\S]*?\}/,
    'refreshAllRef.current?.();\n    const timer = setInterval(() => {\n      refreshAllRef.current?.();\n    }, 15000);\n    return () => clearInterval(timer);'
);

fs.writeFileSync(path, content, 'utf8');
console.log("StocksClient updated.");

// 2. MutualFundsClient.tsx
path = "d:/dashboard/src/app/dashboard/mutual-funds/MutualFundsClient.tsx";
content = fs.readFileSync(path, 'utf8');

// The button was already removed by replace_file_content in the previous step? Wait, maybe it did apply! Let's check. 
// If not, remove it.
content = content.replace(
    /<button onClick=\{handleRefreshAll\} disabled=\{refreshing\} className="btn-secondary.*?>[\s\S]*?<\/button>/,
    '{/* Auto refresh enabled */}'
);

if (!content.includes('setInterval(() => {')) {
    content = content.replace(
        /async function handleRefreshAll\(\) \{/,
        'useEffect(() => {\n    handleRefreshAll();\n    const timer = setInterval(() => {\n      handleRefreshAll();\n    }, 15000);\n    return () => clearInterval(timer);\n  }, []);\n\n  async function handleRefreshAll() {'
    );
}

fs.writeFileSync(path, content, 'utf8');
console.log("MutualFundsClient updated.");
