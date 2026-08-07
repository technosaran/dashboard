import { AdminGuard } from "@/components/admin-guard";
import AdminClient from "./AdminClient";

export const metadata = {
  title: "Super Admin Control Center | FinanceOS",
  description: "System Health, AI Token Inspector, Tax Laws Sync, & Security Audit",
};

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminClient />
    </AdminGuard>
  );
}
