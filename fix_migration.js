/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = "d:/dashboard/supabase/migrations/20260414000006_performance_optimization.sql";
let content = fs.readFileSync(path, 'utf8');

// Remove index on deposits
content = content.replace(/CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public\.deposits\(user_id\);/g, '-- CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id); -- Table removed');

// Remove policies on deposits
const depositPolicies = [
    /DROP POLICY IF EXISTS "Users can view their own deposits" ON public\.deposits;/g,
    /CREATE POLICY "Users can view their own deposits" ON public\.deposits[\s\S]*?FOR SELECT USING \(user_id = \(SELECT auth\.uid\(\)\)\);/g,
    /DROP POLICY IF EXISTS "Users can create their own deposits" ON public\.deposits;/g,
    /CREATE POLICY "Users can create their own deposits" ON public\.deposits[\s\S]*?FOR INSERT WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\);/g
];

depositPolicies.forEach(p => {
    content = content.replace(p, (match) => `-- ${match.split('\n').join('\n-- ')} -- Table removed`);
});

fs.writeFileSync(path, content, 'utf8');
console.log("Cleaned up legacy 'deposits' references from migration.");
