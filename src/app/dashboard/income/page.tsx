import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function IncomePage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const queryString = new URLSearchParams(resolvedParams as any).toString();
  redirect(`/dashboard/transactions?tab=income${queryString ? `&${queryString}` : ""}`);
}
