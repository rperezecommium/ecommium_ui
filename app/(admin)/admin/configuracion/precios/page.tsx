import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { getPricingGovernanceData, type PricingAdminTab } from "../../../../../src/modules/catalogo/pricing-admin";
import { PricingAdminPage } from "../../../../../src/modules/catalogo/pricing-admin-page";

type PreciosPageProps = {
  searchParams?: Promise<{
    tab?: string;
    priceTableId?: string;
    itemId?: string;
    productId?: string;
    currency?: string;
    country?: string;
    tradePolicy?: string;
    channel?: string;
    customerGroup?: string;
    quantity?: string;
    pricingMessage?: string;
    taxDrawer?: string;
    priceTableDrawer?: string;
    fixedPriceDrawer?: string;
    pipelineDrawer?: string;
  }>;
};

const pricingTabs = new Set<PricingAdminTab>([
  "summary",
  "taxes",
  "tables",
  "references",
  "rules",
  "fixed",
  "computed",
  "computed-auto",
  "pipeline",
]);

function tabParam(value: string | undefined): PricingAdminTab {
  return pricingTabs.has(value as PricingAdminTab) ? value as PricingAdminTab : "summary";
}

export default async function PreciosPage({ searchParams }: PreciosPageProps) {
  const context = await getAdminContext();
  const params = await searchParams;
  const filters = {
    tab: tabParam(params?.tab),
    priceTableId: params?.priceTableId,
    itemId: params?.itemId,
    productId: params?.productId,
    currency: params?.currency,
    country: params?.country,
    tradePolicy: params?.tradePolicy,
    channel: params?.channel,
    customerGroup: params?.customerGroup,
    quantity: params?.quantity,
    pricingMessage: params?.pricingMessage,
    taxDrawer: params?.taxDrawer === "create" ? "create" as const : undefined,
    priceTableDrawer: params?.priceTableDrawer === "create" ? "create" as const : undefined,
    fixedPriceDrawer: params?.fixedPriceDrawer === "create" ? "create" as const : undefined,
    pipelineDrawer: params?.pipelineDrawer === "update" ? "update" as const : undefined,
  };
  const data = await getPricingGovernanceData(context, filters);

  return <PricingAdminPage context={context} data={data} filters={filters} />;
}
