import Sidebar from "@/components/sidebar";
import { UserProvider } from "@/context/user-context";
import { createClient } from "@/lib/supabase-server";
import { SWRProvider } from "@/components/swr-provider";
import type { FinanceData } from "@/hooks/use-finance-data";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: initialData } = await supabase.rpc("get_finance_overview_v2");

  return (
    <UserProvider>
      <SWRProvider initialData={initialData as unknown as FinanceData}>
        <div
          className="flex min-h-[100dvh] flex-col overflow-hidden md:h-[100dvh] md:flex-row w-full relative"
          style={{ background: "var(--bg-base)" }}
        >
          <Sidebar />
          <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
            <div
              className="pointer-events-none absolute hidden md:block"
              style={{
                top: "-4rem",
                right: "-6rem",
                width: "18rem",
                height: "18rem",
                background: "radial-gradient(circle, rgba(108,92,231,0.06) 0%, transparent 70%)",
                filter: "blur(32px)",
                zIndex: 0,
              }}
            />
            <div
              className="pointer-events-none absolute hidden xl:flex"
              style={{
                bottom: "-8rem",
                left: "24%",
                width: "22rem",
                height: "22rem",
                background: "radial-gradient(circle, rgba(0,206,201,0.04) 0%, transparent 70%)",
                filter: "blur(44px)",
                zIndex: 0,
              }}
            />
            <div 
              className="relative z-10 mx-auto w-full max-w-[var(--page-max-width)] overflow-x-hidden px-[var(--page-padding-x)] pb-[calc(var(--mobile-bottom-nav-height)+var(--page-padding-y))] md:pb-[calc(var(--page-padding-y)*2)]"
              style={{
                paddingTop: "calc(var(--page-padding-y) + env(safe-area-inset-top, 0px))"
              }}
            >
              {children}
            </div>
          </main>
        </div>
      </SWRProvider>
    </UserProvider>
  );
}
