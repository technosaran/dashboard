import Sidebar from "@/components/sidebar";
import { UserProvider } from "@/context/user-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
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
          <div className="relative z-10 mx-auto w-full max-w-[var(--page-max-width)] overflow-x-hidden px-[var(--page-padding-x)] pt-[var(--page-padding-y)] pb-[calc(var(--page-padding-y)*2+6.5rem)] md:pb-[calc(var(--page-padding-y)*2)]">
            {children}
          </div>
        </main>
      </div>
    </UserProvider>
  );
}
