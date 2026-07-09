import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminSession } from "../../shared/auth/session";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import type {
  CustomerAccountSummary,
  CustomerAdminTimelineEvent,
  CustomerAddressesData,
  CustomerAdminNote,
  CustomerAdminTag,
  CustomerAfterSalesItem,
  CustomerCommunicationItem,
  CustomerConsentSnapshot,
  CustomerDuplicateCandidatesData,
  CustomerInvoiceItem,
  CustomerOverviewData,
  CustomerOverviewList,
  CustomerOverviewWarning,
  CustomerProfile,
  CustomerPurchase,
  CustomerPurchasesData,
  CustomerPrivacyRequest,
  CustomerSessionItem,
  CustomerTimelineItem,
  CustomerAdminTask,
  CustomersAdminData,
  CustomersAdminCapabilities,
  CustomersAdminFilters,
  CustomersAdminPermission,
  CustomersAdminResult,
  CustomersListData,
} from "./customers-admin-types";

const defaultCustomersListLimit = 100;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  return value === null ? null : asString(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parsePositiveInteger(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function parseOffset(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function hasCustomerPermission(
  session: Pick<AdminSession, "permissions" | "scope"> | null | undefined,
  permission: CustomersAdminPermission,
) {
  if (!session || session.scope !== "admin") {
    return false;
  }

  const current = new Set(session.permissions.map((item) => item.trim().toLowerCase()));
  const aliases = permission === "customers.read" ? ["customers.read", "admin:customers:view"] : [permission];

  return (
    current.has("*") ||
    current.has("system.admin") ||
    current.has("admin:*") ||
    aliases.some((alias) => current.has(alias.toLowerCase()))
  );
}

export function getCustomersAdminCapabilities(
  session: Pick<AdminSession, "permissions" | "scope"> | null | undefined,
): CustomersAdminCapabilities {
  return {
    canReadCustomers: hasCustomerPermission(session, "customers.read"),
    canWriteCustomers: hasCustomerPermission(session, "customers.addresses.write"),
    canReadPurchases: hasCustomerPermission(session, "customers.purchases.read"),
    canExportCustomers: hasCustomerPermission(session, "customers.export"),
    canManageAccount: hasCustomerPermission(session, "customers.account.write"),
    canWriteNotes: hasCustomerPermission(session, "customers.notes.write"),
    canWriteTags: hasCustomerPermission(session, "customers.tags.write"),
    canWriteTasks: hasCustomerPermission(session, "customers.tasks.write"),
    canWritePrivacy: hasCustomerPermission(session, "customers.privacy.write"),
    canWriteConsents: hasCustomerPermission(session, "customers.consents.write"),
    canWriteSessions: hasCustomerPermission(session, "customers.sessions.write"),
    canWriteCommunications: hasCustomerPermission(session, "customers.communications.write"),
  };
}

function makeScopedParams(context: AdminContext, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  params.set("organizationId", context.organizationId);
  params.set("shopId", context.shopId);

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  }

  return params;
}

function normalizeAddress(value: unknown) {
  const record = asRecord(value);

  return {
    addressId: asString(record.addressId) ?? asString(record.id) ?? "",
    addressType: asString(record.addressType),
    addressName: asString(record.addressName) ?? asString(record.name),
    receiverName: asString(record.receiverName),
    addressRole: asString(record.addressRole),
    street: asString(record.street),
    number: asString(record.number),
    complement: asNullableString(record.complement),
    neighborhood: asString(record.neighborhood),
    city: asString(record.city),
    state: asString(record.state),
    country: asString(record.country),
    postalCode: asString(record.postalCode),
    phone: asNullableString(record.phone),
    reference: asNullableString(record.reference),
    isDefaultShipping: asBoolean(record.isDefaultShipping),
    isDefaultBilling: asBoolean(record.isDefaultBilling),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

function normalizeCustomer(value: unknown): CustomerProfile {
  const record = asRecord(value);
  const preferences = asRecord(record.clientPreferencesData);

  return {
    customerId: asString(record.customerId) ?? asString(record.id) ?? "",
    organizationId: asString(record.organizationId) ?? "",
    shopId: asString(record.shopId) ?? "",
    email: asString(record.email) ?? "",
    firstName: asString(record.firstName),
    lastName: asString(record.lastName),
    documentNumber: asNullableString(record.documentNumber),
    phone: asNullableString(record.phone),
    buyerType: asString(record.buyerType),
    clientPreferencesData: {
      locale: asString(preferences.locale),
      optinNewsLetter: asBoolean(preferences.optinNewsLetter),
    },
    defaultShippingAddress: record.defaultShippingAddress ? normalizeAddress(record.defaultShippingAddress) : null,
    defaultBillingAddress: record.defaultBillingAddress ? normalizeAddress(record.defaultBillingAddress) : null,
    isGuest: asBoolean(record.isGuest),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

function normalizeList(value: unknown): CustomersListData {
  const record = asRecord(value);
  const items = asArray(record.items ?? record.data ?? value).map(normalizeCustomer);

  return {
    items,
    total: asNumber(record.total) ?? items.length,
    limit: asNumber(record.limit) ?? items.length,
    offset: asNumber(record.offset) ?? 0,
  };
}

function normalizeAddresses(value: unknown): CustomerAddressesData {
  const record = asRecord(value);

  return {
    customerId: asString(record.customerId) ?? "",
    defaultShippingAddressId: asNullableString(record.defaultShippingAddressId),
    defaultBillingAddressId: asNullableString(record.defaultBillingAddressId),
    items: asArray(record.items ?? record.data ?? value).map(normalizeAddress),
  };
}

function normalizePurchaseItem(value: unknown) {
  const record = asRecord(value);

  return {
    lineId: asString(record.lineId),
    productId: asString(record.productId),
    variantId: asString(record.variantId),
    productSlug: asString(record.productSlug),
    productUrlPath: asString(record.productUrlPath),
    name: asString(record.name),
    imageUrl: asNullableString(record.imageUrl),
    quantity: asNumber(record.quantity),
    unitPriceMinor: asNumber(record.unitPriceMinor),
    lineTotalMinor: asNumber(record.lineTotalMinor),
  };
}

function normalizePurchase(value: unknown): CustomerPurchase {
  const record = asRecord(value);

  return {
    purchaseId: asString(record.purchaseId) ?? asString(record.orderId) ?? "",
    orderId: asString(record.orderId),
    customerId: asString(record.customerId) ?? "",
    status: asString(record.status),
    isPaid: asBoolean(record.isPaid),
    currency: asString(record.currency),
    totalAmountMinor: asNumber(record.totalAmountMinor),
    itemsCount: asNumber(record.itemsCount),
    items: asArray(record.items).map(normalizePurchaseItem),
    placedAt: asString(record.placedAt),
    recordedAt: asString(record.recordedAt),
  };
}

function normalizePurchases(value: unknown): CustomerPurchasesData {
  const record = asRecord(value);
  const items = asArray(record.items ?? record.data ?? value).map(normalizePurchase);

  return {
    customerId: asString(record.customerId) ?? "",
    total: asNumber(record.total) ?? items.length,
    limit: asNumber(record.limit) ?? items.length,
    offset: asNumber(record.offset) ?? 0,
    items,
  };
}

function normalizeOverviewList<T>(
  value: unknown,
  normalizeItem: (item: unknown) => T,
): CustomerOverviewList<T> {
  const record = asRecord(value);
  const items = asArray(record.items ?? record.data ?? value).map(normalizeItem);

  return {
    customerId: asString(record.customerId),
    total: asNumber(record.total) ?? items.length,
    limit: asNumber(record.limit),
    offset: asNumber(record.offset),
    items,
  };
}

function normalizeAccount(value: unknown): CustomerAccountSummary | null {
  if (!value) {
    return null;
  }
  const record = asRecord(value);
  const activation = asRecord(record.activation);

  return {
    principalId: asString(record.principalId) ?? "",
    principalType: asString(record.principalType),
    email: asString(record.email) ?? "",
    active: asBoolean(record.active),
    status: asString(record.status) as CustomerAccountSummary["status"],
    activation: record.activation
      ? {
          tokenStatus: asString(activation.tokenStatus),
          createdAt: asString(activation.createdAt),
          expiresAt: asString(activation.expiresAt),
          usedAt: asNullableString(activation.usedAt),
          isExpired: asBoolean(activation.isExpired),
          emailDeliveryStatus: asNullableString(activation.emailDeliveryStatus),
          lastEmailDeliveryId: asNullableString(activation.lastEmailDeliveryId),
          lastEmailError: asNullableString(activation.lastEmailError),
          lastEmailAttemptAt: asNullableString(activation.lastEmailAttemptAt),
          reminderCount: asNumber(activation.reminderCount),
          deletionWarningSentAt: asNullableString(activation.deletionWarningSentAt),
        }
      : null,
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

function normalizeDuplicateCandidates(value: unknown): CustomerDuplicateCandidatesData {
  const record = asRecord(value);
  const items = asArray(record.items).map((item) => {
    const candidate = asRecord(item);
    return {
      customer: normalizeCustomer(candidate.customer),
      matchFields: asArray(candidate.matchFields).map((field) => asString(field)).filter(Boolean) as string[],
    };
  });

  return {
    customerId: asString(record.customerId) ?? "",
    total: asNumber(record.total) ?? items.length,
    limit: asNumber(record.limit) ?? items.length,
    items,
  };
}

function normalizeNote(value: unknown): CustomerAdminNote {
  const record = asRecord(value);

  return {
    noteId: asString(record.noteId) ?? "",
    authorEmail: asString(record.authorEmail),
    body: asString(record.body),
    visibility: asString(record.visibility),
    createdAt: asString(record.createdAt),
  };
}

function normalizeTag(value: unknown): CustomerAdminTag {
  const record = asRecord(value);

  return {
    tagKey: asString(record.tagKey) ?? "",
    label: asString(record.label),
    color: asString(record.color),
  };
}

function normalizeTask(value: unknown): CustomerAdminTask {
  const record = asRecord(value);

  return {
    taskId: asString(record.taskId) ?? "",
    title: asString(record.title),
    status: asString(record.status),
    assignedEmployeeId: asNullableString(record.assignedEmployeeId),
    dueAt: asNullableString(record.dueAt),
    createdAt: asString(record.createdAt),
  };
}

function normalizePrivacyRequest(value: unknown): CustomerPrivacyRequest {
  const record = asRecord(value);

  return {
    requestId: asString(record.requestId) ?? "",
    requestType: asString(record.requestType),
    status: asString(record.status),
    requesterEmail: asNullableString(record.requesterEmail),
    reason: asNullableString(record.reason),
    createdAt: asString(record.createdAt),
    resolvedAt: asNullableString(record.resolvedAt),
  };
}

function normalizeConsents(value: unknown): CustomerConsentSnapshot | null {
  if (!value) {
    return null;
  }
  const record = asRecord(value);
  const current = asRecord(record.current);
  const marketingEmail = asRecord(current.marketingEmail);

  return {
    current: {
      marketingEmail: {
        granted: asBoolean(marketingEmail.granted),
        source: asString(marketingEmail.source),
        recordedAt: asString(marketingEmail.recordedAt),
      },
    },
    events: normalizeOverviewList(record.events, (event) => {
      const item = asRecord(event);
      return {
        eventId: asString(item.eventId) ?? "",
        consentType: asString(item.consentType),
        granted: asBoolean(item.granted),
        source: asString(item.source),
        actorEmail: asNullableString(item.actorEmail),
        recordedAt: asString(item.recordedAt),
      };
    }),
  };
}

function normalizeSession(value: unknown): CustomerSessionItem {
  const record = asRecord(value);
  const device = asRecord(record.device);

  return {
    sessionId: asString(record.sessionId) ?? "",
    createdAt: asString(record.createdAt),
    lastSeenAt: asString(record.lastSeenAt),
    device: {
      deviceName: asString(device.deviceName),
      ipAddress: asString(device.ipAddress),
    },
  };
}

function normalizeInvoice(value: unknown): CustomerInvoiceItem {
  const record = asRecord(value);

  return {
    invoiceId: asString(record.invoiceId) ?? "",
    invoiceNumber: asString(record.invoiceNumber),
    status: asString(record.status),
    currency: asString(record.currency),
    totalAmountMinor: asNumber(record.totalAmountMinor),
    issuedAt: asString(record.issuedAt),
  };
}

function normalizeAfterSalesCase(value: unknown): CustomerAfterSalesItem {
  const record = asRecord(value);

  return {
    caseId: asString(record.caseId) ?? "",
    orderId: asString(record.orderId),
    caseType: asString(record.caseType),
    status: asString(record.status),
    assignedEmployeeId: asNullableString(record.assignedEmployeeId),
    createdAt: asString(record.createdAt),
  };
}

function normalizeCommunication(value: unknown): CustomerCommunicationItem {
  const record = asRecord(value);

  return {
    deliveryId: asString(record.deliveryId) ?? "",
    templateKey: asString(record.templateKey),
    status: asString(record.status),
    channel: asString(record.channel),
    createdAt: asString(record.createdAt),
  };
}

function normalizeTimelineItem(value: unknown): CustomerTimelineItem {
  const record = asRecord(value);

  return {
    type: asString(record.type) ?? "",
    status: asString(record.status),
    referenceId: asString(record.referenceId),
    occurredAt: asString(record.occurredAt),
    source: asString(record.source),
  };
}

function normalizeWarning(value: unknown): CustomerOverviewWarning {
  const record = asRecord(value);

  return {
    section: asString(record.section) ?? "",
    message: asString(record.message),
  };
}

function normalizeOverview(value: unknown): CustomerOverviewData {
  const record = asRecord(value);

  return {
    customer: record.customer ? normalizeCustomer(record.customer) : null,
    account: normalizeAccount(record.account),
    addresses: record.addresses ? normalizeAddresses(record.addresses) : null,
    purchases: record.purchases ? normalizePurchases(record.purchases) : null,
    duplicateCandidates: normalizeDuplicateCandidates(record.duplicateCandidates),
    notes: normalizeOverviewList(record.notes, normalizeNote),
    tags: normalizeOverviewList(record.tags, normalizeTag),
    tasks: normalizeOverviewList(record.tasks, normalizeTask),
    privacyRequests: normalizeOverviewList(record.privacyRequests, normalizePrivacyRequest),
    consents: normalizeConsents(record.consents),
    sessions: record.sessions ? normalizeOverviewList(record.sessions, normalizeSession) : null,
    invoices: normalizeOverviewList(record.invoices, normalizeInvoice),
    afterSales: normalizeOverviewList(record.afterSales, normalizeAfterSalesCase),
    communications: normalizeOverviewList(record.communications, normalizeCommunication),
    timeline: normalizeOverviewList(record.timeline, normalizeTimelineItem),
    warnings: asArray(record.warnings).map(normalizeWarning),
    generatedAt: asString(record.generatedAt),
  };
}

function unavailable<T>(
  endpoint: string,
  fallback: T,
  result: Extract<BffResult<T>, { ok: false }>,
  permission: CustomersAdminPermission = "customers.read",
): CustomersAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: result.status === 403 ? `Falta permiso ${permission}.` : result.error,
    failedEndpoint: endpoint,
    status: result.status,
    permission: result.status === 403 ? permission : undefined,
  };
}

function unavailableContext<T>(fallback: T): CustomersAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: "Selecciona organization y shop para consultar clientes.",
  };
}

function unavailablePermission<T>(
  fallback: T,
  permission: CustomersAdminPermission,
): CustomersAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: `Falta permiso ${permission}.`,
    status: 403,
    permission,
  };
}

function emptyOverview(customerId: string | undefined): CustomerOverviewData | null {
  if (!customerId) {
    return null;
  }

  return {
    customer: null,
    account: null,
    addresses: null,
    purchases: null,
    duplicateCandidates: { customerId, total: 0, limit: 0, items: [] },
    notes: { customerId, total: 0, items: [] },
    tags: { customerId, total: 0, items: [] },
    tasks: { customerId, total: 0, items: [] },
    privacyRequests: { customerId, total: 0, items: [] },
    consents: null,
    sessions: null,
    invoices: { customerId, total: 0, items: [] },
    afterSales: { customerId, total: 0, items: [] },
    communications: { customerId, total: 0, items: [] },
    timeline: { customerId, total: 0, items: [] },
    warnings: [],
  };
}

function emptyPurchases(customerId: string | undefined, filters: CustomersAdminFilters): CustomerPurchasesData {
  return {
    customerId: customerId ?? "",
    total: 0,
    limit: parsePositiveInteger(filters.purchasesLimit, 5, 25),
    offset: parseOffset(filters.purchasesOffset),
    items: [],
  };
}

function timelineEvent(event: CustomerAdminTimelineEvent): CustomerAdminTimelineEvent {
  return event;
}

function customerLabel(customer: CustomerProfile | null | undefined) {
  if (!customer) {
    return undefined;
  }

  return [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email || customer.customerId;
}

export function buildCustomerAdminTimeline(
  overview: CustomerOverviewData | null,
  fallbackCustomer?: CustomerProfile | null,
): CustomerAdminTimelineEvent[] {
  const customer = overview?.customer ?? fallbackCustomer ?? null;
  const customerId = customer?.customerId ?? overview?.timeline.customerId ?? "selected-customer";
  const currentConsent = overview?.consents?.current?.marketingEmail;
  const events: CustomerAdminTimelineEvent[] = [
    timelineEvent({
      eventId: `customer:${customerId}:created`,
      eventType: "CUSTOMER_CREATED",
      label: "Cliente creado",
      status: customer?.isGuest ? "GUEST" : "REGISTERED",
      actor: customer?.email,
      referenceId: customer?.customerId,
      occurredAt: customer?.createdAt,
      source: "customer",
      detail: customerLabel(customer),
    }),
    timelineEvent({
      eventId: `customer:${customerId}:updated`,
      eventType: "CUSTOMER_UPDATED",
      label: "Perfil actualizado",
      status: customer?.buyerType,
      actor: customer?.email,
      referenceId: customer?.customerId,
      occurredAt: customer?.updatedAt,
      source: "customer",
      detail: customer?.phone ?? customer?.documentNumber ?? undefined,
    }),
    timelineEvent({
      eventId: `account:${overview?.account?.principalId ?? customerId}`,
      eventType: "ACCOUNT_STATUS",
      label: "Cuenta auth",
      status: overview?.account?.status ?? (overview?.account ? (overview.account.active === false ? "BLOCKED" : "ACTIVE") : undefined),
      actor: overview?.account?.email,
      referenceId: overview?.account?.principalId,
      occurredAt: overview?.account?.updatedAt ?? overview?.account?.createdAt,
      source: "account",
      detail: overview?.account?.principalType,
    }),
    ...(overview?.purchases?.items ?? []).map((purchase) => timelineEvent({
      eventId: `purchase:${purchase.purchaseId}`,
      eventType: "PURCHASE_RECORDED",
      label: "Compra registrada",
      status: purchase.status ?? (purchase.isPaid ? "PAID" : undefined),
      actor: purchase.customerId,
      referenceId: purchase.orderId ?? purchase.purchaseId,
      occurredAt: purchase.placedAt ?? purchase.recordedAt,
      source: "purchase",
      detail: typeof purchase.totalAmountMinor === "number" && purchase.currency
        ? `${purchase.totalAmountMinor} ${purchase.currency}`
        : undefined,
    })),
    ...(overview?.invoices.items ?? []).map((invoice) => timelineEvent({
      eventId: `invoice:${invoice.invoiceId}`,
      eventType: "INVOICE_STATUS",
      label: "Factura",
      status: invoice.status,
      referenceId: invoice.invoiceId,
      occurredAt: invoice.issuedAt,
      source: "invoice",
      detail: invoice.invoiceNumber,
    })),
    ...(overview?.afterSales.items ?? []).map((caseItem) => timelineEvent({
      eventId: `after-sales:${caseItem.caseId}`,
      eventType: "AFTER_SALES_CASE",
      label: "Caso postventa",
      status: caseItem.status,
      actor: caseItem.assignedEmployeeId,
      referenceId: caseItem.caseId,
      occurredAt: caseItem.createdAt,
      source: "after-sales",
      detail: caseItem.caseType ?? caseItem.orderId,
    })),
    ...(overview?.communications.items ?? []).map((communication) => timelineEvent({
      eventId: `communication:${communication.deliveryId}`,
      eventType: "COMMUNICATION_SENT",
      label: "Comunicacion",
      status: communication.status,
      referenceId: communication.deliveryId,
      occurredAt: communication.createdAt,
      source: "communication",
      detail: communication.templateKey ?? communication.channel,
    })),
    ...(overview?.notes.items ?? []).map((note) => timelineEvent({
      eventId: `note:${note.noteId}`,
      eventType: "ADMIN_NOTE",
      label: "Nota interna",
      status: note.visibility,
      actor: note.authorEmail,
      referenceId: note.noteId,
      occurredAt: note.createdAt,
      source: "note",
      detail: note.body,
    })),
    ...(overview?.tasks.items ?? []).map((task) => timelineEvent({
      eventId: `task:${task.taskId}`,
      eventType: "ADMIN_TASK",
      label: "Tarea administrativa",
      status: task.status,
      actor: task.assignedEmployeeId,
      referenceId: task.taskId,
      occurredAt: task.createdAt ?? task.dueAt,
      source: "task",
      detail: task.title,
    })),
    ...(overview?.privacyRequests.items ?? []).map((request) => timelineEvent({
      eventId: `privacy:${request.requestId}`,
      eventType: "PRIVACY_REQUEST",
      label: "Solicitud privacidad",
      status: request.status,
      actor: request.requesterEmail,
      referenceId: request.requestId,
      occurredAt: request.resolvedAt ?? request.createdAt,
      source: "privacy",
      detail: request.requestType ?? request.reason ?? undefined,
    })),
    ...(overview?.consents?.events?.items ?? []).map((event) => timelineEvent({
      eventId: `consent:${event.eventId}`,
      eventType: "CONSENT_EVENT",
      label: "Consentimiento",
      status: event.granted === undefined ? undefined : event.granted ? "GRANTED" : "REVOKED",
      actor: event.actorEmail,
      referenceId: event.eventId,
      occurredAt: event.recordedAt,
      source: "consent",
      detail: event.consentType ?? event.source,
    })),
    timelineEvent({
      eventId: `consent:${customerId}:current-marketing`,
      eventType: "CURRENT_CONSENT",
      label: "Consentimiento actual",
      status: currentConsent?.granted === undefined ? undefined : currentConsent.granted ? "GRANTED" : "REVOKED",
      referenceId: "marketingEmail",
      occurredAt: currentConsent?.recordedAt,
      source: "consent",
      detail: currentConsent?.source,
    }),
    ...(overview?.sessions?.items ?? []).map((session) => timelineEvent({
      eventId: `session:${session.sessionId}`,
      eventType: "CUSTOMER_SESSION",
      label: "Sesion cliente",
      status: "ACTIVE",
      referenceId: session.sessionId,
      occurredAt: session.lastSeenAt ?? session.createdAt,
      source: "session",
      detail: session.device?.deviceName ?? session.device?.ipAddress,
    })),
    ...(overview?.timeline.items ?? []).map((item, index) => timelineEvent({
      eventId: `overview:${item.type}:${item.referenceId ?? index + 1}`,
      eventType: item.type || "OVERVIEW_EVENT",
      label: "Evento overview",
      status: item.status,
      referenceId: item.referenceId,
      occurredAt: item.occurredAt,
      source: "overview",
      detail: item.source,
    })),
    ...(overview?.warnings ?? []).map((warning, index) => timelineEvent({
      eventId: `composition-warning:${warning.section || index + 1}`,
      eventType: "COMPOSITION_WARNING",
      label: "Warning de composicion",
      status: "WARNING",
      referenceId: warning.section,
      occurredAt: overview?.generatedAt,
      source: "composition",
      detail: warning.message,
    })),
  ];

  return events
    .filter((event) => event.occurredAt || event.referenceId || event.detail || event.status)
    .sort((left, right) => {
      const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
      const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
      return rightTime - leftTime;
    });
}

export async function getCustomerOverview(
  context: AdminContext,
  customerId: string | undefined,
  filters: CustomersAdminFilters = {},
): Promise<CustomersAdminResult<CustomerOverviewData | null>> {
  if (!customerId) {
    return { source: "bff", data: null };
  }
  if (!hasRequiredAdminContext(context)) {
    return unavailableContext(null);
  }

  const params = makeScopedParams(context, {
    recentLimit: String(parsePositiveInteger(filters.purchasesLimit, 5, 20)),
  });
  const endpoint = `/admin/customers/${encodeURIComponent(customerId)}/overview?${params.toString()}`;
  const result = await requestBff(endpoint, {
    context,
    parse: normalizeOverview,
  });

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, emptyOverview(customerId), result);
}

export async function getCustomersList(
  context: AdminContext,
  filters: CustomersAdminFilters,
): Promise<CustomersAdminResult<CustomersListData>> {
  const fallback = { items: [], total: 0, limit: defaultCustomersListLimit, offset: 0 };
  if (!hasRequiredAdminContext(context)) {
    return unavailableContext(fallback);
  }

  const limit = parsePositiveInteger(filters.limit, defaultCustomersListLimit, defaultCustomersListLimit);
  const offset = parseOffset(filters.offset);
  const params = makeScopedParams(context, {
    q: filters.q,
    email: filters.email,
    limit: String(limit),
    offset: String(offset),
  });
  const endpoint = `/admin/customers?${params.toString()}`;
  const result = await requestBff(endpoint, {
    context,
    parse: normalizeList,
  });

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, fallback, result);
}

export async function getCustomerDetail(
  context: AdminContext,
  customerId: string | undefined,
): Promise<CustomersAdminResult<CustomerProfile | null>> {
  if (!customerId) {
    return { source: "bff", data: null };
  }
  if (!hasRequiredAdminContext(context)) {
    return unavailableContext(null);
  }

  const params = makeScopedParams(context);
  const endpoint = `/admin/customers/${encodeURIComponent(customerId)}?${params.toString()}`;
  const result = await requestBff(endpoint, {
    context,
    parse: normalizeCustomer,
  });

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, null, result);
}

export async function getCustomerAddresses(
  context: AdminContext,
  customerId: string | undefined,
): Promise<CustomersAdminResult<CustomerAddressesData | null>> {
  if (!customerId) {
    return { source: "bff", data: null };
  }
  if (!hasRequiredAdminContext(context)) {
    return unavailableContext(null);
  }

  const params = makeScopedParams(context);
  const endpoint = `/admin/customers/${encodeURIComponent(customerId)}/addresses?${params.toString()}`;
  const result = await requestBff(endpoint, {
    context,
    parse: normalizeAddresses,
  });

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, null, result);
}

export async function getCustomerPurchases(
  context: AdminContext,
  customerId: string | undefined,
  filters: CustomersAdminFilters = {},
): Promise<CustomersAdminResult<CustomerPurchasesData | null>> {
  if (!customerId) {
    return { source: "bff", data: null };
  }
  if (!hasRequiredAdminContext(context)) {
    return unavailableContext(null);
  }

  const params = makeScopedParams(context, {
    limit: String(parsePositiveInteger(filters.purchasesLimit, 5, 25)),
    offset: String(parseOffset(filters.purchasesOffset)),
  });
  const endpoint = `/admin/customers/${encodeURIComponent(customerId)}/purchases?${params.toString()}`;
  const result = await requestBff(endpoint, {
    context,
    parse: normalizePurchases,
  });

  return result.ok
    ? { source: "bff", data: result.data }
    : unavailable(endpoint, null, result, "customers.purchases.read");
}

export async function getCustomersAdminData(
  context: AdminContext,
  filters: CustomersAdminFilters,
  options: { includePurchases?: boolean } = {},
): Promise<CustomersAdminData> {
  const selectedCustomerId = filters.drawer === "detail" ? filters.customerId : undefined;
  const [list, overview] = await Promise.all([
    getCustomersList(context, filters),
    getCustomerOverview(context, selectedCustomerId, filters),
  ]);

  if (overview.source === "bff" && overview.data) {
    return {
      context,
      list,
      overview,
      selectedCustomer: { source: "bff", data: overview.data.customer },
      addresses: { source: "bff", data: overview.data.addresses },
      purchases: options.includePurchases === false
        ? unavailablePermission(emptyPurchases(selectedCustomerId, filters), "customers.purchases.read")
        : { source: "bff", data: overview.data.purchases },
    };
  }

  const purchasesPromise = selectedCustomerId && options.includePurchases === false
    ? Promise.resolve(unavailablePermission(emptyPurchases(selectedCustomerId, filters), "customers.purchases.read"))
    : getCustomerPurchases(context, selectedCustomerId, filters);
  const [selectedCustomer, addresses, purchases] = await Promise.all([
    getCustomerDetail(context, selectedCustomerId),
    getCustomerAddresses(context, selectedCustomerId),
    purchasesPromise,
  ]);

  return {
    context,
    list,
    overview,
    selectedCustomer,
    addresses,
    purchases,
  };
}
