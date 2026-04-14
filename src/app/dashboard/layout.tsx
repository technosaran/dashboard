import Sidebar from "@/components/sidebar";
import { UserProvider } from "@/context/user-context";
import QuickActions from "@/components/quick-actions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden w-full relative" style={{ background: "var(--bg-base)" }}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative w-full">
          {/* Ambient glow orbs - Adjusted for mobile */}
          <div
            className="pointer-events-none fixed"
            style={{
              top: "-5%",
              right: "-5%",
              width: "300px",
              height: "300px",
              background: "radial-gradient(circle, rgba(108,92,231,0.06) 0%, transparent 70%)",
              filter: "blur(40px)",
              zIndex: 0,
            }}
          />
          <div
            className="pointer-events-none fixed lg:flex hidden"
            style={{
              bottom: "-10%",
              left: "30%",
              width: "400px",
              height: "400px",
              background: "radial-gradient(circle, rgba(0,206,201,0.04) 0%, transparent 70%)",
              filter: "blur(60px)",
              zIndex: 0,
            }}
          />
          <div className="relative z-10 pt-[var(--page-padding-y)] pb-[calc(var(--page-padding-y)*2)] px-[var(--page-padding-x)] max-w-[var(--page-max-width)] mx-auto w-full overflow-x-hidden">
            {children}
          </div>
        </main>
        <QuickActions />
      </div>
    </UserProvider>
  );
}
