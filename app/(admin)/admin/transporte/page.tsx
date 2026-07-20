import { redirect } from "next/navigation";

type TransportePageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function TransportePage({ searchParams }: TransportePageProps) {
  const params = new URLSearchParams();
  const resolvedSearchParams = await searchParams;

  for (const [key, value] of Object.entries(resolvedSearchParams ?? {})) {
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }

  redirect(`/admin/configuracion/transporte${params.size ? `?${params.toString()}` : ""}`);
}
