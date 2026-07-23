import { notFound } from "next/navigation";
import { getAdminSession } from "../../../../../../src/shared/auth/session";
import { getAdminContext } from "../../../../../../src/shared/config/admin-context";
import { getInvoiceAdminCapabilities, getInvoiceAdminData } from "../../../../../../src/modules/pagos/invoices-admin";
import { InvoiceDetailAdminPage } from "../../../../../../src/modules/pagos/invoices-admin-page";

type InvoiceDetailRouteProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams?: Promise<{ notice?: string }>;
};

export default async function InvoiceDetailRoute({ params, searchParams }: InvoiceDetailRouteProps) {
  const [{ invoiceId }, context, session, query] = await Promise.all([
    params,
    getAdminContext(),
    getAdminSession(),
    searchParams,
  ]);
  const capabilities = getInvoiceAdminCapabilities(session);
  const data = await getInvoiceAdminData(context, { invoiceId, notice: query?.notice }, capabilities);

  if (data.selectedInvoice.ok && !data.selectedInvoice.data) {
    notFound();
  }

  return <InvoiceDetailAdminPage capabilities={capabilities} data={data} filters={{ invoiceId, notice: query?.notice }} />;
}
