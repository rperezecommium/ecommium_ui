import { redirect } from "next/navigation";

type Props = { searchParams?: Promise<{ error?: string; notice?: string }> };

// Compatibility for existing bookmarks and credential/session action returns.
export default async function SeguridadPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = new URLSearchParams({ tab: "security" });
  if (typeof params?.error === "string") query.set("error", params.error);
  if (typeof params?.notice === "string") query.set("notice", params.notice);
  redirect(`/admin/configuracion/equipo?${query}`);
}
