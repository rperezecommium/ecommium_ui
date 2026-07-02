import { redirect } from "next/navigation";

type SeoRedirectPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function SeoRedirectPage({ searchParams }: SeoRedirectPageProps) {
  const params = new URLSearchParams();
  const resolvedParams = await searchParams;

  for (const [key, value] of Object.entries(resolvedParams ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  redirect(`/admin/configuracion/seo${params.size ? `?${params.toString()}` : ""}`);
}
