import Sidebar from "@/components/sidebar";
import { UserProvider } from "@/context/user-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <div className="flex h-screen bg-zinc-100 dark:bg-zinc-900">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-10">{children}</main>
      </div>
    </UserProvider>
  );
}
