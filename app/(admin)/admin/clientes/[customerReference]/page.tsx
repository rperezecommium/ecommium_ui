import { notFound } from "next/navigation";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { refreshAdminEmployeeSession } from "../../../../../src/modules/auth/admin-session-actions";
import {
  getCustomerByReference,
  getCustomerDetailAdminData,
  getCustomersAdminCapabilities,
} from "../../../../../src/modules/clientes/customers-admin";
import {
  CustomerDetailPage,
  type CustomerDetailTab,
} from "../../../../../src/modules/clientes/customers-admin-page";
import type { CustomersAdminFilters } from "../../../../../src/modules/clientes/customers-admin-types";

type CustomerDetailPageProps = {
  params: Promise<{ customerReference: string }>;
  searchParams?: Promise<CustomersAdminFilters & { tab?: string }>;
};

const customerTabs = new Set<CustomerDetailTab>([
  "resumen",
  "perfil",
  "compras",
  "facturacion",
  "comunicaciones",
  "soporte",
  "cuenta",
  "privacidad",
  "actividad",
  "backoffice",
]);

function customerTab(value: string | undefined): CustomerDetailTab {
  return customerTabs.has(value as CustomerDetailTab)
    ? value as CustomerDetailTab
    : "resumen";
}

export default async function CustomerDetailRoute({ params, searchParams }: CustomerDetailPageProps) {
  const [{ customerReference }, context, session] = await Promise.all([
    params,
    getAdminContext(),
    refreshAdminEmployeeSession(),
  ]);
  const query: CustomersAdminFilters & { tab?: string } = await searchParams ?? {};
  const capabilities = getCustomersAdminCapabilities(session);
  const resolvedCustomer = await getCustomerByReference(context, customerReference);

  if (!resolvedCustomer.data?.customerId) {
    notFound();
  }

  const filters: CustomersAdminFilters = {
    drawer: "detail",
    customerId: resolvedCustomer.data.customerId,
    addressId: query.addressId,
    addressMode: query.addressMode,
    customerMessage: query.customerMessage,
    purchasesLimit: query.purchasesLimit,
    purchasesOffset: query.purchasesOffset,
    activitySource: query.activitySource,
  };
  const data = await getCustomerDetailAdminData(context, resolvedCustomer.data.customerId, filters, {
    includePurchases: capabilities.canReadPurchases,
  });

  return (
    <CustomerDetailPage
      activeTab={customerTab(query.tab)}
      capabilities={capabilities}
      data={data}
      filters={filters}
    />
  );
}
