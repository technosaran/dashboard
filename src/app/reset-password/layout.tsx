import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Securely reset your FinanceOS password to regain access to your financial dashboard.",
  alternates: {
    canonical: "/reset-password",
  },
  openGraph: {
    title: "Reset Password | FinanceOS",
    description: "Securely reset your FinanceOS password.",
    url: "https://finance-os.app/reset-password",
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
