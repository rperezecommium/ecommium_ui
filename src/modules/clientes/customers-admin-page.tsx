import Link from "next/link";
import Image from "next/image";
import {
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  FileText,
  Home,
  LifeBuoy,
  Mail,
  MessageSquare,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  CustomerAddress,
  CustomerOverviewData,
  CustomerProfile,
  CustomerPurchase,
  CustomerPurchasesData,
  CustomersAdminCapabilities,
  CustomersAdminData,
  CustomersAdminFilters,
  CustomersAdminPermission,
  CustomersAdminResult,
} from "./customers-admin-types";
import { buildCustomerAdminTimeline } from "./customers-admin";
import {
  applyCustomersFiltersAction,
  createCustomerNoteAction,
  createCustomerAction,
  createCustomerAddressAction,
  createCustomerPrivacyRequestAction,
  createCustomerTaskAction,
  deleteCustomerAddressAction,
  executeCustomerPrivacyErasureAction,
  recordCustomerConsentAction,
  replaceCustomerTagsAction,
  requestCustomerPasswordResetAction,
  resendCustomerActivationAction,
  revokeCustomerSessionsAction,
  sendCustomerEmailAction,
  setDefaultBillingAddressAction,
  setDefaultShippingAddressAction,
  setCustomerAccountActivationAction,
  updateCustomerPrivacyRequestStatusAction,
  updateCustomerProfileAction,
  updateCustomerAddressAction,
  updateCustomerTaskStatusAction,
} from "./customers-admin-actions";

type CustomersAdminPageProps = {
  data: CustomersAdminData;
  filters: CustomersAdminFilters;
  capabilities: CustomersAdminCapabilities;
};

export type CustomerDetailTab =
  | "resumen"
  | "perfil"
  | "compras"
  | "facturacion"
  | "comunicaciones"
  | "soporte"
  | "cuenta"
  | "privacidad"
  | "actividad"
  | "backoffice";

const customerDetailTabs: Array<{ id: CustomerDetailTab; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "perfil", label: "Perfil" },
  { id: "compras", label: "Compras" },
  { id: "facturacion", label: "Facturación" },
  { id: "comunicaciones", label: "Comunicaciones" },
  { id: "soporte", label: "Soporte" },
  { id: "cuenta", label: "Cuenta" },
  { id: "privacidad", label: "Privacidad" },
  { id: "actividad", label: "Actividad" },
  { id: "backoffice", label: "Backoffice" },
];

const customerAvatarImagePath: Record<string, string> = {
  "human-01": "/storefront/avatars/human-01.jpg",
  "human-02": "/storefront/avatars/human-02.jpg",
  "human-03": "/storefront/avatars/human-03.jpg",
  "human-04": "/storefront/avatars/human-04.jpg",
  "human-05": "/storefront/avatars/human-05.jpg",
  "animal-cat": "/storefront/avatars/animal-cat.jpg",
  "animal-dog": "/storefront/avatars/animal-dog.jpg",
  "animal-fox": "/storefront/avatars/animal-fox.jpg",
  "animal-panda": "/storefront/avatars/animal-panda.jpg",
  "animal-owl": "/storefront/avatars/animal-owl.jpg",
};

function customersHref(filters: CustomersAdminFilters, patch: Partial<CustomersAdminFilters>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...patch };

  for (const [key, value] of Object.entries(next)) {
    if (key === "activitySource") {
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  }

  return `/admin/clientes${params.size ? `?${params.toString()}` : ""}`;
}

function fullName(customer: CustomerProfile) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email || customer.customerId;
}

function customerDetailHref(
  customer: CustomerProfile,
  tab: CustomerDetailTab = "resumen",
  extra: Record<string, string | undefined> = {},
) {
  const reference = customer.customerReference ?? customer.customerId;
  const params = new URLSearchParams();
  if (tab !== "resumen") {
    params.set("tab", tab);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/admin/clientes/${encodeURIComponent(reference)}${params.size ? `?${params.toString()}` : ""}`;
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

function dateText(value: string | undefined) {
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

function purchasePageHref(filters: CustomersAdminFilters, offset: number, limit: number) {
  return customersHref(filters, {
    drawer: "detail",
    purchasesOffset: String(Math.max(0, offset)),
    purchasesLimit: String(limit),
  });
}

function customerKind(customer: CustomerProfile) {
  return customer.isGuest ? "Guest" : "Registrado";
}

function customerKindBadge(customer: CustomerProfile) {
  return customer.isGuest ? "adminBadge adminBadgeWarn" : "adminBadge adminBadgeOk";
}

function customerAddressSummary(customer: CustomerProfile) {
  const items = [];
  if (customer.defaultShippingAddress) {
    items.push("Envio");
  }
  if (customer.defaultBillingAddress) {
    items.push("Fiscal");
  }

  return items.length ? items.join(" / ") : "-";
}

function addressLabel(address: CustomerAddress) {
  return address.addressName ?? address.receiverName ?? address.addressId;
}

function addressLine(address: CustomerAddress) {
  return [address.street, address.number, address.complement].filter(Boolean).join(", ") || "-";
}

function addressRoleLabel(value: string | undefined) {
  if (value === "SHIPPING") {
    return "Envio";
  }
  if (value === "BILLING") {
    return "Facturacion";
  }

  return "Ambas";
}

function currentPageSummary(customers: CustomerProfile[]) {
  const registered = customers.filter((customer) => !customer.isGuest).length;
  const guests = customers.filter((customer) => customer.isGuest).length;
  const newsletter = customers.filter((customer) => customer.clientPreferencesData?.optinNewsLetter).length;

  return { registered, guests, newsletter };
}

function buyerTypeLabel(value: string | undefined) {
  return value === "BUSINESS_BUYER" ? "Empresa" : "Particular";
}

function buyerTypeValue(value: string | undefined) {
  return value === "BUSINESS_BUYER" ? "BUSINESS_BUYER" : "PRIVATE_BUYER";
}

function localeValue(customer: CustomerProfile | undefined, fallback: string) {
  return customer?.clientPreferencesData?.locale || fallback || "es-ES";
}

function latestPurchase(purchases: CustomerPurchase[] | undefined) {
  return [...(purchases ?? [])].sort((left, right) => {
    const leftDate = new Date(left.placedAt ?? left.recordedAt ?? "").getTime();
    const rightDate = new Date(right.placedAt ?? right.recordedAt ?? "").getTime();
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  })[0];
}

function countText(value: number | undefined) {
  return typeof value === "number" ? String(value) : "0";
}

function statusBadgeClass(status: string | undefined) {
  const value = status?.toUpperCase();
  if (value === "COMPLETED" || value === "DONE" || value === "SENT" || value === "PAID" || value === "ISSUED") {
    return "adminBadge adminBadgeOk";
  }
  if (value === "OPEN" || value === "IN_REVIEW" || value === "PENDING" || value === "DRAFT") {
    return "adminBadge adminBadgeWarn";
  }

  return "adminBadge";
}

function communicationChannelLabel(channel: string | undefined) {
  const normalized = channel?.toUpperCase();
  if (normalized === "EMAIL") {
    return "Email";
  }
  if (normalized === "SMS") {
    return "SMS";
  }
  if (normalized === "PUSH") {
    return "Push";
  }
  if (normalized === "WHATSAPP") {
    return "WhatsApp";
  }

  return valueText(channel);
}

function activitySourceLabel(source: string) {
  const labels: Record<string, string> = {
    account: "Cuenta",
    "after-sales": "Soporte",
    communication: "Comunicaciones",
    consent: "Privacidad",
    customer: "Perfil",
    invoice: "Facturación",
    note: "Backoffice",
    overview: "Sistema",
    purchase: "Pedidos",
    privacy: "Privacidad",
    session: "Cuenta",
    task: "Backoffice",
  };

  return labels[source] ?? "Sistema";
}

function accountStatusValue(account: CustomerOverviewData["account"] | undefined) {
  if (!account) {
    return "NO_AUTH_ACCOUNT";
  }

  return account.status ?? (account.active === false ? "BLOCKED" : "ACTIVE");
}

function accountStatusLabel(status: string | undefined) {
  if (status === "ACTIVE") {
    return "Activa";
  }
  if (status === "PENDING_ACTIVATION") {
    return "Pendiente activacion";
  }
  if (status === "EMAIL_DELIVERY_FAILED") {
    return "Email fallido";
  }
  if (status === "ACTIVATION_EXPIRED") {
    return "Activacion expirada";
  }
  if (status === "BLOCKED") {
    return "Bloqueada";
  }

  return "No vinculada";
}

function accountStatusBadgeClass(status: string | undefined) {
  return status === "ACTIVE" ? "adminBadge adminBadgeOk" : "adminBadge adminBadgeWarn";
}

function accountActivationActionLabel(status: string | undefined, nextActive: boolean) {
  if (!nextActive) {
    return "Bloquear cuenta";
  }
  if (status === "PENDING_ACTIVATION" || status === "EMAIL_DELIVERY_FAILED" || status === "ACTIVATION_EXPIRED") {
    return "Activar manualmente";
  }

  return "Reactivar cuenta";
}

function OverviewMiniList<T>({
  items,
  emptyLabel,
  renderItem,
}: {
  items: T[];
  emptyLabel: string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  if (!items.length) {
    return <div className="adminEmptyState">{emptyLabel}</div>;
  }

  return (
    <div className="customersOverviewList">
      {items.slice(0, 4).map((item, index) => (
        <div className="customersOverviewListItem" key={index}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

function CustomerDataTable({
  columns,
  fullWidth = false,
  label,
}: {
  columns: Array<{ label: string; value: ReactNode }>;
  fullWidth?: boolean;
  label: string;
}) {
  return (
    <div className={`adminTableScroller${fullWidth ? " customerDataTableFullWidth" : ""}`}>
      <table aria-label={label} className="adminTable pricingTable">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.label} scope="col">{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columns.map((column) => <td key={column.label}>{column.value}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CustomerSummaryPanel({
  canReadPurchases,
  customer,
  data,
}: {
  canReadPurchases: boolean;
  customer: CustomerProfile;
  data: CustomersAdminData;
}) {
  const lastPurchase = canReadPurchases ? latestPurchase(data.purchases.data?.items) : undefined;
  const purchasesCount = canReadPurchases ? data.purchases.data?.total ?? 0 : "-";
  const newsletter = customer.clientPreferencesData?.optinNewsLetter ?? false;
  const overview = data.overview.data;
  const account = overview?.account;
  const latestCase = overview?.afterSales.items[0];
  const latestCommunication = overview?.communications.items[0];

  return (
    <section className="pricingPanel customerSummaryPanel">
      <div className="pricingPanelHeader">
        <div>
          <h3>Resumen</h3>
          <p>Indicadores principales del cliente</p>
        </div>
        <span className={customerKindBadge(customer)}>{customerKind(customer)}</span>
      </div>
      <div className="customerSummaryDomains">
        <SummaryDomain icon={<UserCheck aria-hidden="true" size={16} />} title="Perfil">
          <SummaryMetric label="Estado" value={accountStatusLabel(accountStatusValue(account))} />
          <SummaryMetric label="Cliente" value={customerKind(customer)} />
          <SummaryMetric label="Tipo" value={buyerTypeLabel(customer.buyerType)} />
          <SummaryMetric label="Registro" value={dateText(customer.createdAt)} />
          <SummaryMetric label="Idioma" value={localeValue(customer, data.context.locale)} />
          <SummaryMetric label="Newsletter" value={newsletter ? "Sí" : "No"} />
          <SummaryMetric label="Canal" value={data.context.channel.toUpperCase()} />
        </SummaryDomain>
        <SummaryDomain icon={<UserRound aria-hidden="true" size={16} />} title="Compras">
          <SummaryMetric label="Pedidos" value={String(purchasesCount)} />
          <SummaryMetric label="Total gastado" value="No disponible" />
          <SummaryMetric label="Ticket medio" value="No disponible" />
          <SummaryMetric label="Última compra" value={dateText(lastPurchase?.placedAt ?? lastPurchase?.recordedAt)} />
          <SummaryMetric label="Carritos abandonados" value="No disponible" />
        </SummaryDomain>
        <SummaryDomain icon={<LifeBuoy aria-hidden="true" size={16} />} title="Soporte">
          <SummaryMetric label="Casos abiertos" value="No disponible" />
          <SummaryMetric label="Último caso" value={dateText(latestCase?.createdAt)} />
        </SummaryDomain>
        <SummaryDomain icon={<Mail aria-hidden="true" size={16} />} title="Comunicación">
          <SummaryMetric label="Emails enviados" value="No disponible" />
          <SummaryMetric label="Última comunicación" value={dateText(latestCommunication?.createdAt)} />
        </SummaryDomain>
        <SummaryDomain icon={<ShieldCheck aria-hidden="true" size={16} />} title="Cuenta">
          <SummaryMetric label="Sesiones activas" value={countText(overview?.sessions?.total)} />
          <SummaryMetric label="Estado login" value={accountStatusLabel(accountStatusValue(account))} />
          <SummaryMetric label="Duplicados" value={countText(overview?.duplicateCandidates.total)} />
        </SummaryDomain>
      </div>
    </section>
  );
}

function SummaryDomain({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="customerSummaryDomain">
      <h4>{icon}{title}</h4>
      <dl>{children}</dl>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function exactPurchaseTotals(purchases: CustomerPurchasesData | null | undefined) {
  const items = purchases?.items ?? [];
  const hasCompleteDataset = purchases?.total === items.length && items.every((item) => typeof item.totalAmountMinor === "number");
  const currency = items[0]?.currency;
  const hasSingleCurrency = Boolean(currency) && items.every((item) => item.currency === currency);

  if (!hasCompleteDataset || !hasSingleCurrency) {
    return undefined;
  }

  const totalMinor = items.reduce((sum, item) => sum + (item.totalAmountMinor ?? 0), 0);
  return {
    total: moneyText(totalMinor, currency),
    average: moneyText(Math.round(totalMinor / Math.max(1, items.length)), currency),
    cancellations: String(items.filter((item) => /CANCELLED|CANCELED/.test(item.status ?? "")).length),
  };
}

function PurchasesKpiPanel({ purchases }: { purchases: CustomerPurchasesData | null | undefined }) {
  const totals = exactPurchaseTotals(purchases);

  return (
    <div className="adminSummaryGrid customerDomainKpis">
      <div><span>Pedidos</span><strong>{countText(purchases?.total)}</strong></div>
      <div><span>Importe total</span><strong>{totals?.total ?? "No disponible"}</strong></div>
      <div><span>Ticket medio</span><strong>{totals?.average ?? "No disponible"}</strong></div>
      <div><span>Cancelaciones</span><strong>{totals?.cancellations ?? "No disponible"}</strong></div>
      <div><span>Reembolsos</span><strong>No disponible</strong></div>
      <div><span>Devoluciones</span><strong>No disponible</strong></div>
    </div>
  );
}

function HiddenCustomerFields({ customer, returnTo }: { customer: CustomerProfile; returnTo?: string }) {
  return (
    <>
      <input name="customerId" type="hidden" value={customer.customerId} />
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
    </>
  );
}

function AccountOverviewPanel({
  capabilities,
  customer,
  overview,
  returnTo,
}: {
  capabilities: CustomersAdminCapabilities;
  customer: CustomerProfile;
  overview: CustomerOverviewData | null;
  returnTo?: string;
}) {
  const account = overview?.account;
  const accountStatus = accountStatusValue(account);
  const activation = account?.activation;
  const nextActive = account?.active === false;
  const sessions = overview?.sessions?.items ?? [];

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h3>Gestion de acceso</h3>
          <p>Estado, activación y seguridad de acceso</p>
        </div>
        <span className={accountStatusBadgeClass(accountStatus)}>
          {accountStatusLabel(accountStatus)}
        </span>
      </div>
      <CustomerDataTable
        label="Estado de la cuenta"
        columns={[
          { label: "Estado cuenta", value: accountStatusLabel(accountStatus) },
          { label: "Estado activación", value: valueText(activation?.tokenStatus) },
          { label: "Vence activación", value: dateText(activation?.expiresAt) },
          { label: "Sesiones activas", value: countText(overview?.sessions?.total) },
        ]}
      />
      {capabilities.canManageAccount ? (
        <div className="customersActionGrid">
          {account ? (
            <form action={setCustomerAccountActivationAction} className="customersAccessAction">
              <HiddenCustomerFields customer={customer} returnTo={returnTo} />
              <input name="active" type="hidden" value={nextActive ? "true" : "false"} />
              <input name="reason" placeholder="Motivo" />
              <button className="adminButton adminButtonTiny" type="submit">
                {accountActivationActionLabel(accountStatus, nextActive)}
              </button>
            </form>
          ) : null}
          {account && accountStatus !== "ACTIVE" ? (
            <form action={resendCustomerActivationAction} className="customersInlineAction">
              <HiddenCustomerFields customer={customer} returnTo={returnTo} />
              <input name="locale" type="hidden" value={localeValue(customer, "es-ES")} />
              <input name="reason" type="hidden" value="Reenvio manual de activacion desde Customer 360" />
              <button className="adminButton adminButtonTiny" type="submit">Reenviar activacion</button>
            </form>
          ) : null}
          {account ? (
            <form action={requestCustomerPasswordResetAction} className="customersInlineAction">
              <HiddenCustomerFields customer={customer} returnTo={returnTo} />
              <input name="locale" type="hidden" value={localeValue(customer, "es-ES")} />
              <input name="reason" type="hidden" value="Solicitud manual de reset desde Customer 360" />
              <button className="adminButton adminButtonTiny" type="submit">Solicitar reset</button>
            </form>
          ) : null}
        </div>
      ) : null}
      <div className="customersOverviewSubsection">
        <h4>Sesiones</h4>
        <OverviewMiniList
          emptyLabel="Sin sesiones activas."
          items={sessions}
          renderItem={(session) => (
            <>
              <div>
                <strong>{valueText(session.device?.deviceName ?? "Sesión activa")}</strong>
                <span>{valueText(session.device?.ipAddress)}</span>
              </div>
              <small>{dateText(session.lastSeenAt ?? session.createdAt)}</small>
            </>
          )}
        />
        {capabilities.canWriteSessions && sessions.length ? (
          <form action={revokeCustomerSessionsAction} className="customersAccessAction">
            <HiddenCustomerFields customer={customer} returnTo={returnTo} />
            <input name="reason" placeholder="Motivo" />
            <button className="adminButton adminButtonTiny adminButtonDanger" type="submit">Revocar sesiones</button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

function OperationalOverviewPanel({
  capabilities,
  customer,
  overview,
  section,
  returnTo,
}: {
  capabilities: CustomersAdminCapabilities;
  customer: CustomerProfile;
  overview: CustomerOverviewData | null;
  section: "privacidad" | "backoffice";
  returnTo?: string;
}) {
  const consents = overview?.consents?.current?.marketingEmail;
  const tags = overview?.tags.items ?? [];
  const notes = overview?.notes.items ?? [];
  const tasks = overview?.tasks.items ?? [];
  const privacyRequests = overview?.privacyRequests.items ?? [];
  const isPrivacy = section === "privacidad";
  const pendingErasureRequest = privacyRequests.find(
    (request) =>
      request.requestType === "ERASURE" &&
      request.status !== "COMPLETED" &&
      request.status !== "REJECTED" &&
      request.status !== "CANCELED",
  );

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h3>{isPrivacy ? "Privacidad" : "Backoffice"}</h3>
          <p>{isPrivacy ? "Consentimientos y solicitudes de datos" : "Notas, tags, tareas y asignaciones internas"}</p>
        </div>
        <ClipboardList aria-hidden="true" size={18} />
      </div>
      <div className="adminSummaryGrid">
        {isPrivacy ? (
          <>
            <div><ShieldCheck aria-hidden="true" size={16} /><span>Marketing</span><strong>{consents?.granted ? "Sí" : "No"}</strong></div>
            <div><ShieldCheck aria-hidden="true" size={16} /><span>Solicitudes</span><strong>{countText(overview?.privacyRequests.total)}</strong></div>
          </>
        ) : (
          <>
            <div><MessageSquare aria-hidden="true" size={16} /><span>Notas</span><strong>{countText(overview?.notes.total)}</strong></div>
            <div><Tag aria-hidden="true" size={16} /><span>Tags</span><strong>{countText(overview?.tags.total)}</strong></div>
            <div><ClipboardList aria-hidden="true" size={16} /><span>Tareas</span><strong>{countText(overview?.tasks.total)}</strong></div>
          </>
        )}
      </div>
      <CustomerDataTable
        label={isPrivacy ? "Estado de privacidad" : "Estado de backoffice"}
        columns={isPrivacy
          ? [
            { label: "Newsletter", value: consents?.granted ? "Sí" : "No" },
            { label: "Marketing", value: consents?.granted ? "Concedido" : "No concedido" },
          ]
          : [{ label: "Última tarea", value: valueText(overview?.tasks.items[0]?.title) }]}
      />
      {!isPrivacy ? <>
      <div className="customersOverviewSubsection">
        <h4>Tags internos</h4>
        {tags.length ? (
          <div className="customersTagList">
            {tags.slice(0, 8).map((tagItem) => (
              <span className="adminBadge" key={tagItem.tagKey}>{tagItem.label ?? tagItem.tagKey}</span>
            ))}
          </div>
        ) : (
          <div className="adminEmptyState">Sin tags internos.</div>
        )}
        {capabilities.canWriteTags ? (
          <form action={replaceCustomerTagsAction} className="customersInlineForm">
            <HiddenCustomerFields customer={customer} returnTo={returnTo} />
            <input name="tags" defaultValue={tags.map((tagItem) => tagItem.label ?? tagItem.tagKey).join(", ")} />
            <button className="adminButton adminButtonTiny" type="submit">Guardar tags</button>
          </form>
        ) : null}
      </div>
      <div className="customersOverviewSubsection">
        <h4>Notas internas</h4>
        <OverviewMiniList
          emptyLabel="Sin notas internas."
          items={notes}
          renderItem={(note) => (
            <>
              <div>
                <strong>{valueText(note.body)}</strong>
                <span>{valueText(note.authorEmail)}</span>
              </div>
              <small>{dateText(note.createdAt)}</small>
            </>
          )}
        />
        {capabilities.canWriteNotes ? (
          <form action={createCustomerNoteAction} className="customersInlineForm">
            <HiddenCustomerFields customer={customer} returnTo={returnTo} />
            <textarea name="body" placeholder="Nueva nota interna" required rows={2} />
            <button className="adminButton adminButtonTiny" type="submit">Crear nota</button>
          </form>
        ) : null}
      </div>
      <div className="customersOverviewSubsection">
        <h4>Tareas abiertas</h4>
        <OverviewMiniList
          emptyLabel="Sin tareas recientes."
          items={tasks}
          renderItem={(task) => (
            <>
              <div>
                <strong>{valueText(task.title)}</strong>
                <span>{task.assignedEmployeeId ? "Responsable asignado" : "Sin responsable"}</span>
              </div>
              <span className={statusBadgeClass(task.status)}>{valueText(task.status)}</span>
              {capabilities.canWriteTasks && task.status !== "DONE" ? (
                <form action={updateCustomerTaskStatusAction} className="customersInlineAction">
                  <HiddenCustomerFields customer={customer} returnTo={returnTo} />
                  <input name="taskId" type="hidden" value={task.taskId} />
                  <input name="status" type="hidden" value="DONE" />
                  <button className="adminIconButton" type="submit" title="Marcar tarea como hecha">
                    <ShieldCheck aria-hidden="true" size={14} />
                    <span className="adminVisuallyHidden">Marcar tarea como hecha</span>
                  </button>
                </form>
              ) : null}
            </>
          )}
        />
        {capabilities.canWriteTasks ? (
          <form action={createCustomerTaskAction} className="customersInlineForm">
            <HiddenCustomerFields customer={customer} returnTo={returnTo} />
            <input name="title" placeholder="Nueva tarea" required />
            <input aria-label="Responsable" name="assignedEmployeeId" placeholder="Responsable (ID empleado)" />
            <button className="adminButton adminButtonTiny" type="submit">Crear tarea</button>
          </form>
        ) : null}
      </div>
      </> : null}
      {isPrivacy ? <div className="customersOverviewSubsection">
        <h4>Solicitudes GDPR</h4>
        <OverviewMiniList
          emptyLabel="Sin solicitudes de privacidad."
          items={privacyRequests}
          renderItem={(request) => (
            <>
              <div>
                <strong>{valueText(request.requestType)}</strong>
                <span>{valueText(request.requesterEmail)}</span>
              </div>
              <span className={statusBadgeClass(request.status)}>{valueText(request.status)}</span>
              {capabilities.canWritePrivacy && request.status !== "COMPLETED" ? (
                <form action={updateCustomerPrivacyRequestStatusAction} className="customersInlineAction">
                  <HiddenCustomerFields customer={customer} returnTo={returnTo} />
                  <input name="requestId" type="hidden" value={request.requestId} />
                  <input name="status" type="hidden" value="IN_REVIEW" />
                  <button className="adminIconButton" type="submit" title="Marcar en revision">
                    <Eye aria-hidden="true" size={14} />
                    <span className="adminVisuallyHidden">Marcar en revision</span>
                  </button>
                </form>
              ) : null}
            </>
          )}
        />
        {capabilities.canWritePrivacy ? (
          <form action={createCustomerPrivacyRequestAction} className="customersInlineForm">
            <HiddenCustomerFields customer={customer} returnTo={returnTo} />
            <select name="requestType" defaultValue="ACCESS">
              <option value="ACCESS">Acceso</option>
              <option value="RECTIFICATION">Rectificacion</option>
              <option value="ERASURE">Borrado</option>
            </select>
            <input name="reason" placeholder="Motivo" />
            <button className="adminButton adminButtonTiny" type="submit">Crear solicitud</button>
          </form>
        ) : null}
        {capabilities.canWritePrivacy ? (
          <form action={executeCustomerPrivacyErasureAction} className="customersAccessAction">
            <HiddenCustomerFields customer={customer} returnTo={returnTo} />
            {pendingErasureRequest ? (
              <input name="requestId" type="hidden" value={pendingErasureRequest.requestId} />
            ) : null}
            <input name="reason" placeholder="Motivo legal" required />
            <button className="adminButton adminButtonTiny adminButtonDanger" type="submit">
              <Trash2 aria-hidden="true" size={14} />
              Baja legal
            </button>
          </form>
        ) : null}
        <div className="customersActionGrid">
          {capabilities.canWriteConsents ? (
            <form action={recordCustomerConsentAction} className="customersInlineAction">
              <HiddenCustomerFields customer={customer} returnTo={returnTo} />
              <input name="granted" type="hidden" value={consents?.granted ? "false" : "true"} />
              <input name="reason" type="hidden" value="Cambio manual desde Customer 360" />
              <button className="adminButton adminButtonTiny" type="submit">
                {consents?.granted ? "Revocar marketing" : "Conceder marketing"}
              </button>
            </form>
          ) : null}
        </div>
      </div> : null}
    </section>
  );
}

function ContinuityOverviewPanel({
  capabilities,
  customer,
  overview,
  section,
  returnTo,
}: {
  capabilities: CustomersAdminCapabilities;
  customer: CustomerProfile;
  overview: CustomerOverviewData | null;
  section: "facturacion" | "comunicaciones" | "soporte";
  returnTo?: string;
}) {
  const invoices = overview?.invoices.items ?? [];
  const afterSales = overview?.afterSales.items ?? [];
  const communications = overview?.communications.items ?? [];
  const sectionTitle = section === "facturacion" ? "Facturación" : section === "comunicaciones" ? "Comunicaciones" : "Soporte";
  const sectionDescription = section === "facturacion"
    ? "Facturas, pagos y ajustes del cliente"
    : section === "comunicaciones"
      ? "Historial y envío de comunicaciones"
      : "Casos y postventa del cliente";

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h3>{sectionTitle}</h3>
          <p>{sectionDescription}</p>
        </div>
        <FileText aria-hidden="true" size={18} />
      </div>
      <div className="adminSummaryGrid">
        {section === "facturacion" ? <>
          <div><FileText aria-hidden="true" size={16} /><span>Facturas</span><strong>{countText(overview?.invoices.total)}</strong></div>
          <div><span>Notas de crédito</span><strong>No disponible</strong></div>
          <div><span>Reembolsos</span><strong>No disponible</strong></div>
          <div><span>Pagos</span><strong>No disponible</strong></div>
          <div><span>Métodos de pago</span><strong>No disponible</strong></div>
        </> : null}
        {section === "soporte" ? <>
        <div>
          <LifeBuoy aria-hidden="true" size={16} />
          <span>Postventa</span>
          <strong>{countText(overview?.afterSales.total)}</strong>
        </div>
        </> : null}
        {section === "comunicaciones" ? <>
        <div>
          <Mail aria-hidden="true" size={16} />
          <span>Comunicaciones</span>
          <strong>{countText(overview?.communications.total)}</strong>
        </div>
        </> : null}
      </div>
      <CustomerDataTable
        label={`Información de ${sectionTitle.toLowerCase()}`}
        columns={section === "facturacion"
          ? [{ label: "Última factura", value: valueText(overview?.invoices.items[0]?.invoiceNumber) }]
          : section === "soporte"
            ? [
              { label: "Último caso", value: valueText(overview?.afterSales.items[0]?.caseType ?? "Caso postventa") },
              { label: "Responsable", value: overview?.afterSales.items[0]?.assignedEmployeeId ? "Asignado" : "Sin asignar" },
            ]
            : [{ label: "Última comunicación", value: dateText(overview?.communications.items[0]?.createdAt) }]}
      />
      {section === "facturacion" ? <>
      <div className="customersOverviewSubsection">
        <h4>Facturas</h4>
        {invoices.length ? (
          <div className="adminTableScroller">
            <table className="adminTable pricingTable">
              <thead>
                <tr>
                  <th scope="col">Factura</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Importe</th>
                  <th scope="col">Abrir</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.invoiceId}>
                    <td>{valueText(invoice.invoiceNumber ?? invoice.invoiceId)}</td>
                    <td>{dateText(invoice.issuedAt)}</td>
                    <td><span className={statusBadgeClass(invoice.status)}>{valueText(invoice.status)}</span></td>
                    <td>{moneyText(invoice.totalAmountMinor, invoice.currency)}</td>
                    <td>
                      <Link className="adminButton adminButtonTiny" href={`/admin/pagos?invoiceId=${encodeURIComponent(invoice.invoiceId)}`}>
                        Abrir factura
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="adminEmptyState">Sin facturas recientes.</div>}
      </div>
      </> : null}
      {section === "soporte" ? <>
      <div className="customersOverviewSubsection">
        <h4>Casos</h4>
        {afterSales.length ? (
          <div className="adminTableScroller">
            <table className="adminTable pricingTable">
              <thead>
                <tr>
                  <th scope="col">Caso</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Responsable</th>
                  <th scope="col">Abrir</th>
                </tr>
              </thead>
              <tbody>
                {afterSales.map((caseItem) => (
                  <tr key={caseItem.caseId}>
                    <td>{valueText(caseItem.caseType ?? "Caso postventa")}</td>
                    <td><span className={statusBadgeClass(caseItem.status)}>{valueText(caseItem.status)}</span></td>
                    <td>{caseItem.assignedEmployeeId ? "Asignado" : "Sin asignar"}</td>
                    <td>
                      <Link className="adminButton adminButtonTiny" href={`/admin/postventa?caseId=${encodeURIComponent(caseItem.caseId)}`}>
                        Atender
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="adminEmptyState">Sin casos postventa.</div>}
      </div>
      </> : null}
      {section === "comunicaciones" ? <>
      <div className="customersOverviewSubsection">
        <h4>Historial</h4>
        {communications.length ? (
          <div className="adminTableScroller">
            <table className="adminTable pricingTable">
              <thead>
                <tr>
                  <th scope="col">Canal</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {communications.map((communication) => (
                  <tr key={communication.deliveryId}>
                    <td>{communicationChannelLabel(communication.channel)}</td>
                    <td><span className={statusBadgeClass(communication.status)}>{valueText(communication.status)}</span></td>
                    <td>{dateText(communication.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="adminEmptyState">Sin comunicaciones recientes.</div>}
      </div>
      {capabilities.canWriteCommunications ? (
      <div className="customersOverviewSubsection">
        <h4>Enviar comunicación</h4>
        <form action={sendCustomerEmailAction} className="adminFormGrid">
          <HiddenCustomerFields customer={customer} returnTo={returnTo} />
          <label className="adminField">
            <span>Plantilla</span>
            <input name="templateKey" placeholder="Plantilla de email" required />
          </label>
          <label className="adminField">
            <span>Idioma</span>
            <select defaultValue={localeValue(customer, "es-ES")} name="locale">
              <option value="es-ES">Español</option>
              <option value="en-US">English</option>
            </select>
          </label>
          <label className="adminField adminFieldFull">
            <span>Mensaje</span>
            <textarea name="message" placeholder="Añade un mensaje para el cliente" rows={3} />
          </label>
          <div className="customerUnavailableField">
            <span>Adjuntos</span>
            <strong>No disponible</strong>
          </div>
          <div className="adminButtonRow">
            <button className="adminButton adminButtonPrimary" type="submit">Enviar email</button>
          </div>
        </form>
      </div>
      ) : null}
      </> : null}
    </section>
  );
}

function TimelineOverviewPanel({
  customer,
  overview,
  limit,
  compact = false,
  source,
}: {
  customer: CustomerProfile;
  overview: CustomerOverviewData | null;
  limit?: number;
  compact?: boolean;
  source?: string;
}) {
  const events = buildCustomerAdminTimeline(overview, customer);
  const filteredEvents = source ? events.filter((event) => event.source === source) : events;
  const visibleEvents = typeof limit === "number" ? filteredEvents.slice(0, limit) : filteredEvents;

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h3>{compact ? "Actividad reciente" : "Timeline administrativo"}</h3>
          <p>{typeof limit === "number" ? `Últimos ${visibleEvents.length} eventos` : `${filteredEvents.length} eventos`}</p>
        </div>
        <Clock aria-hidden="true" size={18} />
      </div>
      {filteredEvents.length ? (
        <ol className={`customerActivityTimeline ${compact ? "customerActivityTimelineCompact" : ""}`}>
          {visibleEvents.map((event) => (
            <li key={event.eventId}>
              <div className="customerActivityTimelineMarker" aria-hidden="true" />
              <div className="customerActivityTimelineContent">
                <div>
                  <strong>{event.label}</strong>
                  {!compact ? <span>{activitySourceLabel(event.source)}</span> : null}
                </div>
                <div>
                  {event.status ? <span className={statusBadgeClass(event.status)}>{valueText(event.status)}</span> : null}
                  <time>{dateText(event.occurredAt ?? undefined)}</time>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="adminEmptyState">Sin eventos para este filtro.</div>
      )}
    </section>
  );
}

function ActivityFilters({ customer, source }: { customer: CustomerProfile; source?: string }) {
  const reference = customer.customerReference ?? customer.customerId;

  return (
    <form action={`/admin/clientes/${encodeURIComponent(reference)}`} className="customerActivityFilters">
      <input name="tab" type="hidden" value="actividad" />
      <label className="adminField">
        <span>Filtrar actividad</span>
        <select defaultValue={source ?? ""} name="activitySource">
          <option value="">Todos los eventos</option>
          <option value="purchase">Pedidos</option>
          <option value="account">Login y cuenta</option>
          <option value="communication">Emails</option>
          <option value="invoice">Pagos y facturas</option>
          <option value="after-sales">Soporte</option>
          <option value="privacy">Privacidad</option>
          <option value="customer">Perfil</option>
          <option value="overview">Sistema</option>
        </select>
      </label>
      <button className="adminButton adminButtonTiny" type="submit">Filtrar</button>
      {source ? <Link className="adminButton adminButtonTiny" href={customerDetailHref(customer, "actividad")}>Limpiar</Link> : null}
    </form>
  );
}

function ProfileFields({
  customer,
  contextLocale,
  includeEmail = false,
}: {
  customer?: CustomerProfile;
  contextLocale: string;
  includeEmail?: boolean;
}) {
  return (
    <>
      <fieldset className="adminFieldset customerProfileFieldset">
        <legend>Datos personales</legend>
        <div className="customerProfileFields">
          {includeEmail ? (
            <label className="adminField">
              <span>Email</span>
              <input name="email" type="email" defaultValue={customer?.email ?? ""} required />
            </label>
          ) : (
            <div className="customerReadOnlyField">
              <span>Email</span>
              <strong>{valueText(customer?.email)}</strong>
              <small>El contrato actual no permite modificarlo desde Administración.</small>
            </div>
          )}
          <label className="adminField">
            <span>Nombre</span>
            <input name="firstName" defaultValue={customer?.firstName ?? ""} required />
          </label>
          <label className="adminField">
            <span>Apellido</span>
            <input name="lastName" defaultValue={customer?.lastName ?? ""} required />
          </label>
          <label className="adminField">
            <span>Teléfono</span>
            <input name="phone" defaultValue={customer?.phone ?? ""} />
          </label>
          <label className="adminField">
            <span>Documento</span>
            <input name="documentNumber" defaultValue={customer?.documentNumber ?? ""} />
          </label>
        </div>
      </fieldset>
      <fieldset className="adminFieldset customerProfileFieldset">
        <legend>Preferencias del perfil</legend>
        <div className="customerProfileFields">
          <label className="adminField">
            <span>Tipo comprador</span>
            <select name="buyerType" defaultValue={buyerTypeValue(customer?.buyerType)}>
              <option value="PRIVATE_BUYER">Particular</option>
              <option value="BUSINESS_BUYER">Empresa</option>
            </select>
          </label>
          <label className="adminField">
            <span>Idioma</span>
            <input name="locale" defaultValue={localeValue(customer, contextLocale)} />
          </label>
        </div>
      </fieldset>
    </>
  );
}

function ProfileSummary({ customer }: { customer: CustomerProfile }) {
  return (
    <CustomerDataTable
      label="Datos de perfil"
      columns={[
        { label: "Email", value: valueText(customer.email) },
        { label: "Nombre", value: valueText(customer.firstName) },
        { label: "Apellido", value: valueText(customer.lastName) },
        { label: "Teléfono", value: valueText(customer.phone) },
        { label: "Documento", value: valueText(customer.documentNumber) },
        { label: "Estado", value: customerKind(customer) },
        { label: "Tipo", value: buyerTypeLabel(customer.buyerType) },
        { label: "Creado", value: dateText(customer.createdAt) },
        { label: "Actualizado", value: dateText(customer.updatedAt) },
      ]}
    />
  );
}

function AddressFields({
  address,
  contextCountry,
}: {
  address?: CustomerAddress;
  contextCountry: string;
}) {
  return (
    <>
      <label className="adminField">
        <span>Nombre de la dirección</span>
        <input name="alias" defaultValue={address?.addressName ?? address?.receiverName ?? ""} required />
      </label>
      <label className="adminField">
        <span>Receptor</span>
        <input name="receiverName" defaultValue={address?.receiverName ?? ""} required />
      </label>
      <label className="adminField">
        <span>Uso de la dirección</span>
        <select name="addressRole" defaultValue={address?.addressRole ?? "BOTH"}>
          <option value="BOTH">Envio y facturacion</option>
          <option value="SHIPPING">Solo envio</option>
          <option value="BILLING">Solo facturacion</option>
        </select>
      </label>
      <label className="adminField">
        <span>Tipo</span>
        <input name="addressType" defaultValue={address?.addressType ?? "residential"} />
      </label>
      <label className="adminField">
        <span>Calle</span>
        <input name="street" defaultValue={address?.street ?? ""} required />
      </label>
      <label className="adminField">
        <span>Numero</span>
        <input name="number" defaultValue={address?.number ?? ""} required />
      </label>
      <label className="adminField">
        <span>Complemento</span>
        <input name="complement" defaultValue={address?.complement ?? ""} />
      </label>
      <label className="adminField">
        <span>Barrio</span>
        <input name="neighborhood" defaultValue={address?.neighborhood ?? ""} />
      </label>
      <label className="adminField">
        <span>Ciudad</span>
        <input name="city" defaultValue={address?.city ?? ""} required />
      </label>
      <label className="adminField">
        <span>Provincia/estado</span>
        <input name="state" defaultValue={address?.state ?? ""} required />
      </label>
      <label className="adminField">
        <span>Pais</span>
        <input name="country" defaultValue={address?.country ?? contextCountry} required />
      </label>
      <label className="adminField">
        <span>Codigo postal</span>
        <input name="postalCode" defaultValue={address?.postalCode ?? ""} required />
      </label>
      <label className="adminField">
        <span>Referencia</span>
        <input name="reference" defaultValue={address?.reference ?? ""} />
      </label>
    </>
  );
}

function ResultBanner<T>({ result }: { result: CustomersAdminResult<T> }) {
  if (result.source === "bff") {
    return null;
  }

  return (
    <div className="adminBanner adminBannerError">
      <p>{result.message}</p>
      {result.failedEndpoint ? <p className="adminContextHint">{result.failedEndpoint}</p> : null}
    </div>
  );
}

function PermissionBanner({
  permission,
  action,
}: {
  permission: CustomersAdminPermission;
  action: string;
}) {
  return (
    <div className="adminBanner adminBannerError">
      <p>Falta permiso {permission} para {action}.</p>
    </div>
  );
}

function DrawerShell({
  title,
  closeHref,
  children,
  variant = "drawer",
  tabs,
  summary,
  avatarId,
}: {
  title: string;
  closeHref: string;
  children: ReactNode;
  variant?: "drawer" | "page";
  tabs?: ReactNode;
  summary?: ReactNode;
  avatarId?: string | null;
}) {
  if (variant === "page") {
    const avatarSrc = avatarId ? customerAvatarImagePath[avatarId] : undefined;

    return (
      <section className="customerDetailShell" aria-label={title}>
        <div className="customerDetailHeader">
          <div className="customerDetailIdentity">
            <div className="customerDetailAvatar">
              {avatarSrc ? (
                <Image alt={`Avatar de ${title}`} className="customerDetailAvatarImage" height={44} src={avatarSrc} unoptimized width={44} />
              ) : (
                <span aria-hidden="true">{title.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div>
              <Link className="adminBreadcrumb" href={closeHref}>Admin / Clientes</Link>
              <h1 className="adminPageTitle">{title}</h1>
              {summary}
            </div>
          </div>
          <Link className="adminButton" href={closeHref}>Volver a clientes</Link>
        </div>
        {tabs}
        <div className="customerDetailBody">{children}</div>
      </section>
    );
  }

  return (
    <div className="adminDrawerBackdrop customersDrawerBackdrop">
      <Link className="customersDrawerBackdropLink" href={closeHref} aria-label="Cerrar ventana lateral" />
      <aside className="adminSideDrawer customersSideDrawer" aria-label={title}>
        <div className="adminSideDrawerHeader">
          <div>
            <h2>{title}</h2>
          </div>
          <Link className="adminIconButton" href={closeHref} title="Cerrar">
            <X aria-hidden="true" size={16} />
            <span className="adminVisuallyHidden">Cerrar</span>
          </Link>
        </div>
        <div className="customersSideDrawerBody">
          {children}
        </div>
      </aside>
    </div>
  );
}

function CustomerDrawer({
  capabilities,
  data,
  filters,
  variant = "drawer",
  activeTab = "resumen",
}: {
  capabilities: CustomersAdminCapabilities;
  data: CustomersAdminData;
  filters: CustomersAdminFilters;
  variant?: "drawer" | "page";
  activeTab?: CustomerDetailTab;
}) {
  const closeHref = customersHref(filters, { drawer: undefined, customerId: undefined });

  if (filters.drawer === "create") {
    return (
      <DrawerShell title="Crear cliente" closeHref={closeHref}>
        {capabilities.canWriteCustomers ? (
          <form action={createCustomerAction} className="adminFormGrid">
            <ProfileFields contextLocale={data.context.locale} includeEmail />
            <div className="adminButtonRow">
              <button className="adminButton adminButtonPrimary" type="submit">
                <Save aria-hidden="true" size={16} />
                Crear cliente
              </button>
              <Link className="adminButton" href={closeHref}>Cancelar</Link>
            </div>
          </form>
        ) : (
          <PermissionBanner permission="customers.addresses.write" action="crear clientes" />
        )}
      </DrawerShell>
    );
  }

  if (variant === "drawer" && filters.drawer !== "detail") {
    return null;
  }

  const customer = data.selectedCustomer.data;
  const latest = customer ? latestPurchase(data.purchases.data?.items) : undefined;
  const account = data.overview.data?.account;
  const returnTo = customer && variant === "page" ? customerDetailHref(customer, activeTab) : undefined;
  const summary = customer ? (
    <div className="customerDetailMeta">
      <span>{buyerTypeLabel(customer.buyerType)}</span>
      <span>{customerKind(customer)}</span>
      <span>{accountStatusLabel(accountStatusValue(account))}</span>
      <span>{countText(data.purchases.data?.total)} pedidos</span>
      <span>LTV —</span>
      <span>Última compra {dateText(latest?.placedAt ?? latest?.recordedAt)}</span>
      <span>Newsletter {customer.clientPreferencesData?.optinNewsLetter ? "Sí" : "No"}</span>
      <span>{localeValue(customer, data.context.locale)}</span>
    </div>
  ) : null;
  const tabs = customer ? (
    <nav className="customerDetailTabs" aria-label="Secciones del cliente">
      {customerDetailTabs.map((tab) => (
        <Link
          aria-current={tab.id === activeTab ? "page" : undefined}
          className={tab.id === activeTab ? "customerDetailTab customerDetailTabActive" : "customerDetailTab"}
          href={customerDetailHref(customer, tab.id)}
          key={tab.id}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  ) : null;

  return (
    <DrawerShell
      closeHref={closeHref}
      summary={summary}
      tabs={tabs}
      title={customer ? fullName(customer) : "Detalle de cliente"}
      avatarId={customer?.avatarId}
      variant={variant}
    >
      <ResultBanner result={data.selectedCustomer} />
      {!customer ? (
        <div className="adminEmptyState">Selecciona un cliente del listado.</div>
      ) : (
        <div className="adminStack">
          <ResultBanner result={data.overview} />
          {activeTab === "resumen" ? <>
          <CustomerSummaryPanel
            canReadPurchases={capabilities.canReadPurchases}
            customer={customer}
            data={data}
          />
          <TimelineOverviewPanel customer={customer} overview={data.overview.data} compact limit={10} />
          </> : null}
          {activeTab === "cuenta" ? (
            <AccountOverviewPanel
              capabilities={capabilities}
              customer={customer}
              overview={data.overview.data}
              returnTo={returnTo}
            />
          ) : null}
          {activeTab === "facturacion" || activeTab === "comunicaciones" || activeTab === "soporte" ? (
            <ContinuityOverviewPanel
              capabilities={capabilities}
              customer={customer}
              overview={data.overview.data}
              returnTo={returnTo}
              section={activeTab}
            />
          ) : null}
          {activeTab === "privacidad" || activeTab === "backoffice" ? (
            <OperationalOverviewPanel
              capabilities={capabilities}
              customer={customer}
              overview={data.overview.data}
              returnTo={returnTo}
              section={activeTab}
            />
          ) : null}
          {activeTab === "actividad" ? <>
            <ActivityFilters customer={customer} source={filters.activitySource} />
            <TimelineOverviewPanel customer={customer} overview={data.overview.data} source={filters.activitySource} />
          </> : null}

          {activeTab === "perfil" ? <>
          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <div>
                <h3>Perfil</h3>
                <p>{customer.customerReference ?? "Referencia no disponible"}</p>
              </div>
            </div>
            {capabilities.canWriteCustomers ? (
              <form action={updateCustomerProfileAction} className="adminFormGrid">
                <input name="customerId" type="hidden" value={customer.customerId} />
                {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
                <ProfileFields customer={customer} contextLocale={data.context.locale} />
                <CustomerDataTable
                  fullWidth
                  label="Estado del perfil"
                  columns={[
                    { label: "Estado", value: customerKind(customer) },
                    { label: "Tipo", value: buyerTypeLabel(customer.buyerType) },
                    { label: "Creado", value: dateText(customer.createdAt) },
                    { label: "Actualizado", value: dateText(customer.updatedAt) },
                  ]}
                />
                <div className="adminButtonRow customerProfileActions">
                  <button className="adminButton adminButtonPrimary" type="submit">
                    <Save aria-hidden="true" size={16} />
                    Guardar perfil
                  </button>
                  <Link className="adminButton" href={returnTo ?? closeHref}>Cancelar</Link>
                </div>
              </form>
            ) : (
              <>
                <PermissionBanner permission="customers.addresses.write" action="editar perfiles" />
                <ProfileSummary customer={customer} />
              </>
            )}
          </section>

          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <div>
                <h3>Direcciones</h3>
                <p>{data.addresses.data?.items.length ?? 0} registros</p>
              </div>
              {capabilities.canWriteCustomers ? (
                <Link
                  className="adminButton adminButtonTiny"
                  href={variant === "page"
                    ? customerDetailHref(customer, "perfil", { addressMode: "create" })
                    : customersHref(filters, {
                      drawer: "detail",
                      customerId: customer.customerId,
                      addressMode: "create",
                      addressId: undefined,
                    })}
                >
                  <Plus aria-hidden="true" size={14} />
                  Agregar
                </Link>
              ) : null}
            </div>
            <ResultBanner result={data.addresses} />
            {filters.addressMode && !capabilities.canWriteCustomers ? (
              <PermissionBanner permission="customers.addresses.write" action="modificar direcciones" />
            ) : null}
            {filters.addressMode && capabilities.canWriteCustomers ? (
              <form
                action={filters.addressMode === "edit" ? updateCustomerAddressAction : createCustomerAddressAction}
                className="adminFormGrid"
              >
                <input name="customerId" type="hidden" value={customer.customerId} />
                {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
                {filters.addressMode === "edit" ? (
                  <input name="addressId" type="hidden" value={filters.addressId ?? ""} />
                ) : null}
                <AddressFields
                  address={data.addresses.data?.items.find((address) => address.addressId === filters.addressId)}
                  contextCountry={data.context.country}
                />
                <div className="adminButtonRow">
                  <button className="adminButton adminButtonPrimary" type="submit">
                    <Save aria-hidden="true" size={16} />
                    {filters.addressMode === "edit" ? "Guardar direccion" : "Crear direccion"}
                  </button>
                  <Link
                    className="adminButton"
                    href={variant === "page" ? customerDetailHref(customer, "perfil") : customersHref(filters, { addressMode: undefined, addressId: undefined })}
                  >
                    Cancelar
                  </Link>
                </div>
              </form>
            ) : null}
            {data.addresses.data?.items.length ? (
              <div className="adminTableScroller">
                <table className="adminTable pricingTable">
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Uso</th>
                      <th scope="col">Direccion</th>
                      <th scope="col">Ciudad</th>
                      <th scope="col">Postal</th>
                      <th scope="col">Defaults</th>
                      {capabilities.canWriteCustomers ? <th scope="col">Acciones</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {data.addresses.data.items.map((address) => (
                      <tr key={address.addressId}>
                        <td>
                          <strong>{addressLabel(address)}</strong>
                        </td>
                        <td>{addressRoleLabel(address.addressRole)}</td>
                        <td>{addressLine(address)}</td>
                        <td>{valueText(address.city)}</td>
                        <td>{valueText(address.postalCode)}</td>
                        <td>
                          <div className="adminButtonRow">
                            {address.addressId === data.addresses.data?.defaultShippingAddressId ? (
                              <span className="adminBadge adminBadgeOk">Envio</span>
                            ) : null}
                            {address.addressId === data.addresses.data?.defaultBillingAddressId ? (
                              <span className="adminBadge adminBadgeOk">Fiscal</span>
                            ) : null}
                            {address.addressId !== data.addresses.data?.defaultShippingAddressId &&
                            address.addressId !== data.addresses.data?.defaultBillingAddressId ? "-" : null}
                          </div>
                        </td>
                        {capabilities.canWriteCustomers ? (
                          <td>
                            <div className="adminButtonRow">
                              <Link
                                className="adminIconButton"
                                href={variant === "page"
                                  ? customerDetailHref(customer, "perfil", { addressMode: "edit", addressId: address.addressId })
                                  : customersHref(filters, {
                                    drawer: "detail",
                                    customerId: customer.customerId,
                                    addressMode: "edit",
                                    addressId: address.addressId,
                                  })}
                                title={`Editar ${addressLabel(address)}`}
                              >
                                <Edit3 aria-hidden="true" size={16} />
                                <span className="adminVisuallyHidden">Editar {addressLabel(address)}</span>
                              </Link>
                              <form action={setDefaultShippingAddressAction}>
                                <input name="customerId" type="hidden" value={customer.customerId} />
                                <input name="addressId" type="hidden" value={address.addressId} />
                                {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
                                <button className="adminIconButton" type="submit" title="Usar como envio">
                                  <Home aria-hidden="true" size={16} />
                                  <span className="adminVisuallyHidden">Usar como envio</span>
                                </button>
                              </form>
                              <form action={setDefaultBillingAddressAction}>
                                <input name="customerId" type="hidden" value={customer.customerId} />
                                <input name="addressId" type="hidden" value={address.addressId} />
                                {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
                                <button className="adminIconButton" type="submit" title="Usar como fiscal">
                                  <Star aria-hidden="true" size={16} />
                                  <span className="adminVisuallyHidden">Usar como fiscal</span>
                                </button>
                              </form>
                              <details className="productDangerMenu">
                                <summary className="adminIconButton adminIconButtonDanger" title="Eliminar direccion">
                                  <Trash2 aria-hidden="true" size={16} />
                                  <span className="adminVisuallyHidden">Eliminar direccion</span>
                                </summary>
                                <div className="productDangerPanel">
                                  <strong>Eliminar direccion</strong>
                                  <p>La libreta del cliente dejara de mostrar esta direccion.</p>
                                  <form action={deleteCustomerAddressAction}>
                                    <input name="customerId" type="hidden" value={customer.customerId} />
                                    <input name="addressId" type="hidden" value={address.addressId} />
                                    {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
                                    <button className="adminButton adminButtonDanger" type="submit">Confirmar</button>
                                  </form>
                                </div>
                              </details>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="adminEmptyState">Sin direcciones registradas.</div>
            )}
          </section>
          </> : null}

          {activeTab === "compras" ? <>
          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <div>
                <h3>Compras</h3>
                <p>{data.purchases.data?.total ?? 0} registros</p>
              </div>
            </div>
            {!capabilities.canReadPurchases ? (
              <PermissionBanner permission="customers.purchases.read" action="consultar compras" />
            ) : null}
            {capabilities.canReadPurchases ? <ResultBanner result={data.purchases} /> : null}
            {capabilities.canReadPurchases ? <PurchasesKpiPanel purchases={data.purchases.data} /> : null}
            {capabilities.canReadPurchases && data.purchases.data?.items.length ? (
              <>
                <div className="adminTableScroller">
                  <table className="adminTable pricingTable">
                    <thead>
                      <tr>
                        <th scope="col">Pedido</th>
                        <th scope="col">Fecha</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Importe</th>
                        <th scope="col">Pago</th>
                        <th scope="col">Envío</th>
                        <th scope="col">Abrir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.purchases.data.items.map((purchase) => {
                        const orderReference = purchase.orderId ?? purchase.purchaseId;
                        return (
                          <tr key={purchase.purchaseId}>
                            <td>
                              <strong>{valueText(purchase.orderId ?? purchase.purchaseId)}</strong>
                              <div className="adminContextHint">{purchase.itemsCount ?? purchase.items?.length ?? 0} items</div>
                            </td>
                            <td>{dateText(purchase.placedAt ?? purchase.recordedAt)}</td>
                            <td>
                              <span className={`adminBadge ${purchase.isPaid ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                                {valueText(purchase.status)}
                              </span>
                            </td>
                            <td>{moneyText(purchase.totalAmountMinor, purchase.currency)}</td>
                            <td>{purchase.isPaid === undefined ? "No disponible" : purchase.isPaid ? "Pagado" : "Pendiente"}</td>
                            <td>No disponible</td>
                            <td>
                              <Link className="adminButton adminButtonTiny" href={`/admin/pedidos?orderId=${encodeURIComponent(orderReference)}`}>
                                Abrir pedido
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="productListPagination">
                  <Link
                    aria-disabled={data.purchases.data.offset === 0}
                    className={`adminButton ${data.purchases.data.offset === 0 ? "adminButtonDisabled" : ""}`}
                    href={variant === "page"
                      ? customerDetailHref(customer, "compras", {
                        purchasesLimit: String(data.purchases.data.limit),
                        purchasesOffset: String(Math.max(0, data.purchases.data.offset - data.purchases.data.limit)),
                      })
                      : purchasePageHref(
                        filters,
                        data.purchases.data.offset - data.purchases.data.limit,
                        data.purchases.data.limit,
                      )}
                  >
                    Anterior
                  </Link>
                  <span>
                    {data.purchases.data.offset + 1}-{Math.min(data.purchases.data.offset + data.purchases.data.limit, data.purchases.data.total)} de {data.purchases.data.total}
                  </span>
                  <Link
                    aria-disabled={data.purchases.data.offset + data.purchases.data.limit >= data.purchases.data.total}
                    className={`adminButton ${data.purchases.data.offset + data.purchases.data.limit >= data.purchases.data.total ? "adminButtonDisabled" : ""}`}
                    href={variant === "page"
                      ? customerDetailHref(customer, "compras", {
                        purchasesLimit: String(data.purchases.data.limit),
                        purchasesOffset: String(data.purchases.data.offset + data.purchases.data.limit),
                      })
                      : purchasePageHref(
                        filters,
                        data.purchases.data.offset + data.purchases.data.limit,
                        data.purchases.data.limit,
                      )}
                  >
                    Siguiente
                  </Link>
                </div>
              </>
            ) : capabilities.canReadPurchases ? (
              <div className="adminEmptyState">Sin compras materializadas.</div>
            ) : null}
          </section>
          </> : null}
        </div>
      )}
    </DrawerShell>
  );
}

function CustomersTable({ data }: Pick<CustomersAdminPageProps, "data">) {
  const customers = data.list.data.items;

  if (!customers.length) {
    return (
      <div className="adminEmptyState">
        <UserRound aria-hidden="true" size={28} />
        <p>No hay clientes para el filtro actual.</p>
      </div>
    );
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th scope="col">Cliente</th>
            <th scope="col">Email</th>
            <th scope="col">Telefono</th>
            <th scope="col">Segmento</th>
            <th scope="col">Estado</th>
            <th scope="col">Defaults</th>
            <th scope="col">Creado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.customerId}>
              <td>
                <strong>{fullName(customer)}</strong>
                <div className="adminContextHint">{customer.customerReference ?? "Referencia no disponible"}</div>
              </td>
              <td>
                <a href={`mailto:${customer.email}`}>{valueText(customer.email)}</a>
              </td>
              <td>{valueText(customer.phone)}</td>
              <td>{valueText(customer.buyerType)}</td>
              <td>
                <span className={customerKindBadge(customer)}>{customerKind(customer)}</span>
              </td>
              <td>{customerAddressSummary(customer)}</td>
              <td>{dateText(customer.createdAt)}</td>
              <td>
                <Link
                  className="adminIconButton"
                  href={customerDetailHref(customer)}
                  title={`Ver ${fullName(customer)}`}
                >
                  <Eye aria-hidden="true" size={16} />
                  <span className="adminVisuallyHidden">Ver {fullName(customer)}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CustomersAdminPage({ capabilities, data, filters }: CustomersAdminPageProps) {
  const offset = data.list.data.offset;
  const limit = data.list.data.limit || 100;
  const total = data.list.data.total;
  const nextOffset = offset + limit;
  const previousOffset = Math.max(0, offset - limit);
  const firstItem = total === 0 ? 0 : offset + 1;
  const lastItem = Math.min(nextOffset, total);
  const summary = currentPageSummary(data.list.data.items);
  const hasCustomerFilters = Boolean(filters.q?.trim() || filters.email?.trim());

  return (
    <main className="adminPage customersAdminPage">
      <div className="adminBreadcrumb">Admin / Clientes</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Clientes</h1>
          <p className="adminPageIntro">Vista 360 de clientes</p>
        </div>
        {capabilities.canWriteCustomers ? (
          <Link className="adminButton adminButtonPrimary" href={customersHref(filters, { drawer: "create", customerId: undefined })}>
            <Plus aria-hidden="true" size={16} />
            Crear cliente
          </Link>
        ) : null}
      </div>

      {filters.customerMessage ? (
        <div className="adminBanner adminBannerInfo">
          <p>{filters.customerMessage}</p>
        </div>
      ) : null}

      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>{hasCustomerFilters ? "Clientes filtrados" : "Todos los clientes"}</h2>
            <p>{total} clientes</p>
          </div>
          <span className="adminBadge">{data.context.organizationId || "Sin organization"} / {data.context.shopId || "Sin shop"}</span>
        </div>
        <div className="adminSummaryGrid">
          <div>
            <UserCheck aria-hidden="true" size={16} />
            <span>Registrados</span>
            <strong>{summary.registered}</strong>
          </div>
          <div>
            <UserRound aria-hidden="true" size={16} />
            <span>Guest</span>
            <strong>{summary.guests}</strong>
          </div>
          <div>
            <Mail aria-hidden="true" size={16} />
            <span>Newsletter</span>
            <strong>{summary.newsletter}</strong>
          </div>
        </div>
        <form className="customersFilterBar" action={applyCustomersFiltersAction}>
          <label className="adminField">
            <span>Buscar</span>
            <input name="q" defaultValue={filters.q ?? ""} />
          </label>
          <label className="adminField">
            <span>Email</span>
            <input name="email" defaultValue={filters.email ?? ""} type="email" />
          </label>
          <label className="adminField">
            <span>Limite</span>
            <select name="limit" defaultValue={String(limit)}>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">
            <Search aria-hidden="true" size={16} />
            Aplicar
          </button>
          <Link className="adminButton" href="/admin/clientes">Todos los clientes</Link>
        </form>
        <ResultBanner result={data.list} />
        <CustomersTable data={data} />
        <nav className="productListPagination" aria-label="Paginacion de clientes">
          <p>{firstItem}-{lastItem} de {total}</p>
          <div className="productListPaginationControls">
            <Link
              className={`adminButton ${offset === 0 ? "adminButtonDisabled" : ""}`}
              href={customersHref(filters, { offset: String(previousOffset), limit: String(limit) })}
              aria-disabled={offset === 0}
            >
              Anterior
            </Link>
            <Link
              className={`adminButton ${nextOffset >= total ? "adminButtonDisabled" : ""}`}
              href={customersHref(filters, { offset: String(nextOffset), limit: String(limit) })}
              aria-disabled={nextOffset >= total}
            >
              Siguiente
            </Link>
          </div>
        </nav>
      </section>

      <CustomerDrawer capabilities={capabilities} data={data} filters={filters} />
    </main>
  );
}

export function CustomerDetailPage({
  activeTab,
  capabilities,
  data,
  filters,
}: CustomersAdminPageProps & { activeTab: CustomerDetailTab }) {
  return (
    <main className="adminPage customersAdminPage">
      <CustomerDrawer
        activeTab={activeTab}
        capabilities={capabilities}
        data={data}
        filters={filters}
        variant="page"
      />
    </main>
  );
}
