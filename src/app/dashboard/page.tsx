import Greeting from "@/components/greeting";

export default function DashboardPage() {
  return (
    <div>
      <Greeting />
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Here&apos;s your financial overview.
      </p>

      <div className="mt-8">
        <div className="rounded-2xl bg-emerald-500 p-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none max-w-sm">
          <p className="text-sm font-medium text-emerald-100">Total Net Worth</p>
          <p className="mt-3 text-4xl font-bold tracking-tight">$0.00</p>
          <p className="mt-2 text-xs text-emerald-200">Updated just now</p>
        </div>
      </div>
    </div>
  );
}
