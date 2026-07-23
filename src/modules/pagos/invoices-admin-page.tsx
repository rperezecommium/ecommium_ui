import Link from "next/link";
import { CreditCard, Download, Search } from "lucide-react";
import type {
  InvoiceAdminCapabilities,
  InvoiceAdminData,
  InvoiceAdminFilters,
} from "./invoices-admin";
import {
  applyInvoiceFiltersAction,
  createFiscalInvoiceAdjustmentAction,
  issueInvoiceFromFiscalConsoleAction,
} from "./invoices-admin-actions";

type Props = {
  capabilities: InvoiceAdminCapabilities;
  data: InvoiceAdminData;
  embedded?: boolean;
  filters: InvoiceAdminFilters;
};

function invoicesHref(filters: InvoiceAdminFilters, patch: Partial<InvoiceAdminFilters>) {
  const params = new URLSearchParams({ tab: "facturas" });
  const next = { ...filters, ...patch };

  Object.entries(next).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  });

  return `/admin/pagos${params.size ? `?${params.toString()}` : ""}`;
}

function invoiceDetailHref(invoiceId: string) {
  return `/admin/pagos/facturas/${encodeURIComponent(invoiceId)}`;
}

function valueText(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "-";
}

function dateText(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function moneyText(amountMinor: number | undefined, currency = "EUR") {
  if (typeof amountMinor !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function invoiceLabel(invoice: { invoiceId: string; invoiceNumberFormatted?: string | null }) {
  return invoice.invoiceNumberFormatted || "Factura";
}

function statusBadgeClass(status: string | undefined) {
  const value = status?.toUpperCase();
  if (value === "ISSUED") {
    return "adminBadge adminBadgeOk";
  }
  if (value === "DRAFT") {
    return "adminBadge adminBadgeWarn";
  }
  if (value === "FAILED" || value === "VOIDED") {
    return "adminBadge adminBadgeError";
  }

  return "adminBadge";
}

function ResultBanner({ result }: { result: { ok: boolean; error?: string } }) {
  if (result.ok) {
    return null;
  }

  return (
    <div className="adminBanner adminBannerError">
      <p>{result.error}</p>
    </div>
  );
}

function FiltersPanel({ filters }: { filters: InvoiceAdminFilters }) {
  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Busqueda fiscal</h2>
          <p>Filtra por factura, pedido o estado fiscal.</p>
        </div>
        <Search aria-hidden="true" size={18} />
      </div>
      <form action={applyInvoiceFiltersAction} className="pricingDenseForm">
        <label className="adminField">
          <span>Factura</span>
          <input name="invoiceId" placeholder="invoiceId" defaultValue={filters.invoiceId ?? ""} />
        </label>
        <label className="adminField">
          <span>Pedido</span>
          <input name="orderId" placeholder="orderId" defaultValue={filters.orderId ?? ""} />
        </label>
        <label className="adminField">
          <span>Estado</span>
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ISSUED">ISSUED</option>
            <option value="FAILED">FAILED</option>
            <option value="VOIDED">VOIDED</option>
          </select>
        </label>
        <label className="adminField">
          <span>Limite</span>
          <input name="limit" min="1" max="100" type="number" defaultValue={filters.limit ?? "25"} />
        </label>
        <button className="adminButton adminButtonPrimary" type="submit">Buscar</button>
      </form>
    </section>
  );
}

function OperationsPanel({ capabilities }: Pick<Props, "capabilities">) {
  if (!capabilities.canManageInvoices) {
    return null;
  }

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Operacion fiscal</h2>
          <p>Solicita la emision ordinaria cuando el pedido ya tiene snapshot fiscal completo.</p>
        </div>
        <CreditCard aria-hidden="true" size={18} />
      </div>
      <form action={issueInvoiceFromFiscalConsoleAction} className="pricingDenseForm">
        <label className="adminField">
          <span>Pedido</span>
          <input name="orderId" placeholder="orderId" required />
        </label>
        <button className="adminButton" type="submit">Emitir factura</button>
      </form>
    </section>
  );
}

function InvoicesTable({ data }: Pick<Props, "data">) {
  if (!data.invoices.ok) {
    return <ResultBanner result={data.invoices} />;
  }

  if (!data.invoices.data.items.length) {
    return <div className="adminEmptyState">No hay facturas para el filtro actual.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th>Factura</th>
            <th>Pedido</th>
            <th>Estado</th>
            <th>Total</th>
            <th>Emitida</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.invoices.data.items.map((invoice) => (
            <tr key={invoice.invoiceId}>
              <td>
                <strong>{invoiceLabel(invoice)}</strong>
                <div className="adminMuted">{invoice.series} {invoice.fiscalPeriod}</div>
              </td>
              <td>
                <Link className="adminButton adminButtonTiny" href={`/admin/pedidos?orderId=${encodeURIComponent(invoice.orderId)}`}>
                  Abrir pedido
                </Link>
              </td>
              <td><span className={statusBadgeClass(invoice.status)}>{valueText(invoice.status)}</span></td>
              <td>{moneyText(invoice.totalMinor, invoice.currency)}</td>
              <td>{dateText(invoice.issuedAt ?? invoice.createdAt)}</td>
              <td>
                <div className="adminButtonRow">
                  <Link className="adminButton adminButtonTiny" href={invoiceDetailHref(invoice.invoiceId)}>
                    Abrir factura
                  </Link>
                  <Link className="adminButton adminButtonTiny" href={`/admin/pagos/invoices/${encodeURIComponent(invoice.invoiceId)}/document`} target="_blank">
                    Documento
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceKpis({ data }: Pick<Props, "data">) {
  const invoices = data.invoices.ok ? data.invoices.data : null;
  const issued = invoices?.items.filter((invoice) => invoice.status === "ISSUED").length ?? 0;
  const incidents = invoices?.items.filter((invoice) => invoice.status === "FAILED" || invoice.status === "VOIDED").length ?? 0;
  const totalMinor = invoices?.items.reduce((sum, invoice) => sum + (invoice.totalMinor ?? 0), 0) ?? 0;
  const currency = invoices?.items[0]?.currency ?? data.context.currency;

  return (
    <section className="adminKpiGrid">
      <div className="adminKpi">
        <span>Facturas</span>
        <strong>{data.invoices.ok ? data.invoices.data.total : "-"}</strong>
        <p>En el filtro actual</p>
      </div>
      <div className="adminKpi">
        <span>Emitidas</span>
        <strong>{issued}</strong>
        <p>En la página actual</p>
      </div>
      <div className="adminKpi">
        <span>Con incidencia</span>
        <strong>{incidents}</strong>
        <p>Fallidas o anuladas</p>
      </div>
      <div className="adminKpi">
        <span>Importe listado</span>
        <strong>{moneyText(totalMinor, currency)}</strong>
        <p>De la página actual</p>
      </div>
    </section>
  );
}

function InvoiceDetailPanel({ capabilities, data }: Pick<Props, "capabilities" | "data">) {
  if (!data.selectedInvoice.ok) {
    return <ResultBanner result={data.selectedInvoice} />;
  }
  if (!data.selectedInvoice.data) {
    return <div className="adminEmptyState">Selecciona una factura para ver lineas, documento y acciones fiscales.</div>;
  }

  const invoice = data.selectedInvoice.data;

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Resumen fiscal</h2>
          <p>Totales y estado de emisión.</p>
        </div>
        <span className={statusBadgeClass(invoice.status)}>{valueText(invoice.status)}</span>
      </div>
      <div className="adminTableScroller">
        <table aria-label="Resumen fiscal de la factura" className="adminTable pricingTable">
          <thead>
            <tr>
              <th scope="col">Base</th>
              <th scope="col">Impuesto</th>
              <th scope="col">Envío</th>
              <th scope="col">Total</th>
              <th scope="col">Emitida</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{moneyText(invoice.subtotalMinor, invoice.currency)}</td>
              <td>{moneyText(invoice.taxMinor, invoice.currency)}</td>
              <td>{moneyText(invoice.shippingMinor, invoice.currency)}</td>
              <td><strong>{moneyText(invoice.totalMinor, invoice.currency)}</strong></td>
              <td>{dateText(invoice.issuedAt ?? invoice.createdAt)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {invoice.failureReason ? (
        <div className="adminBanner adminBannerWarning">
          <p>{invoice.failureReason}</p>
        </div>
      ) : null}
      {invoice.lines.length ? (
        <section className="invoicesDetailSection">
          <h3>Líneas facturadas</h3>
          <div className="adminTableScroller">
            <table className="adminTable pricingTable">
            <thead>
              <tr>
                <th>Linea</th>
                <th>Cantidad</th>
                <th>Unitario</th>
                <th>IVA bps</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.lineId}>
                  <td>{valueText(line.name ?? line.lineId)}</td>
                  <td>{valueText(line.quantity)}</td>
                  <td>{moneyText(line.unitPriceMinor, invoice.currency)}</td>
                  <td>{valueText(line.taxRateBps)}</td>
                  <td>{moneyText(line.lineTotalMinor, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <div className="adminButtonRow">
        <Link className="adminButton adminButtonPrimary" href={`/admin/pagos/invoices/${encodeURIComponent(invoice.invoiceId)}/document`} target="_blank">
          <Download aria-hidden="true" size={16} />
          Ver documento
        </Link>
        <Link className="adminButton" href={`/admin/pedidos?orderId=${encodeURIComponent(invoice.orderId)}`}>
          Abrir pedido
        </Link>
      </div>
      {capabilities.canManageInvoices ? (
        <section className="invoicesDetailSection">
          <h3>Rectificación fiscal</h3>
          <form action={createFiscalInvoiceAdjustmentAction} className="pricingDenseForm">
            <input name="orderId" type="hidden" value={invoice.orderId} />
            <input name="invoiceId" type="hidden" value={invoice.invoiceId} />
            <input name="currency" type="hidden" value={invoice.currency ?? data.context.currency} />
            <input name="returnTo" type="hidden" value={invoiceDetailHref(invoice.invoiceId)} />
            <label className="adminField">
              <span>Documento</span>
              <select name="adjustmentType" required>
                <option value="CREDIT_NOTE">Nota de crédito</option>
                <option value="FISCAL_ADJUSTMENT">Ajuste fiscal</option>
              </select>
            </label>
            <label className="adminField">
              <span>Importe (céntimos)</span>
              <input name="amountMinor" min="1" placeholder="1299" required type="number" />
            </label>
            <label className="adminField">
              <span>Motivo</span>
              <input name="reason" placeholder="Devolución parcial, corrección fiscal..." required />
            </label>
            <button className="adminButton" type="submit">Crear nota o ajuste</button>
          </form>
        </section>
      ) : null}
    </section>
  );
}

function InvoicesAdminContent({ capabilities, data, filters }: Props) {
  return (
    <>
      {filters.notice ? (
        <div className="adminBanner adminBannerSuccess">
          <p>{filters.notice}</p>
        </div>
      ) : null}
      <InvoiceKpis data={data} />
      <div className="adminGrid invoicesWorkspace">
        <div className="adminStatusList">
          <FiltersPanel filters={filters} />
          <section className="adminCard">
            <div className="adminCardHeader">
              <div>
                <h2>Facturas</h2>
                <p>Consulta documentos fiscales y abre la ficha de cada factura.</p>
              </div>
            </div>
            <InvoicesTable data={data} />
          </section>
        </div>
        <div className="adminStatusList">
          <OperationsPanel capabilities={capabilities} />
        </div>
      </div>
    </>
  );
}

export function InvoicesAdminPage({ capabilities, data, embedded = false, filters }: Props) {
  if (embedded) {
    return <InvoicesAdminContent capabilities={capabilities} data={data} filters={filters} />;
  }

  return (
    <main className="adminPage">
      <InvoicesAdminContent capabilities={capabilities} data={data} filters={filters} />
    </main>
  );
}

export function InvoiceDetailAdminPage({ capabilities, data, filters }: Omit<Props, "embedded">) {
  const invoice = data.selectedInvoice.ok ? data.selectedInvoice.data : null;

  return (
    <main className="adminPage invoiceDetailPage">
      <header className="invoiceDetailHeader">
        <div>
          <Link className="adminBreadcrumb" href={invoicesHref(filters, { invoiceId: undefined, notice: undefined })}>Admin / Pagos / Facturación</Link>
          <h1 className="adminPageTitle">{invoice ? invoiceLabel(invoice) : "Factura"}</h1>
          <p className="adminPageIntro">Detalle fiscal, documento y rectificaciones de la factura.</p>
        </div>
        <Link className="adminButton" href={invoicesHref(filters, { invoiceId: undefined, notice: undefined })}>Volver a Facturación</Link>
      </header>
      {filters.notice ? <div className="adminBanner adminBannerSuccess"><p>{filters.notice}</p></div> : null}
      <InvoiceDetailPanel capabilities={capabilities} data={data} />
    </main>
  );
}
