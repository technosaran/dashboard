import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function FnoPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const queryString = new URLSearchParams(resolvedParams as any).toString();
  redirect(`/dashboard/investments?tab=fno${queryString ? `&${queryString}` : ""}`);
}
