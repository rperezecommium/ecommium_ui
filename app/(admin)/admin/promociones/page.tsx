import { getAdminContext } from "../../../../src/shared/config/admin-context";
import {
  getPromotionsAdminData,
  type PromotionsAdminFilters,
} from "../../../../src/modules/promociones/promotions-admin";
import { PromotionsAdminPage } from "../../../../src/modules/promociones/promotions-admin-page";

type PromocionesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    promotionMessage?: string;
    drawer?: string;
    couponCode?: string;
  }>;
};

function statusParam(value: string | undefined) {
  return value === "all" ? "all" as const : "active" as const;
}

function drawerParam(value: string | undefined) {
  return value === "create" || value === "edit" ? value : undefined;
}

export default async function PromocionesPage({ searchParams }: PromocionesPageProps) {
  const context = await getAdminContext();
  const params = await searchParams;
  const filters: PromotionsAdminFilters = {
    q: params?.q,
    status: statusParam(params?.status),
    promotionMessage: params?.promotionMessage,
    drawer: drawerParam(params?.drawer),
    couponCode: params?.couponCode,
  };
  const data = await getPromotionsAdminData(context, filters);

  return <PromotionsAdminPage context={context} data={data} filters={filters} />;
}
