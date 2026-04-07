# Apply Cash Account Migration

## Problem
The Cash account cannot be created because the database has a CHECK constraint that only allows these account types:
- checking
- savings
- credit
- investment

But NOT 'cash'.

## Solution
A new migration has been created to add 'cash' to the allowed types.

## How to Apply the Migration

### Option 1: Using Supabase CLI (Local Development)

If you're using local Supabase:

```bash
# Apply the migration
npx supabase db reset

# Or if you want to apply just this migration
npx supabase migration up
```

### Option 2: Using Supabase Dashboard (Hosted)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/hfbhkfllkvgxikjspemk

2. Navigate to **SQL Editor**

3. Run this SQL command:

```sql
-- Drop the old constraint
alter table accounts drop constraint if exists accounts_type_check;

-- Add new constraint with 'cash' type included
alter table accounts add constraint accounts_type_check 
  check (type in ('checking', 'savings', 'credit', 'investment', 'cash'));
```

4. Click **Run** or press Ctrl+Enter

### Option 3: Apply All Migrations

If you haven't applied migrations yet:

```bash
# Push all migrations to your hosted database
npx supabase db push
```

## Verify It Worked

After applying the migration:

1. Refresh your accounts page
2. The Cash account should automatically appear
3. Check browser console for: "Cash account created successfully"
4. You should see a yellow/gold "Cash" card with ₹0 balance

## What the Cash Account Does

- **Permanent**: Cannot be deleted
- **Protected**: Name, type, currency, and bank cannot be edited
- **Adjustable**: Balance can only be changed via "Adjust Balance" button
- **Purpose**: Tracks physical cash you hold (wallet, home, etc.)
- **Auto-created**: Appears automatically for all users

## Troubleshooting

If the Cash account still doesn't appear:

1. **Check browser console** (F12 → Console tab)
   - Look for "Creating Cash account..."
   - Look for any error messages

2. **Check database constraint**:
   ```sql
   SELECT conname, pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conrelid = 'accounts'::regclass 
   AND conname = 'accounts_type_check';
   ```
   Should show: `CHECK (type = ANY (ARRAY['checking', 'savings', 'credit', 'investment', 'cash']))`

3. **Manually create Cash account** (temporary workaround):
   ```sql
   INSERT INTO accounts (user_id, name, type, balance, currency, bank_name, bank_logo)
   VALUES (
     (SELECT id FROM auth.users LIMIT 1),  -- Replace with your user ID
     'Cash',
     'cash',
     0,
     'INR',
     NULL,
     NULL
   );
   ```

## After Migration

Once the migration is applied:
- Existing users will get the Cash account on next page load
- New users will get it automatically
- The Cash account will appear with yellow/gold styling
- It will be the first or last in your accounts list
