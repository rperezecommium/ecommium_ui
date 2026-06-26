import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { getPricingGovernanceData, type PricingAdminTab } from "../../../../../src/modules/catalogo/pricing-admin";
import { PricingAdminPage } from "../../../../../src/modules/catalogo/pricing-admin-page";

type PreciosPageProps = {
  searchParams?: Promise<{
    tab?: string;
    priceTableId?: string;
    itemId?: string;
    pricingMessage?: string;
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
    pricingMessage: params?.pricingMessage,
  };
  const data = await getPricingGovernanceData(context, filters);

  return <PricingAdminPage context={context} data={data} filters={filters} />;
}
