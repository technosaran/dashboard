# Quick Fix: Apply Cash Type Migration

## The Issue
The Cash account can't be created because the database doesn't allow 'cash' as an account type.

## Quick Fix (Run this in Supabase SQL Editor)

Go to: https://supabase.com/dashboard/project/hfbhkfllkvgxikjspemk/sql/new

Copy and paste this SQL:

```sql
-- Add 'cash' type to allowed account types
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check 
  CHECK (type IN ('checking', 'savings', 'credit', 'investment', 'cash'));
```

Click **Run** (or press Ctrl+Enter)

## That's It!

Now refresh your accounts page and the Cash account will appear automatically with:
- Name: "Cash"
- Type: cash (yellow/gold color)
- Balance: ₹0
- Cannot be deleted or edited (only balance can be adjusted)

## Alternative: Use Supabase CLI

If you have Supabase CLI installed:

```bash
npx supabase db push
```

This will apply all pending migrations including the cash type fix.
