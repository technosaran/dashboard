# Real-time Database Setup Guide

Your application already has real-time subscriptions configured in the code. If changes aren't appearing without refresh, follow these steps:

## 1. Verify Supabase Real-time is Enabled

Go to your Supabase Dashboard:
1. Navigate to https://supabase.com/dashboard/project/hfbhkfllkvgxikjspemk
2. Go to **Database** → **Replication**
3. Make sure these tables have replication enabled:
   - ✅ accounts
   - ✅ transfers
   - ✅ transactions
   - ✅ deposits

## 2. Check Real-time Configuration

In your Supabase Dashboard:
1. Go to **Settings** → **API**
2. Scroll to **Realtime** section
3. Ensure "Enable Realtime" is turned ON
4. Check that your tables are listed under "Realtime enabled tables"

## 3. Verify RLS Policies

Your RLS policies are already set up correctly. The real-time subscriptions will only receive updates for rows that match your RLS policies.

## 4. Test Real-time Connection

Open your browser console (F12) and look for:
- ✅ WebSocket connection messages
- ✅ "SUBSCRIBED" status messages
- ❌ Any error messages about real-time

## 5. Common Issues

### Issue: Changes not appearing
**Solution**: Check if you're logged in. Real-time only works for authenticated users due to RLS policies.

### Issue: WebSocket connection fails
**Solution**: Check your network/firewall settings. Real-time uses WebSocket connections.

### Issue: Only some changes appear
**Solution**: Verify RLS policies allow SELECT on the tables. Users need SELECT permission to receive real-time updates.

## 6. Manual Testing

To test if real-time is working:
1. Open your app in two browser windows side by side
2. Create/edit an account in one window
3. The change should appear in the other window within 1-2 seconds

## Current Implementation

Your app has real-time enabled on ALL core modules. All subscriptions use `startTransition` to fetch fresh data, ensuring the UI stays smooth and reactive:

- **Dashboard**: Multi-table sync (accounts, expenses, ledger_logs) for a unified overview.
- **Accounts**: Real-time balance updates and account list synchronization.
- **Expenses**: Full sync for expenditure charts and transaction history.
- **Transfers**: Dual sync for transfers and account balances.
- **Family**: Real-time recipient and shared fund tracking.
- **Ledger**: Live audit trail updates.
- **Settings**: Real-time profile identity synchronization.

All subscriptions automatically reload data when changes are detected by listeners.
