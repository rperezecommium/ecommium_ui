import { getAdminContext } from "../../../../src/shared/config/admin-context";
import { getShippingAdminData, type ShippingAdminTab } from "../../../../src/modules/transporte/shipping-admin";
import { ShippingAdminPage } from "../../../../src/modules/transporte/shipping-admin-page";

type TransportePageProps = {
  searchParams?: Promise<{
    tab?: string;
    includeInactive?: string;
    shippingMessage?: string;
    quote?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
    variantId?: string;
    quantity?: string;
    priceMinor?: string;
    weightGrams?: string;
    widthMm?: string;
    heightMm?: string;
    depthMm?: string;
    itemsSubtotalMinor?: string;
    customerGroupId?: string;
  }>;
};

const shippingTabs = new Set<ShippingAdminTab>([
  "summary",
  "zones",
  "carriers",
  "services",
  "rules",
  "quote",
]);

function tabParam(value: string | undefined): ShippingAdminTab {
  return shippingTabs.has(value as ShippingAdminTab) ? value as ShippingAdminTab : "summary";
}

export default async function TransportePage({ searchParams }: TransportePageProps) {
  const context = await getAdminContext();
  const params = await searchParams;
  const filters = {
    tab: tabParam(params?.tab),
    includeInactive: params?.includeInactive === "true",
    shippingMessage: params?.shippingMessage,
    quoteRequested: params?.quote === "1",
    postalCode: params?.postalCode,
    city: params?.city,
    state: params?.state,
    country: params?.country,
    variantId: params?.variantId,
    quantity: params?.quantity,
    priceMinor: params?.priceMinor,
    weightGrams: params?.weightGrams,
    widthMm: params?.widthMm,
    heightMm: params?.heightMm,
    depthMm: params?.depthMm,
    itemsSubtotalMinor: params?.itemsSubtotalMinor,
    customerGroupId: params?.customerGroupId,
  };
  const data = await getShippingAdminData(context, filters);

  return <ShippingAdminPage context={context} data={data} filters={filters} />;
}
