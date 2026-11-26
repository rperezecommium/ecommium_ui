import { getCurrentAdminSession } from "../../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { getPricingGovernanceData, type PricingAdminTab } from "../../../../../src/modules/catalogo/pricing-admin";
import { PricingAdminPage } from "../../../../../src/modules/catalogo/pricing-admin-page";
import {PricingRemovalStatus} from '../../../../../src/modules/catalogo/pricing-removal-status';
import {parseRemovalReceiptRequest, type RemovalReceiptRequest} from '../../../../../src/modules/catalogo/pricing-reviewed-removal-schema';

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
    pricingRemoval?: string;
    conditionalPriceDrawer?: string;
    referenceDrawer?: string;
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
  "bulk-import",
]);

function tabParam(value: string | undefined): PricingAdminTab {
  return pricingTabs.has(value as PricingAdminTab) ? value as PricingAdminTab : "summary";
}

export default async function PreciosPage({ searchParams }: PreciosPageProps) {
  const context = await getAdminContext();
  const params = await searchParams;
  let removal:RemovalReceiptRequest|undefined;
  if(params?.pricingRemoval && params.pricingRemoval.length<=1500){try{removal=parseRemovalReceiptRequest(JSON.parse(params.pricingRemoval));}catch{/* Invalid URL state cannot authorize an operation. */}}
  const session = await getCurrentAdminSession();
  const canManagePricing = Boolean(session?.permissions.some(permission => ["*", "admin:*", "system.admin", "pricing.admin.write"].includes(permission)));
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
    pricingMessage: removal ? undefined : params?.pricingMessage,
    conditionalPriceDrawer: params?.conditionalPriceDrawer === "create" ? "create" as const : undefined,
    referenceDrawer: ["customer-groups", "channels", "trade-policies", "countries"].includes(params?.referenceDrawer ?? "") ? params?.referenceDrawer : undefined,
    taxDrawer: params?.taxDrawer === "create" ? "create" as const : undefined,
    priceTableDrawer: params?.priceTableDrawer === "create" ? "create" as const : undefined,
    fixedPriceDrawer: params?.fixedPriceDrawer === "create" ? "create" as const : undefined,
    pipelineDrawer: params?.pipelineDrawer === "update" ? "update" as const : undefined,
  };
  const data = await getPricingGovernanceData(context, filters);

  return <PricingAdminPage canCreatePrices={Boolean(session?.permissions.some(p => ["*", "admin:*", "system.admin", "catalog.products.write"].includes(p)))} canManagePricing={canManagePricing} context={context} data={data} filters={filters} removalStatus={canManagePricing && removal ? <PricingRemovalStatus operation={removal}/> : undefined}/>;
}
