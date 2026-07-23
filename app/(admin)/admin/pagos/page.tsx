import { getAdminSession } from "../../../../src/shared/auth/session";
import { getAdminContext } from "../../../../src/shared/config/admin-context";
import { getInvoiceAdminCapabilities, getInvoiceAdminData } from "../../../../src/modules/pagos/invoices-admin";
import type { InvoiceAdminFilters } from "../../../../src/modules/pagos/invoices-admin";
import { getPaymentsAdminCapabilities, getPaymentsAdminData, type PaymentsAdminFilters } from "../../../../src/modules/pagos/payments-admin";
import { PaymentsAdminPage } from "../../../../src/modules/pagos/payments-admin-page";

function drawerParam(value: string | undefined) {
  return value === "refund-evidence" || value === "create-payment-system" || value === "create-affiliation" || value === "create-payment-rule"
    ? value
    : undefined;
}

type PagosPageProps = {
  searchParams?: Promise<InvoiceAdminFilters & PaymentsAdminFilters>;
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
  const paymentsFilters: PaymentsAdminFilters = {
    cardBin: params?.cardBin,
    includeInactive: params?.includeInactive,
    notice: params?.notice,
    tab: params?.tab,
    transactionLimit: params?.transactionLimit,
    transactionOffset: params?.transactionOffset,
    transactionReference: params?.transactionReference,
    transactionStatus: params?.transactionStatus,
    transactionId: params?.transactionId,
    drawer: drawerParam(params?.drawer),
  };
  const invoiceCapabilities = getInvoiceAdminCapabilities(session);
  const paymentsCapabilities = getPaymentsAdminCapabilities(session);
  const [invoiceData, paymentsData] = await Promise.all([
    getInvoiceAdminData(context, filters, invoiceCapabilities),
    getPaymentsAdminData(context, paymentsFilters, paymentsCapabilities),
  ]);

  return (
    <PaymentsAdminPage
      invoiceCapabilities={invoiceCapabilities}
      invoiceData={invoiceData}
      invoiceFilters={filters}
      paymentsCapabilities={paymentsCapabilities}
      paymentsData={paymentsData}
      paymentsFilters={paymentsFilters}
    />
  );
}
