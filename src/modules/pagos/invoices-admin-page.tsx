import Link from "next/link";
import { CreditCard, Download, FileText, Search } from "lucide-react";
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
  const params = new URLSearchParams();
  const next = { ...filters, ...patch };

  Object.entries(next).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  });

  return `/admin/pagos${params.size ? `?${params.toString()}` : ""}`;
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

function InvoicesTable({ data, filters }: Pick<Props, "data" | "filters">) {
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
            <th>Cliente</th>
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
                <strong>{invoice.invoiceNumberFormatted ?? invoice.invoiceId}</strong>
                <div className="adminMuted">{invoice.series} {invoice.fiscalPeriod}</div>
              </td>
              <td>{valueText(invoice.orderId)}</td>
              <td>{valueText(invoice.customerId)}</td>
              <td><span className={statusBadgeClass(invoice.status)}>{valueText(invoice.status)}</span></td>
              <td>{moneyText(invoice.totalMinor, invoice.currency)}</td>
              <td>{dateText(invoice.issuedAt ?? invoice.createdAt)}</td>
              <td>
                <div className="adminButtonRow">
                  <Link className="adminButton adminButtonTiny" href={invoicesHref(filters, { invoiceId: invoice.invoiceId })}>
                    Ver detalle
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
  const failed = invoices?.items.filter((invoice) => invoice.status === "FAILED").length ?? 0;
  const totalMinor = invoices?.items.reduce((sum, invoice) => sum + (invoice.totalMinor ?? 0), 0) ?? 0;
  const currency = invoices?.items[0]?.currency ?? data.context.currency;

  return (
    <section className="adminKpiGrid">
      <div className="adminKpi">
        <span>Servicio Invoice</span>
        <strong>{data.health.ok ? valueText(data.health.data?.status) : "Sin conexion"}</strong>
        <p>{data.health.ok ? `DB ${data.health.data?.databaseReachable ? "ok" : "pendiente"}` : data.health.error}</p>
      </div>
      <div className="adminKpi">
        <span>Facturas filtradas</span>
        <strong>{data.invoices.ok ? data.invoices.data.total : "-"}</strong>
        <p>{issued} emitidas en pagina actual</p>
      </div>
      <div className="adminKpi">
        <span>Importe pagina</span>
        <strong>{moneyText(totalMinor, currency)}</strong>
        <p>{failed} con fallo fiscal</p>
      </div>
      <div className="adminKpi">
        <span>Documentos</span>
        <strong>{data.templatePreview.ok ? valueText(data.templatePreview.data?.documentType) : "-"}</strong>
        <p>{data.health.ok ? valueText(data.health.data?.documentDriver) : "Plantilla no disponible"}</p>
      </div>
    </section>
  );
}

function InvoiceDetail({ capabilities, data }: Pick<Props, "capabilities" | "data">) {
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
          <h2>Detalle factura</h2>
          <p>{invoice.invoiceNumberFormatted ?? invoice.invoiceId}</p>
        </div>
        <span className={statusBadgeClass(invoice.status)}>{valueText(invoice.status)}</span>
      </div>
      <dl className="adminDefinitionList">
        <div><dt>Factura</dt><dd>{invoice.invoiceId}</dd></div>
        <div><dt>Pedido</dt><dd>{invoice.orderId}</dd></div>
        <div><dt>Cliente</dt><dd>{valueText(invoice.customerId)}</dd></div>
        <div><dt>Total</dt><dd>{moneyText(invoice.totalMinor, invoice.currency)}</dd></div>
        <div><dt>Base</dt><dd>{moneyText(invoice.subtotalMinor, invoice.currency)}</dd></div>
        <div><dt>Impuesto</dt><dd>{moneyText(invoice.taxMinor, invoice.currency)}</dd></div>
        <div><dt>Envio</dt><dd>{moneyText(invoice.shippingMinor, invoice.currency)}</dd></div>
        <div><dt>Emitida</dt><dd>{dateText(invoice.issuedAt ?? invoice.createdAt)}</dd></div>
      </dl>
      {invoice.failureReason ? (
        <div className="adminBanner adminBannerWarning">
          <p>{invoice.failureReason}</p>
        </div>
      ) : null}
      {invoice.lines.length ? (
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
        <form action={createFiscalInvoiceAdjustmentAction} className="pricingDenseForm">
          <input name="orderId" type="hidden" value={invoice.orderId} />
          <input name="invoiceId" type="hidden" value={invoice.invoiceId} />
          <input name="currency" type="hidden" value={invoice.currency ?? data.context.currency} />
          <label className="adminField">
            <span>Documento</span>
            <select name="adjustmentType" required>
              <option value="CREDIT_NOTE">Nota de credito</option>
              <option value="FISCAL_ADJUSTMENT">Ajuste fiscal</option>
            </select>
          </label>
          <label className="adminField">
            <span>Importe menor</span>
            <input name="amountMinor" min="1" placeholder="1299" required type="number" />
          </label>
          <label className="adminField">
            <span>Motivo</span>
            <input name="reason" placeholder="Devolucion parcial, correccion fiscal..." required />
          </label>
          <button className="adminButton" type="submit">Crear nota/ajuste</button>
        </form>
      ) : null}
    </section>
  );
}

function DocumentPanel({ data }: Pick<Props, "data">) {
  const document = data.selectedDocument.ok ? data.selectedDocument.data : null;
  const template = data.templatePreview.ok ? data.templatePreview.data : null;
  const html = document?.html ?? template?.html;

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Documento fiscal</h2>
          <p>{document ? document.documentId : "Preview plantilla vigente"}</p>
        </div>
        <FileText aria-hidden="true" size={18} />
      </div>
      {!data.selectedDocument.ok ? <ResultBanner result={data.selectedDocument} /> : null}
      {html ? (
        <div className="adminCodePreview">
          {html.slice(0, 900)}
        </div>
      ) : (
        <div className="adminEmptyState">Sin documento HTML disponible para la seleccion actual.</div>
      )}
    </section>
  );
}

function InvoicesAdminContent({ capabilities, data, filters }: Props) {
  return (
    <>
      <div className="adminBreadcrumb">Admin / Pagos / Facturacion fiscal</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Facturas y fiscalidad</h1>
          <p className="adminPageIntro">Consola para buscar facturas, revisar documentos, emitir por pedido y crear notas de credito o ajustes fiscales.</p>
        </div>
      </div>
      {filters.notice ? (
        <div className="adminBanner adminBannerSuccess">
          <p>{filters.notice}</p>
        </div>
      ) : null}
      <InvoiceKpis data={data} />
      <div className="adminGrid">
        <div className="adminStatusList">
          <FiltersPanel filters={filters} />
          <section className="adminCard">
            <div className="adminCardHeader">
              <div>
                <h2>Bandeja de facturas</h2>
                <p>Listado fiscal emitido por Invoice.</p>
              </div>
            </div>
            <InvoicesTable data={data} filters={filters} />
          </section>
          <InvoiceDetail capabilities={capabilities} data={data} />
        </div>
        <div className="adminStatusList">
          <OperationsPanel capabilities={capabilities} />
          <DocumentPanel data={data} />
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
