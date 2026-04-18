# Sample Data Setup Guide

This guide will help you insert sample data into your database to test all features.

## Prerequisites

1. You must have signed up in the app first (create an account)
2. You need access to Supabase SQL Editor or CLI

## Method 1: Using Supabase SQL Editor (Recommended)

1. **Sign up in your app** if you haven't already
2. Go to your Supabase Dashboard: https://supabase.com/dashboard
3. Select your project
4. Click on **SQL Editor** in the left sidebar
5. Click **New Query**
6. Copy the contents of `insert_sample_data.sql`
7. Paste it into the SQL Editor
8. Click **Run** (or press Ctrl+Enter)

You should see a success message with your user ID!

## Method 2: Using Supabase CLI

```bash
# Make sure you're logged in and linked to your project
supabase db push

# Or run the migration directly
supabase db execute -f insert_sample_data.sql
```

## Method 3: Using Migration (Automatic)

The sample data is also available as a migration file that will run automatically:

```bash
supabase db reset  # This will reset and apply all migrations including sample data
```

## What Gets Created?

### 📊 Accounts (4)
- **HDFC Checking**: ₹1,25,000
- **SBI Savings**: ₹3,50,000
- **ICICI Credit Card**: -₹15,000 (debt)
- **Zerodha Trading**: ₹5,00,000

### 💰 Transactions (12)
- **Income (4)**: Salary, Freelance, Bonus, Interest
- **Expenses (8)**: Rent, Groceries, Bills, Entertainment, etc.

### 🔄 Transfers (3)
- Checking → Savings
- Savings → Investment
- Checking → Credit Card

### 👥 Recipients (3)
- Rajesh Kumar (Family)
- Priya Sharma (Friend)
- Amit Patel (Family)

### 🎯 Goals (3)
- Emergency Fund: ₹1,50,000 / ₹5,00,000
- New Car: ₹2,00,000 / ₹8,00,000
- Europe Vacation: ₹75,000 / ₹3,00,000

### 📈 Stocks (4)
- Reliance Industries (50 shares)
- TCS (30 shares)
- HDFC Bank (40 shares)
- Infosys (60 shares)

### 📊 Mutual Funds (3)
- SBI Bluechip Fund (500 units)
- HDFC Mid-Cap (300 units)
- ICICI Balanced (400 units)

## Testing Features

After inserting sample data, you can test:

✅ **Dashboard** - View account balances and overview
✅ **Accounts** - See all 4 accounts with balances
✅ **Income** - View income transactions
✅ **Expenses** - View expense transactions by category
✅ **Transfers** - See transfer history
✅ **Family** - View recipients list
✅ **Goals** - Track progress on 3 goals
✅ **Stocks** - View stock portfolio with P&L
✅ **Mutual Funds** - View MF holdings with returns
✅ **Ledger** - View all account activity logs

## Customizing Data

To customize the sample data:

1. Open `insert_sample_data.sql`
2. Modify amounts, names, or add more entries
3. Run the script again

## Clearing Sample Data

To remove all sample data and start fresh:

```sql
-- Run this in SQL Editor to delete all your data
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    DELETE FROM transactions WHERE user_id = v_user_id;
    DELETE FROM transfers WHERE user_id = v_user_id;
    DELETE FROM recipients WHERE user_id = v_user_id;
    DELETE FROM goals WHERE user_id = v_user_id;
    DELETE FROM investments WHERE user_id = v_user_id;
    DELETE FROM mutual_funds WHERE user_id = v_user_id;
    DELETE FROM mutual_fund_trades WHERE user_id = v_user_id;
    DELETE FROM ledger_logs WHERE user_id = v_user_id;
    DELETE FROM accounts WHERE user_id = v_user_id;
    
    RAISE NOTICE 'All data cleared for user: %', v_user_id;
END $$;
```

## Troubleshooting

### "No user found" error
- Make sure you've signed up in the app first
- Check if you're using the correct email in the script

### "Permission denied" error
- Ensure RLS policies are properly set up
- Check that you're authenticated in Supabase

### Data not showing in app
- Refresh the page
- Check browser console for errors
- Verify realtime subscriptions are working

## Need Help?

If you encounter issues:
1. Check Supabase logs in the Dashboard
2. Verify all migrations have run successfully
3. Ensure your `.env.local` has correct Supabase credentials
