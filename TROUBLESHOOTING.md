# Troubleshooting Guide - Account Creation Issue

## Issue
Cannot add accounts - form should pop up when clicking "+ New Account" button.

## What I Fixed

### 1. Added Error Handling & Feedback
- Added `submitting` state to show loading state
- Added `error` state to display error messages
- Form now shows errors if account creation fails
- Submit button shows "Saving..." during submission

### 2. Fixed Security Issues
- Added user_id filter to client-side queries
- Added user-specific realtime subscription filter
- Created new migration to re-enable RLS (Row Level Security)

## Steps to Debug

### Step 1: Check if Form Appears
1. Go to `/dashboard/accounts`
2. Click the "+ New Account" button
3. **Expected**: Form should appear below the button
4. **If form doesn't appear**: Check browser console for JavaScript errors

### Step 2: Test Backend Connection
1. Navigate to `/test-connection` in your browser
2. This page will show:
   - ✓ Connection status to Supabase
   - ✓ Authentication status
   - ✓ Database query results
   - ✓ Environment variables status
3. **If any checks fail**: See the error message and follow Step 3

### Step 3: Apply Database Migrations
Your database currently has RLS (Row Level Security) disabled, which is a security risk.

Run these commands:

```bash
# Reset the database and apply all migrations
npx supabase db reset

# OR if you want to apply just the new migration
npx supabase migration up
```

### Step 4: Verify Environment Variables
Check that `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

### Step 5: Test Account Creation
1. Go to `/dashboard/accounts`
2. Click "+ New Account"
3. Fill in the form:
   - Account Name: "Test Account"
   - Type: "Checking"
   - Balance: 1000
   - Currency: USD
4. Click "Create"
5. **Expected**: Form closes, new account appears in the list
6. **If error appears**: Read the error message in the red box

## Common Issues & Solutions

### Issue: "Row Level Security policy violation"
**Cause**: RLS is enabled but you're not authenticated properly
**Solution**: 
1. Run `npx supabase db reset` to apply the RLS migration
2. Make sure you're logged in
3. Check `/test-connection` to verify auth status

### Issue: Form doesn't appear when clicking button
**Cause**: JavaScript error or state management issue
**Solution**:
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Try refreshing the page
4. Clear browser cache

### Issue: "Unauthorized" error
**Cause**: Not logged in or session expired
**Solution**:
1. Go to `/login` and log in again
2. Check if cookies are enabled in your browser

### Issue: Account created but doesn't appear
**Cause**: Realtime subscription not working or user_id filter issue
**Solution**:
1. Refresh the page manually
2. Check browser console for realtime subscription errors
3. Verify the migration was applied: `npx supabase migration list`

## Database Schema Check

Your accounts table should have these columns:
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users)
- `name` (text)
- `type` (text: checking, savings, credit, investment)
- `balance` (numeric)
- `currency` (text)
- `bank_name` (text, nullable)
- `bank_logo` (text, nullable)
- `created_at` (timestamptz)

## Next Steps

1. **First**: Visit `/test-connection` to diagnose the issue
2. **Second**: Run `npx supabase db reset` to apply all migrations
3. **Third**: Try creating an account again
4. **If still failing**: Check browser console and share the error message

## Files Modified
- `src/app/dashboard/accounts/page.tsx` - Added error handling and user filtering
- `src/components/greeting.tsx` - Fixed to use Supabase auth instead of localStorage
- `supabase/migrations/20260406000006_enable_rls.sql` - New migration to enable RLS

## Security Note
Your current database has RLS disabled on all tables. This means anyone with your Supabase URL can access all data. You MUST run the migrations to enable RLS before deploying to production.
