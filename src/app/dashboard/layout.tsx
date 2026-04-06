import Sidebar from "@/components/sidebar";
import { UserProvider } from "@/context/user-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-[radial-gradient(circle_at_left,rgba(120,199,255,0.16),transparent_65%)]" />
          <div className="absolute right-0 top-0 h-64 w-64 bg-[radial-gradient(circle,rgba(88,213,170,0.16),transparent_68%)]" />
          <div className="absolute bottom-0 left-1/3 h-64 w-64 bg-[radial-gradient(circle,rgba(255,186,107,0.14),transparent_68%)]" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-[1600px] gap-4 px-4 py-4 sm:px-6 lg:gap-6 lg:px-8 lg:py-6">
          <Sidebar />
          <main className="flex min-w-0 flex-1 pt-20 lg:pt-0">
            <div className="app-shell relative flex min-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[32px] px-5 py-5 sm:px-8 sm:py-8">
              <div className="hairline absolute inset-x-10 top-0 h-px opacity-50" />
              {children}
            </div>
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
