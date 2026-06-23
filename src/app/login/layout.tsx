import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to access your premium financial dashboard. Securely manage your wealth, track net worth, and monitor your portfolio.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "Login | FinanceOS",
    description: "Sign in to access your premium financial dashboard.",
    url: "https://finance-os.app/login",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
