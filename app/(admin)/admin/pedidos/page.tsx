import { getAdminContext } from "../../../../src/shared/config/admin-context";
import { refreshAdminEmployeeSession } from "../../../../src/modules/auth/admin-session-actions";
import { getOrdersAdminCapabilities, getOrdersAdminData } from "../../../../src/modules/pedidos/orders-admin";
import { OrdersAdminPage } from "../../../../src/modules/pedidos/orders-admin-page";
import type { OrdersAdminFilters } from "../../../../src/modules/pedidos/orders-admin";

type PedidosPageProps = {
  searchParams?: Promise<OrdersAdminFilters>;
};

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const [context, session, params] = await Promise.all([
    getAdminContext(),
    refreshAdminEmployeeSession(),
    searchParams,
  ]);
  const filters: OrdersAdminFilters = {
    orderId: params?.orderId,
    customerId: params?.customerId,
    limit: params?.limit,
    offset: params?.offset,
    orderTab: params?.orderTab,
    notice: params?.notice,
    noticeKind: params?.noticeKind,
  };
  const capabilities = getOrdersAdminCapabilities(session);
  const data = await getOrdersAdminData(context, filters, capabilities);

  return <OrdersAdminPage capabilities={capabilities} data={data} filters={filters} />;
}
