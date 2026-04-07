import Sidebar from "@/components/sidebar";
import { UserProvider } from "@/context/user-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <div className="flex flex-col md:flex-row h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <Sidebar />
        <main
          className="flex-1 overflow-y-auto relative w-full"
          style={{ padding: "var(--main-padding, 24px 20px)" }}
        >
          {/* Ambient glow orbs */}
          <div
            className="pointer-events-none fixed"
            style={{
              top: "-15%",
              right: "-5%",
              width: "500px",
              height: "500px",
              background: "radial-gradient(circle, rgba(108,92,231,0.06) 0%, transparent 70%)",
              filter: "blur(60px)",
              zIndex: 0,
            }}
          />
          <div
            className="pointer-events-none fixed"
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
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </UserProvider>
  );
}
