import { redirect } from "next/navigation";

type PreciosPageProps = {
  searchParams?: Promise<{
    tab?: string;
    priceTableId?: string;
    itemId?: string;
    pricingMessage?: string;
  }>;
};

export default async function PreciosRedirectPage({ searchParams }: PreciosPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params?.tab) query.set("tab", params.tab);
  if (params?.priceTableId) query.set("priceTableId", params.priceTableId);
  if (params?.itemId) query.set("itemId", params.itemId);
  if (params?.pricingMessage) query.set("pricingMessage", params.pricingMessage);

  redirect(`/admin/configuracion/precios${query.size ? `?${query.toString()}` : ""}`);
}
