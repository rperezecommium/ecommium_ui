import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyAccountActivatePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const token = first(query?.token);
  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
  redirect(`/auth/activate${suffix}`);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
