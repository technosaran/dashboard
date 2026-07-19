import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | arthaX",
  description: "Sign in to arthaX — your personal wealth management terminal. Track stocks, mutual funds, expenses, income and automate bank transaction alerts.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "Login | arthaX",
    description: "Sign in to arthaX — your personal wealth management terminal.",
    url: "https://technosaranfin.vercel.app/login",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
