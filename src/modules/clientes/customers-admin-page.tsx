import Link from "next/link";
import {
  AlertTriangle,
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
  RotateCcw,
  UserCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  CustomerAddress,
  CustomerOverviewData,
  CustomerProfile,
  CustomerPurchase,
  CustomerPurchaseItem,
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
  testResetCustomerAction,
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

function customersHref(filters: CustomersAdminFilters, patch: Partial<CustomersAdminFilters>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...patch };

  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  }

  return `/admin/clientes${params.size ? `?${params.toString()}` : ""}`;
}

function fullName(customer: CustomerProfile) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email || customer.customerId;
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

function purchaseHref(item: CustomerPurchaseItem) {
  if (item.productUrlPath) {
    return item.productUrlPath;
  }
  if (item.productSlug) {
    return `/pdp/${encodeURIComponent(item.productSlug)}`;
  }

  return undefined;
}

function purchaseItemsSummary(purchase: CustomerPurchase) {
  const items = purchase.items ?? [];
  if (!items.length) {
    return "-";
  }

  return items
    .slice(0, 2)
    .map((item) => `${item.quantity ?? 1}x ${item.name ?? item.productId ?? "Producto"}`)
    .join(", ");
}

function primaryPurchaseItem(purchase: CustomerPurchase) {
  return purchase.items?.find((item) => purchaseHref(item)) ?? purchase.items?.[0];
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

function compactId(value: string | undefined) {
  if (!value) {
    return "-";
  }

  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
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
  const addressCount = data.addresses.data?.items.length ?? 0;
  const purchasesCount = canReadPurchases ? data.purchases.data?.total ?? 0 : "-";
  const newsletter = customer.clientPreferencesData?.optinNewsLetter ?? false;

  return (
    <>
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h3>Resumen 360</h3>
            <p>{customer.customerId}</p>
          </div>
          <span className={customerKindBadge(customer)}>{customerKind(customer)}</span>
        </div>
        <div className="adminSummaryGrid">
          <div>
            <UserCheck aria-hidden="true" size={16} />
            <span>Cliente</span>
            <strong>{buyerTypeLabel(customer.buyerType)}</strong>
          </div>
          <div>
            <Home aria-hidden="true" size={16} />
            <span>Direcciones</span>
            <strong>{addressCount}</strong>
          </div>
          <div>
            <Mail aria-hidden="true" size={16} />
            <span>Newsletter</span>
            <strong>{valueText(newsletter)}</strong>
          </div>
          <div>
            <UserRound aria-hidden="true" size={16} />
            <span>Compras</span>
            <strong>{purchasesCount}</strong>
          </div>
        </div>
        <dl className="adminDefinitionList">
          <div><dt>Email</dt><dd>{valueText(customer.email)}</dd></div>
          <div><dt>Defaults</dt><dd>{customerAddressSummary(customer)}</dd></div>
          <div><dt>Ultima compra</dt><dd>{dateText(lastPurchase?.placedAt ?? lastPurchase?.recordedAt)}</dd></div>
          <div><dt>Importe ultima compra</dt><dd>{moneyText(lastPurchase?.totalAmountMinor, lastPurchase?.currency)}</dd></div>
        </dl>
      </section>

      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h3>Consentimientos</h3>
            <p>{localeValue(customer, data.context.locale)}</p>
          </div>
        </div>
        <dl className="adminDefinitionList">
          <div><dt>Newsletter</dt><dd>{valueText(newsletter)}</dd></div>
          <div><dt>Locale</dt><dd>{localeValue(customer, data.context.locale)}</dd></div>
          <div><dt>Email</dt><dd>{valueText(customer.email)}</dd></div>
          <div><dt>Actualizado</dt><dd>{dateText(customer.updatedAt)}</dd></div>
        </dl>
      </section>
    </>
  );
}

function OverviewWarningsPanel({ overview }: { overview: CustomerOverviewData | null }) {
  const warnings = overview?.warnings ?? [];
  if (!warnings.length) {
    return null;
  }

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h3>Secciones degradadas</h3>
          <p>{warnings.length} avisos</p>
        </div>
        <AlertTriangle aria-hidden="true" size={18} />
      </div>
      <div className="adminStack adminStackCompact">
        {warnings.map((warning, index) => (
          <div className="adminBanner adminBannerWarning" key={`${warning.section}-${index}`}>
            <p><strong>{valueText(warning.section)}</strong>: {warning.message ?? "No se pudo cargar la seccion."}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HiddenCustomerFields({ customer }: { customer: CustomerProfile }) {
  return <input name="customerId" type="hidden" value={customer.customerId} />;
}

function AccountOverviewPanel({
  capabilities,
  customer,
  overview,
}: {
  capabilities: CustomersAdminCapabilities;
  customer: CustomerProfile;
  overview: CustomerOverviewData | null;
}) {
  const account = overview?.account;
  const accountStatus = accountStatusValue(account);
  const activation = account?.activation;
  const nextActive = account?.active === false;

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h3>Gestion de acceso</h3>
          <p>{account ? account.email : "Sin cuenta asociada"}</p>
        </div>
        <span className={accountStatusBadgeClass(accountStatus)}>
          {accountStatusLabel(accountStatus)}
        </span>
      </div>
      <dl className="adminDefinitionList">
        <div><dt>Estado cuenta</dt><dd>{accountStatusLabel(accountStatus)}</dd></div>
        <div><dt>Estado activacion</dt><dd>{valueText(activation?.tokenStatus)}</dd></div>
        <div><dt>Vence activacion</dt><dd>{dateText(activation?.expiresAt)}</dd></div>
        <div><dt>Ultimo email</dt><dd>{valueText(activation?.emailDeliveryStatus)}</dd></div>
        <div><dt>Intentos</dt><dd>{valueText(activation?.reminderCount)}</dd></div>
        <div><dt>Error email</dt><dd>{valueText(activation?.lastEmailError)}</dd></div>
        <div><dt>Principal</dt><dd>{compactId(account?.principalId)}</dd></div>
        <div><dt>Tipo</dt><dd>{valueText(account?.principalType)}</dd></div>
        <div><dt>Creada</dt><dd>{dateText(account?.createdAt)}</dd></div>
        <div><dt>Actualizada</dt><dd>{dateText(account?.updatedAt)}</dd></div>
      </dl>
      {capabilities.canManageAccount ? (
        <div className="customersActionGrid">
          {account ? (
            <form action={setCustomerAccountActivationAction} className="customersAccessAction">
              <HiddenCustomerFields customer={customer} />
              <input name="active" type="hidden" value={nextActive ? "true" : "false"} />
              <input name="reason" placeholder="Motivo" />
              <button className="adminButton adminButtonTiny" type="submit">
                {accountActivationActionLabel(accountStatus, nextActive)}
              </button>
            </form>
          ) : null}
          {account && accountStatus !== "ACTIVE" ? (
            <form action={resendCustomerActivationAction} className="customersInlineAction">
              <HiddenCustomerFields customer={customer} />
              <input name="locale" type="hidden" value={localeValue(customer, "es-ES")} />
              <input name="reason" type="hidden" value="Reenvio manual de activacion desde Customer 360" />
              <button className="adminButton adminButtonTiny" type="submit">Reenviar activacion</button>
            </form>
          ) : null}
          {account ? (
            <form action={requestCustomerPasswordResetAction} className="customersInlineAction">
              <HiddenCustomerFields customer={customer} />
              <input name="locale" type="hidden" value={localeValue(customer, "es-ES")} />
              <input name="reason" type="hidden" value="Solicitud manual de reset desde Customer 360" />
              <button className="adminButton adminButtonTiny" type="submit">Solicitar reset</button>
            </form>
          ) : null}
        </div>
      ) : null}
      {capabilities.canWritePrivacy ? (
        <form action={testResetCustomerAction} className="customersFixtureReset">
          <HiddenCustomerFields customer={customer} />
          <input
            aria-label="Confirmar email para reset de fixture"
            name="confirmEmail"
            placeholder={customer.email}
            required
            type="email"
          />
          <button className="adminButton adminButtonTiny adminButtonDanger" type="submit">
            <RotateCcw aria-hidden="true" size={14} />
            Reset fixture
          </button>
        </form>
      ) : null}
    </section>
  );
}

function DuplicateCandidatesPanel({ overview }: { overview: CustomerOverviewData | null }) {
  const candidates = overview?.duplicateCandidates.items ?? [];

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h3>Posibles duplicados</h3>
          <p>{countText(overview?.duplicateCandidates.total)} candidatos</p>
        </div>
        <UsersRound aria-hidden="true" size={18} />
      </div>
      {candidates.length ? (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Email</th>
                <th scope="col">Coincidencias</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.customer.customerId}>
                  <td>
                    <strong>{fullName(candidate.customer)}</strong>
                    <div className="adminContextHint">{candidate.customer.customerId}</div>
                  </td>
                  <td>{valueText(candidate.customer.email)}</td>
                  <td>{candidate.matchFields.join(", ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adminEmptyState">Sin candidatos duplicados.</div>
      )}
    </section>
  );
}

function OperationalOverviewPanel({
  capabilities,
  customer,
  overview,
}: {
  capabilities: CustomersAdminCapabilities;
  customer: CustomerProfile;
  overview: CustomerOverviewData | null;
}) {
  const consents = overview?.consents?.current?.marketingEmail;
  const tags = overview?.tags.items ?? [];
  const notes = overview?.notes.items ?? [];
  const tasks = overview?.tasks.items ?? [];
  const privacyRequests = overview?.privacyRequests.items ?? [];
  const sessions = overview?.sessions?.items ?? [];
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
          <h3>Operacion interna</h3>
          <p>Seguimiento de backoffice</p>
        </div>
        <ClipboardList aria-hidden="true" size={18} />
      </div>
      <div className="adminSummaryGrid">
        <div>
          <MessageSquare aria-hidden="true" size={16} />
          <span>Notas</span>
          <strong>{countText(overview?.notes.total)}</strong>
        </div>
        <div>
          <Tag aria-hidden="true" size={16} />
          <span>Tags</span>
          <strong>{countText(overview?.tags.total)}</strong>
        </div>
        <div>
          <ClipboardList aria-hidden="true" size={16} />
          <span>Tareas</span>
          <strong>{countText(overview?.tasks.total)}</strong>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" size={16} />
          <span>Privacidad</span>
          <strong>{countText(overview?.privacyRequests.total)}</strong>
        </div>
      </div>
      <dl className="adminDefinitionList">
        <div><dt>Consentimiento email</dt><dd>{valueText(consents?.granted)}</dd></div>
        <div><dt>Origen consentimiento</dt><dd>{valueText(consents?.source)}</dd></div>
        <div><dt>Sesiones activas</dt><dd>{overview?.sessions ? countText(overview.sessions.total) : "-"}</dd></div>
        <div><dt>Ultima tarea</dt><dd>{valueText(overview?.tasks.items[0]?.title)}</dd></div>
      </dl>
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
            <HiddenCustomerFields customer={customer} />
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
            <HiddenCustomerFields customer={customer} />
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
                <span>{valueText(task.assignedEmployeeId)}</span>
              </div>
              <span className={statusBadgeClass(task.status)}>{valueText(task.status)}</span>
              {capabilities.canWriteTasks && task.status !== "DONE" ? (
                <form action={updateCustomerTaskStatusAction} className="customersInlineAction">
                  <HiddenCustomerFields customer={customer} />
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
            <HiddenCustomerFields customer={customer} />
            <input name="title" placeholder="Nueva tarea" required />
            <input name="assignedEmployeeId" placeholder="employeeId responsable" />
            <button className="adminButton adminButtonTiny" type="submit">Crear tarea</button>
          </form>
        ) : null}
      </div>
      <div className="customersOverviewSubsection">
        <h4>Privacidad y sesiones</h4>
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
                  <HiddenCustomerFields customer={customer} />
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
            <HiddenCustomerFields customer={customer} />
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
            <HiddenCustomerFields customer={customer} />
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
        <OverviewMiniList
          emptyLabel="Sin sesiones activas."
          items={sessions}
          renderItem={(session) => (
            <>
              <div>
                <strong>{valueText(session.device?.deviceName ?? session.sessionId)}</strong>
                <span>{valueText(session.device?.ipAddress)}</span>
              </div>
              <small>{dateText(session.lastSeenAt ?? session.createdAt)}</small>
            </>
          )}
        />
        <div className="customersActionGrid">
          {capabilities.canWriteConsents ? (
            <form action={recordCustomerConsentAction} className="customersInlineAction">
              <HiddenCustomerFields customer={customer} />
              <input name="granted" type="hidden" value={consents?.granted ? "false" : "true"} />
              <input name="reason" type="hidden" value="Cambio manual desde Customer 360" />
              <button className="adminButton adminButtonTiny" type="submit">
                {consents?.granted ? "Revocar marketing" : "Conceder marketing"}
              </button>
            </form>
          ) : null}
          {capabilities.canWriteSessions && sessions.length ? (
            <form action={revokeCustomerSessionsAction} className="customersAccessAction">
              <HiddenCustomerFields customer={customer} />
              <input name="reason" placeholder="Motivo" />
              <button className="adminButton adminButtonTiny adminButtonDanger" type="submit">Revocar sesiones</button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ContinuityOverviewPanel({
  capabilities,
  customer,
  overview,
}: {
  capabilities: CustomersAdminCapabilities;
  customer: CustomerProfile;
  overview: CustomerOverviewData | null;
}) {
  const invoices = overview?.invoices.items ?? [];
  const afterSales = overview?.afterSales.items ?? [];
  const communications = overview?.communications.items ?? [];

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h3>Continuidad comercial</h3>
          <p>Facturas, soporte y comunicaciones</p>
        </div>
        <FileText aria-hidden="true" size={18} />
      </div>
      <div className="adminSummaryGrid">
        <div>
          <FileText aria-hidden="true" size={16} />
          <span>Facturas</span>
          <strong>{countText(overview?.invoices.total)}</strong>
        </div>
        <div>
          <LifeBuoy aria-hidden="true" size={16} />
          <span>Postventa</span>
          <strong>{countText(overview?.afterSales.total)}</strong>
        </div>
        <div>
          <Mail aria-hidden="true" size={16} />
          <span>Comunicaciones</span>
          <strong>{countText(overview?.communications.total)}</strong>
        </div>
        <div>
          <Clock aria-hidden="true" size={16} />
          <span>Timeline</span>
          <strong>{countText(overview?.timeline.total)}</strong>
        </div>
      </div>
      <dl className="adminDefinitionList">
        <div><dt>Ultima factura</dt><dd>{valueText(overview?.invoices.items[0]?.invoiceNumber ?? overview?.invoices.items[0]?.invoiceId)}</dd></div>
        <div><dt>Ultimo caso</dt><dd>{valueText(overview?.afterSales.items[0]?.caseId)}</dd></div>
        <div><dt>Responsable caso</dt><dd>{valueText(overview?.afterSales.items[0]?.assignedEmployeeId)}</dd></div>
        <div><dt>Ultima comunicacion</dt><dd>{valueText(overview?.communications.items[0]?.templateKey)}</dd></div>
      </dl>
      <div className="customersOverviewSubsection">
        <h4>Facturas recientes</h4>
        <OverviewMiniList
          emptyLabel="Sin facturas recientes."
          items={invoices}
          renderItem={(invoice) => (
            <>
              <div>
                <strong>{valueText(invoice.invoiceNumber ?? invoice.invoiceId)}</strong>
                <span>{moneyText(invoice.totalAmountMinor, invoice.currency)}</span>
              </div>
              <div className="customersOverviewListMeta">
                <span className={statusBadgeClass(invoice.status)}>{valueText(invoice.status)}</span>
                <Link className="adminButton adminButtonTiny" href={`/admin/pagos?invoiceId=${encodeURIComponent(invoice.invoiceId)}`}>
                  Abrir factura
                </Link>
              </div>
            </>
          )}
        />
      </div>
      <div className="customersOverviewSubsection">
        <h4>Postventa y soporte</h4>
        <OverviewMiniList
          emptyLabel="Sin casos postventa."
          items={afterSales}
          renderItem={(caseItem) => (
            <>
              <div>
                <strong>{valueText(caseItem.caseId)}</strong>
                <span>{valueText(caseItem.caseType ?? caseItem.orderId)}</span>
              </div>
              <div className="customersOverviewListMeta">
                <span className={statusBadgeClass(caseItem.status)}>{valueText(caseItem.status)}</span>
                <small>{valueText(caseItem.assignedEmployeeId)}</small>
                <Link className="adminButton adminButtonTiny" href={`/admin/postventa?caseId=${encodeURIComponent(caseItem.caseId)}`}>
                  Atender
                </Link>
              </div>
            </>
          )}
        />
      </div>
      <div className="customersOverviewSubsection">
        <h4>Comunicaciones recientes</h4>
        <OverviewMiniList
          emptyLabel="Sin comunicaciones recientes."
          items={communications}
          renderItem={(communication) => (
            <>
              <div>
                <strong>{valueText(communication.templateKey ?? communication.deliveryId)}</strong>
                <span>{valueText(communication.channel)}</span>
              </div>
              <span className={statusBadgeClass(communication.status)}>{valueText(communication.status)}</span>
            </>
          )}
        />
        {capabilities.canWriteCommunications ? (
          <form action={sendCustomerEmailAction} className="customersInlineForm">
            <HiddenCustomerFields customer={customer} />
            <input name="templateKey" placeholder="template.key" required />
            <input name="locale" defaultValue={localeValue(customer, "es-ES")} />
            <textarea name="message" placeholder="Mensaje operativo" rows={2} />
            <button className="adminButton adminButtonTiny" type="submit">Enviar email</button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

function TimelineOverviewPanel({
  customer,
  overview,
}: {
  customer: CustomerProfile;
  overview: CustomerOverviewData | null;
}) {
  const events = buildCustomerAdminTimeline(overview, customer);

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h3>Timeline administrativo</h3>
          <p>{events.length} eventos derivados del Customer 360</p>
        </div>
        <Clock aria-hidden="true" size={18} />
      </div>
      {events.length ? (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable">
            <thead>
              <tr>
                <th scope="col">Evento</th>
                <th scope="col">Estado</th>
                <th scope="col">Actor</th>
                <th scope="col">Referencia</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 10).map((event) => (
                <tr key={event.eventId}>
                  <td>
                    <strong>{event.label}</strong>
                    <div className="adminContextHint">{event.eventType} / {event.source}</div>
                  </td>
                  <td><span className={statusBadgeClass(event.status)}>{valueText(event.status)}</span></td>
                  <td>{valueText(event.actor)}</td>
                  <td>
                    <strong>{compactId(event.referenceId)}</strong>
                    <div className="adminContextHint">{valueText(event.detail)}</div>
                  </td>
                  <td>{dateText(event.occurredAt ?? undefined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adminEmptyState">Sin eventos recientes.</div>
      )}
    </section>
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
      {includeEmail ? (
        <label className="adminField">
          <span>Email</span>
          <input name="email" type="email" defaultValue={customer?.email ?? ""} required />
        </label>
      ) : (
        <label className="adminField">
          <span>Email</span>
          <input name="emailDisplay" type="email" defaultValue={customer?.email ?? ""} readOnly />
        </label>
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
        <span>Telefono</span>
        <input name="phone" defaultValue={customer?.phone ?? ""} />
      </label>
      <label className="adminField">
        <span>Documento</span>
        <input name="documentNumber" defaultValue={customer?.documentNumber ?? ""} />
      </label>
      <label className="adminField">
        <span>Tipo comprador</span>
        <select name="buyerType" defaultValue={buyerTypeValue(customer?.buyerType)}>
          <option value="PRIVATE_BUYER">Particular</option>
          <option value="BUSINESS_BUYER">Empresa</option>
        </select>
      </label>
      <label className="adminField">
        <span>Locale</span>
        <input name="locale" defaultValue={localeValue(customer, contextLocale)} />
      </label>
      <label className="adminCheckbox">
        <input
          name="optinNewsLetter"
          type="checkbox"
          value="true"
          defaultChecked={customer?.clientPreferencesData?.optinNewsLetter ?? false}
        />
        Newsletter
      </label>
    </>
  );
}

function ProfileSummary({ customer }: { customer: CustomerProfile }) {
  return (
    <dl className="adminDefinitionList">
      <div><dt>Email</dt><dd>{valueText(customer.email)}</dd></div>
      <div><dt>Nombre</dt><dd>{valueText(customer.firstName)}</dd></div>
      <div><dt>Apellido</dt><dd>{valueText(customer.lastName)}</dd></div>
      <div><dt>Telefono</dt><dd>{valueText(customer.phone)}</dd></div>
      <div><dt>Documento</dt><dd>{valueText(customer.documentNumber)}</dd></div>
      <div><dt>Newsletter</dt><dd>{valueText(customer.clientPreferencesData?.optinNewsLetter)}</dd></div>
      <div><dt>Estado</dt><dd>{customerKind(customer)}</dd></div>
      <div><dt>Tipo</dt><dd>{buyerTypeLabel(customer.buyerType)}</dd></div>
      <div><dt>Creado</dt><dd>{dateText(customer.createdAt)}</dd></div>
      <div><dt>Actualizado</dt><dd>{dateText(customer.updatedAt)}</dd></div>
    </dl>
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
        <span>Receptor</span>
        <input name="receiverName" defaultValue={address?.receiverName ?? ""} required />
      </label>
      <label className="adminField">
        <span>Uso</span>
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
}: {
  title: string;
  closeHref: string;
  children: ReactNode;
}) {
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
}: {
  capabilities: CustomersAdminCapabilities;
  data: CustomersAdminData;
  filters: CustomersAdminFilters;
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

  if (filters.drawer !== "detail") {
    return null;
  }

  const customer = data.selectedCustomer.data;

  return (
    <DrawerShell title={customer ? fullName(customer) : "Detalle de cliente"} closeHref={closeHref}>
      <ResultBanner result={data.selectedCustomer} />
      {!customer ? (
        <div className="adminEmptyState">Selecciona un cliente del listado.</div>
      ) : (
        <div className="adminStack">
          <ResultBanner result={data.overview} />
          <CustomerSummaryPanel
            canReadPurchases={capabilities.canReadPurchases}
            customer={customer}
            data={data}
          />
          <OverviewWarningsPanel overview={data.overview.data} />
          <AccountOverviewPanel capabilities={capabilities} customer={customer} overview={data.overview.data} />
          <DuplicateCandidatesPanel overview={data.overview.data} />
          <ContinuityOverviewPanel capabilities={capabilities} customer={customer} overview={data.overview.data} />
          <OperationalOverviewPanel capabilities={capabilities} customer={customer} overview={data.overview.data} />
          <TimelineOverviewPanel customer={customer} overview={data.overview.data} />

          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <div>
                <h3>Perfil</h3>
                <p>{customer.customerId}</p>
              </div>
            </div>
            {capabilities.canWriteCustomers ? (
              <form action={updateCustomerProfileAction} className="adminFormGrid">
                <input name="customerId" type="hidden" value={customer.customerId} />
                <ProfileFields customer={customer} contextLocale={data.context.locale} />
                <dl className="adminDefinitionList">
                  <div><dt>Estado</dt><dd>{customerKind(customer)}</dd></div>
                  <div><dt>Tipo</dt><dd>{buyerTypeLabel(customer.buyerType)}</dd></div>
                  <div><dt>Creado</dt><dd>{dateText(customer.createdAt)}</dd></div>
                  <div><dt>Actualizado</dt><dd>{dateText(customer.updatedAt)}</dd></div>
                </dl>
                <div className="adminButtonRow">
                  <button className="adminButton adminButtonPrimary" type="submit">
                    <Save aria-hidden="true" size={16} />
                    Guardar perfil
                  </button>
                  <Link className="adminButton" href={closeHref}>Cancelar</Link>
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
                  href={customersHref(filters, {
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
                    href={customersHref(filters, { addressMode: undefined, addressId: undefined })}
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
                          <div className="adminContextHint">{address.addressId}</div>
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
                                href={customersHref(filters, {
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
                                <button className="adminIconButton" type="submit" title="Usar como envio">
                                  <Home aria-hidden="true" size={16} />
                                  <span className="adminVisuallyHidden">Usar como envio</span>
                                </button>
                              </form>
                              <form action={setDefaultBillingAddressAction}>
                                <input name="customerId" type="hidden" value={customer.customerId} />
                                <input name="addressId" type="hidden" value={address.addressId} />
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
            {capabilities.canReadPurchases && data.purchases.data?.items.length ? (
              <>
                <div className="adminTableScroller">
                  <table className="adminTable pricingTable">
                    <thead>
                      <tr>
                        <th scope="col">Pedido</th>
                        <th scope="col">Productos</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Total</th>
                        <th scope="col">Fecha</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.purchases.data.items.map((purchase) => {
                        const primaryItem = primaryPurchaseItem(purchase);
                        const href = primaryItem ? purchaseHref(primaryItem) : undefined;

                        return (
                          <tr key={purchase.purchaseId}>
                            <td>
                              <strong>{valueText(purchase.orderId ?? purchase.purchaseId)}</strong>
                              <div className="adminContextHint">{purchase.itemsCount ?? purchase.items?.length ?? 0} items</div>
                            </td>
                            <td>{purchaseItemsSummary(purchase)}</td>
                            <td>
                              <span className={`adminBadge ${purchase.isPaid ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                                {valueText(purchase.status)}
                              </span>
                            </td>
                            <td>{moneyText(purchase.totalAmountMinor, purchase.currency)}</td>
                            <td>{dateText(purchase.placedAt ?? purchase.recordedAt)}</td>
                            <td>
                              {href ? (
                                <Link className="adminButton adminButtonTiny" href={href}>
                                  Ver producto
                                </Link>
                              ) : (
                                "-"
                              )}
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
                    href={purchasePageHref(
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
                    href={purchasePageHref(
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
        </div>
      )}
    </DrawerShell>
  );
}

function CustomersTable({ data, filters }: CustomersAdminPageProps) {
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
                <div className="adminContextHint">{customer.customerId}</div>
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
                  href={customersHref(filters, { drawer: "detail", customerId: customer.customerId })}
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
        <form className="adminToolbar" action={applyCustomersFiltersAction}>
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
        <CustomersTable data={data} filters={filters} capabilities={capabilities} />
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
