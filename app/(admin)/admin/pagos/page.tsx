import { getAdminSession } from "../../../../src/shared/auth/session";
import { getAdminContext } from "../../../../src/shared/config/admin-context";
import { getInvoiceAdminCapabilities, getInvoiceAdminData } from "../../../../src/modules/pagos/invoices-admin";
import { InvoicesAdminPage } from "../../../../src/modules/pagos/invoices-admin-page";
import type { InvoiceAdminFilters } from "../../../../src/modules/pagos/invoices-admin";

type PagosPageProps = {
  searchParams?: Promise<InvoiceAdminFilters>;
};

export default async function PagosPage({ searchParams }: PagosPageProps) {
  const [context, session, params] = await Promise.all([
    getAdminContext(),
    getAdminSession(),
    searchParams,
  ]);
  const filters: InvoiceAdminFilters = {
    invoiceId: params?.invoiceId,
    orderId: params?.orderId,
    status: params?.status,
    limit: params?.limit,
    offset: params?.offset,
    notice: params?.notice,
  };
  const capabilities = getInvoiceAdminCapabilities(session);
  const data = await getInvoiceAdminData(context, filters, capabilities);

  return <InvoicesAdminPage capabilities={capabilities} data={data} filters={filters} />;
}
