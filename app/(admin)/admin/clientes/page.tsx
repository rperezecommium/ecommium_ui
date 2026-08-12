import { getAdminContext } from "../../../../src/shared/config/admin-context";
import { refreshAdminEmployeeSession } from "../../../../src/modules/auth/admin-session-actions";
import { getCustomersAdminCapabilities, getCustomersAdminData } from "../../../../src/modules/clientes/customers-admin";
import { CustomersAdminPage } from "../../../../src/modules/clientes/customers-admin-page";
import type { CustomersAdminFilters } from "../../../../src/modules/clientes/customers-admin-types";

type ClientesPageProps = {
  searchParams?: Promise<CustomersAdminFilters>;
};

const drawers = new Set(["create", "detail"]);
const addressModes = new Set(["create", "edit"]);

function drawerParam(value: string | undefined) {
  return drawers.has(value ?? "") ? value as CustomersAdminFilters["drawer"] : undefined;
}

function addressModeParam(value: string | undefined) {
  return addressModes.has(value ?? "") ? value as CustomersAdminFilters["addressMode"] : undefined;
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const [context, session] = await Promise.all([
    getAdminContext(),
    refreshAdminEmployeeSession(),
  ]);
  const capabilities = getCustomersAdminCapabilities(session);
  const params = await searchParams ?? {};
  const filters: CustomersAdminFilters = {
    q: params.q,
    email: params.email,
    limit: params.limit,
    offset: params.offset,
    drawer: drawerParam(params.drawer),
    customerId: params.customerId,
    addressMode: addressModeParam(params.addressMode),
    addressId: params.addressId,
    purchasesLimit: params.purchasesLimit,
    purchasesOffset: params.purchasesOffset,
    customerMessage: params.customerMessage,
  };
  const data = await getCustomersAdminData(context, filters, {
    includePurchases: capabilities.canReadPurchases,
  });

  return <CustomersAdminPage data={data} filters={filters} capabilities={capabilities} />;
}
