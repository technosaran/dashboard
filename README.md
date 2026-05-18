# FinanceOS — Personal Finance Dashboard

A premium, institutional-grade personal finance dashboard built with Next.js 16, Supabase, and real-time data synchronization.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, React 19, Turbopack)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, RPC functions, Row Level Security, Real-time)
- **State Management**: [SWR](https://swr.vercel.app/) with real-time Supabase subscriptions
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Tables**: [TanStack Table](https://tanstack.com/table/latest)
- **Testing**: [Vitest](https://vitest.dev/) + React Testing Library
- **Language**: TypeScript (strict mode)

## Modules

| Module | Description |
|---|---|
| **Dashboard** | Net worth overview, cash flow trends, portfolio summary |
| **Accounts** | Bank accounts with balance tracking and transfers |
| **Income** | Income sources with recurring support |
| **Expenses** | Expense tracking with category breakdown |
| **Budget** | Monthly budgets per category |
| **Stocks** | Stock portfolio with live Yahoo Finance integration |
| **Mutual Funds** | Mutual fund holdings with NAV tracking |
| **Bonds** | Bond portfolio with interest tracking |
| **Alt Assets** | Gold, real estate, and other alternative investments |
| **Liabilities** | Loans, EMIs, and debt tracking |
| **Forex** | Forex trading accounts and trade history |
| **Goals** | Financial goal setting and progress tracking |
| **Family** | Multi-member household finance management |
| **Ledger** | Complete audit trail of all financial operations |
| **Settings** | Profile, module visibility, and data management |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anonymous/public API key |

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run all migrations in `supabase/migrations/` in order
3. Enable real-time for all tables used by the dashboard
4. Configure Row Level Security (RLS) policies — migrations include these

### Migration Workflow

Migrations are in `supabase/migrations/` with timestamps. Apply them via:

```bash
npx supabase db push
```

Or apply manually through the Supabase SQL editor in order.

## Key Architecture Decisions

- **Single RPC fetch**: `get_finance_overview` fetches all user data in one round-trip
- **Real-time sync**: All 20+ tables subscribe to Postgres changes via Supabase Realtime
- **Middleware auth**: `src/middleware.ts` guards all dashboard routes server-side
- **Atomic operations**: Financial mutations use RPC functions for ACID compliance
- **Module system**: Users can toggle dashboard modules on/off via Settings

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── dashboard/        # Protected dashboard routes
│   │   ├── accounts/
│   │   ├── stocks/
│   │   ├── mutual-funds/
│   │   ├── ...           # Other modules
│   │   └── settings/
│   ├── login/            # Auth pages
│   ├── error.tsx         # Error boundary
│   ├── global-error.tsx  # Root error boundary
│   └── not-found.tsx     # 404 page
├── components/           # Shared UI components
├── context/              # React context providers
├── hooks/                # Custom hooks (SWR, media queries)
├── lib/                  # Utilities, Supabase clients, types
└── middleware.ts         # Auth middleware
```
