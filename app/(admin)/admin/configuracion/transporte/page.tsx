import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  getShippingAdminData,
  shippingFulfillmentStatuses,
  type ShippingAdminTab,
  type ShippingFulfillmentStatus,
} from "../../../../../src/modules/transporte/shipping-admin";
import { ShippingAdminPage } from "../../../../../src/modules/transporte/shipping-admin-page";

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
    drawer?: string;
    recordId?: string;
    fulfillmentStatus?: string;
    fulfillmentsLimit?: string;
    fulfillmentsOffset?: string;
    fulfillmentId?: string;
  }>;
};

const shippingTabs = new Set<ShippingAdminTab>([
  "summary",
  "zones",
  "carriers",
  "services",
  "rules",
  "quote",
  "fulfillments",
]);

const fulfillmentStatuses = new Set<ShippingFulfillmentStatus>(shippingFulfillmentStatuses);

function tabParam(value: string | undefined): ShippingAdminTab {
  return shippingTabs.has(value as ShippingAdminTab) ? value as ShippingAdminTab : "summary";
}

function drawerParam(value: string | undefined): "create" | "edit" | undefined {
  return value === "create" || value === "edit" ? value : undefined;
}

function fulfillmentStatusParam(value: string | undefined): ShippingFulfillmentStatus | undefined {
  return fulfillmentStatuses.has(value as ShippingFulfillmentStatus)
    ? value as ShippingFulfillmentStatus
    : undefined;
}

function nonNegativeIntegerParam(value: string | undefined, fallback: number) {
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function fulfillmentIdParam(value: string | undefined) {
  const fulfillmentId = value?.trim();
  return fulfillmentId || undefined;
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
    drawer: drawerParam(params?.drawer),
    recordId: params?.recordId,
    fulfillmentStatus: fulfillmentStatusParam(params?.fulfillmentStatus),
    fulfillmentsLimit: nonNegativeIntegerParam(params?.fulfillmentsLimit, 25),
    fulfillmentsOffset: nonNegativeIntegerParam(params?.fulfillmentsOffset, 0),
    fulfillmentId: fulfillmentIdParam(params?.fulfillmentId),
  };
  const data = await getShippingAdminData(context, filters);

  return <ShippingAdminPage context={context} data={data} filters={filters} />;
}
