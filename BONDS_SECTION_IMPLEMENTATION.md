# Bonds Section Implementation Guide

## Overview
Created a comprehensive Bonds section similar to Wint app for managing digital bond investments with real-time price updates.

## Database Schema Created

### Tables:
1. **bonds** - Main bonds table
   - Bond details (name, ISIN, issuer, type)
   - Investment details (face value, quantity, prices)
   - Yield & returns (coupon rate, YTM, accrued interest)
   - Dates (purchase, maturity, next interest payment)
   - Status & ratings
   - Platform details (Wint, demat account)

2. **bond_transactions** - Transaction history
   - BUY, SELL, INTEREST, MATURITY transactions
   - Interest payment tracking
   - Account integration

### Features:
- Row Level Security (RLS) enabled
- Realtime subscriptions enabled
- Auto-calculate accrued interest function
- Automatic updated_at timestamps

## Files Created:

### 1. Migration File
`supabase/migrations/20260418000000_create_bonds_tables.sql`
- Creates bonds and bond_transactions tables
- Indexes for performance
- RLS policies
- Helper functions

### 2. Actions File
`src/app/dashboard/bonds/actions.ts`
- createBond() - Add new bond investment
- updateBond() - Update bond details
- deleteBond() - Remove bond
- recordInterestPayment() - Track interest payments
- fetchBondPrice() - Get live bond prices (integrate with API)
- refreshBondPrices() - Auto-refresh all bond prices

## Next Steps to Complete:

### 1. Create BondsClient.tsx Component
Location: `src/app/dashboard/bonds/BondsClient.tsx`

Features needed:
- Holdings view (active bonds)
- Transaction history view
- Add bond modal with form
- Interest payment recording
- Real-time price updates
- Portfolio summary cards:
  - Total invested
  - Current value
  - Total interest earned
  - Average YTM
- Bond cards showing:
  - Issuer & bond name
  - ISIN
  - Coupon rate & YTM
  - Maturity date
  - Current value & P&L
  - Accrued interest
  - Credit rating badge
  - Platform badge (Wint)

### 2. Create page.tsx
Location: `src/app/dashboard/bonds/page.tsx`
- Server component to fetch initial data
- Pass to BondsClient

### 3. Create loading.tsx
Location: `src/app/dashboard/bonds/loading.tsx`
- Loading skeleton

### 4. Update Sidebar
Add Bonds to navigation menu between Mutual Funds and Goals

### 5. Update Finance Data Hook
Add bonds and bondTransactions to `use-finance-data.ts`:
```typescript
bonds: Tables<"bonds">[];
bondTransactions: Tables<"bond_transactions">[];
```

### 6. Update RPC Function
Add bonds to `get_finance_overview` RPC function

### 7. API Integration (Optional)
Integrate with bond price APIs:
- Wint API
- NSE Bond API
- BSE Bond API
- Or use web scraping for live prices

## Bond Types Supported:
1. Government Bonds (G-Secs, T-Bills)
2. Corporate Bonds
3. Tax-Free Bonds
4. Infrastructure Bonds
5. PSU Bonds

## Interest Payment Frequencies:
- Monthly
- Quarterly
- Semi-Annual
- Annual

## Key Features:
1. **Real-time Updates** - Prices update automatically
2. **Accrued Interest Calculation** - Shows interest earned but not paid
3. **YTM Tracking** - Yield to Maturity monitoring
4. **Interest Payment History** - Track all coupon payments
5. **Maturity Tracking** - Days to maturity countdown
6. **Credit Rating Display** - AAA, AA+, etc.
7. **Platform Integration** - Wint, Goldenpi, IndiaBonds
8. **Account Integration** - Deduct/credit from accounts
9. **Ledger Logging** - All transactions logged

## UI Design (Similar to Wint):
- Clean card-based layout
- Color-coded by bond type
- Rating badges
- Maturity countdown
- Interest payment calendar
- Portfolio allocation chart
- YTM comparison chart

## Migration Command:
```bash
npx supabase db push
```

Or manually run the SQL migration file in Supabase dashboard.

## Status:
✅ Database schema created
✅ Actions file created
⏳ UI components pending
⏳ Sidebar integration pending
⏳ Data hook integration pending
