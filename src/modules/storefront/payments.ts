export type StorefrontPaymentProvider = "paypal" | "stripe" | "unknown";

export type StorefrontPaymentActor = "guest" | "customer";

export type StorefrontPaymentAttemptStatus = "STARTED" | "REDIRECTED" | "RETURNED" | "SETTLED" | "CANCELLED" | "FAILED";

export type StorefrontPaymentNextActionType = "REDIRECT" | "CLIENT_CONFIRMATION" | "AWAIT_WEBHOOK" | "NONE" | "UNKNOWN";

export type StorefrontPaymentMethod = {
  active: boolean;
  affiliationId?: string;
  groupName?: string;
  installments?: number[];
  methodType?: string;
  name: string;
  paymentSystemId: string;
  provider: StorefrontPaymentProvider;
  raw: Record<string, unknown>;
};

export type StorefrontPaymentNextAction = {
  clientSecret?: string;
  redirectUrl?: string;
  raw: Record<string, unknown>;
  type: StorefrontPaymentNextActionType;
};

export type StorefrontPaymentTransaction = {
  amountMinor?: number;
  currency?: string;
  nextAction: StorefrontPaymentNextAction;
  paymentSystemId?: string;
  raw: Record<string, unknown>;
  status?: string;
  transactionId: string;
};

export type StorefrontPaymentAttempt = {
  actor: StorefrontPaymentActor;
  amountMinor: number;
  correlationId: string;
  createdAtIso: string;
  currency: string;
  customerId?: string;
  expiresAtIso: string;
  guestSessionId?: string;
  itemsCount: number;
  orderFormId: string;
  paymentSystemId: string;
  paymentSystemName: string;
  provider: Exclude<StorefrontPaymentProvider, "unknown">;
  status: StorefrontPaymentAttemptStatus;
  transactionId: string;
};

export type StorefrontPaymentReceipt = {
  amountMinor?: number;
  capturedAtIso: string;
  correlationId?: string;
  currency?: string;
  expiresAtIso: string;
  orderFormId?: string;
  paymentSystemId?: string;
  paymentSystemName?: string;
  provider: Exclude<StorefrontPaymentProvider, "unknown">;
  status: string;
  supportReference: string;
  transactionId: string;
};

export type StorefrontPaymentDecision =
  | {
      kind: "redirect";
      provider: StorefrontPaymentProvider;
      redirectUrl: string;
    }
  | {
      kind: "pending";
      provider: StorefrontPaymentProvider;
    }
  | {
      kind: "continue";
      provider: StorefrontPaymentProvider;
    }
  | {
      kind: "unsupported";
      message: string;
      provider: StorefrontPaymentProvider;
    };

export type StorefrontPaymentsRequestInput = {
  country?: string;
  currency?: string;
  guestSessionId?: string;
  locale?: string;
  organizationId?: string;
  shopAlias?: string;
  shopId?: string;
};

export type StorefrontPaymentTransactionInput = StorefrontPaymentsRequestInput & {
  body: Record<string, unknown>;
  correlationId?: string;
};

export type StorefrontPaymentReturnInput = StorefrontPaymentsRequestInput & {
  body: Record<string, unknown>;
  correlationId?: string;
  transactionId: string;
};

export type StorefrontPaymentCancelInput = StorefrontPaymentsRequestInput & {
  body?: Record<string, unknown>;
  correlationId?: string;
  transactionId: string;
};

export type StorefrontPaymentTransactionDetailInput = StorefrontPaymentsRequestInput & {
  correlationId?: string;
  transactionId: string;
};

export type StorefrontPaymentsFetch = (path: string, init?: RequestInit) => Promise<Response>;

export class StorefrontPaymentsApiError extends Error {
  correlationId?: string;
  isRetryable: boolean;
  payload?: unknown;
  status?: number;

  constructor(message: string, options: { correlationId?: string; payload?: unknown; status?: number } = {}) {
    super(message);
    this.name = "StorefrontPaymentsApiError";
    this.correlationId = options.correlationId;
    this.payload = options.payload;
    this.status = options.status;
    this.isRetryable = options.status === 408 || options.status === 429 || options.status === 503 || options.status === 504;
  }
}

const PAYMENT_ATTEMPT_STORAGE_KEY = "ecommium.checkout.paymentAttempt.v1";
const PAYMENT_RECEIPT_STORAGE_KEY = "ecommium.checkout.paymentReceipt.v1";
const PAYMENT_RETURN_ONCE_PREFIX = "ecommium.checkout.paymentReturn.v1";
const PAYMENT_ATTEMPT_TTL_MS = 90 * 60 * 1000;
const PAYMENT_RECEIPT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createStorefrontPaymentCorrelationId(now = Date.now()) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(16).slice(2);

  return `checkout-payment-${now}-${random}`;
}

export function normalizeStorefrontPaymentMethods(payload: unknown): StorefrontPaymentMethod[] {
  return listFromEnvelope(payload, ["paymentSystems", "paymentMethods", "items", "data"])
    .map(normalizeStorefrontPaymentMethod)
    .filter((method): method is StorefrontPaymentMethod => Boolean(method));
}

export function normalizeStorefrontPaymentMethod(value: unknown): StorefrontPaymentMethod | null {
  const raw = asRecord(value);
  const paymentSystemId =
    asString(raw.paymentSystemId) ??
    asString(raw.id) ??
    asString(raw.paymentMethodId) ??
    asString(raw.systemId);

  if (!paymentSystemId) {
    return null;
  }

  const name = asString(raw.name) ?? asString(raw.displayName) ?? asString(raw.label) ?? paymentSystemId;
  const methodType = asString(raw.methodType) ?? asString(raw.type) ?? asString(raw.kind);
  const groupName = asString(raw.groupName) ?? asString(raw.group) ?? asString(raw.paymentGroupName);
  const affiliation = asRecord(raw.affiliation);
  const affiliationId = asString(raw.affiliationId) ?? asString(affiliation.affiliationId) ?? asString(affiliation.id);

  return {
    active: raw.active !== false && raw.enabled !== false && raw.status !== "INACTIVE",
    affiliationId,
    groupName,
    installments: normalizeInstallments(raw.installments),
    methodType,
    name,
    paymentSystemId,
    provider: inferPaymentProvider({ affiliation, groupName, methodType, name, paymentSystemId, raw }),
    raw,
  };
}

const redirectHostsByProvider: Record<Exclude<StorefrontPaymentProvider, "unknown">, ReadonlySet<string>> = {
  paypal: new Set(["www.paypal.com", "www.sandbox.paypal.com"]),
  stripe: new Set(["checkout.stripe.com"]),
};

const redirectControlCharacters = /[\u0000-\u001F\u007F]/;

export function validateStorefrontPaymentRedirectUrl(
  provider: StorefrontPaymentProvider,
  value: string | undefined,
) {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 2048 || redirectControlCharacters.test(candidate) || provider === "unknown") {
    return undefined;
  }

  try {
    const url = new URL(candidate);
    const allowedHosts = redirectHostsByProvider[provider];
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !allowedHosts.has(url.hostname.toLowerCase())
    ) {
      return undefined;
    }

    return url.href;
  } catch {
    return undefined;
  }
}

export function installedStorefrontPaymentMethods(methods: StorefrontPaymentMethod[]) {
  return methods.filter((method) => method.active && (method.provider === "paypal" || method.provider === "stripe"));
}

export function inferPaymentProvider(input: {
  affiliation?: Record<string, unknown>;
  groupName?: string;
  methodType?: string;
  name?: string;
  paymentSystemId?: string;
  raw?: Record<string, unknown>;
}): StorefrontPaymentProvider {
  const raw = input.raw ?? {};
  const affiliation = input.affiliation ?? asRecord(raw.affiliation);
  const fingerprint = [
    input.paymentSystemId,
    input.name,
    input.groupName,
    input.methodType,
    asString(raw.provider),
    asString(raw.providerId),
    asString(raw.connector),
    asString(raw.driver),
    asString(affiliation.provider),
    asString(affiliation.providerId),
    asString(affiliation.driver),
    asString(affiliation.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (fingerprint.includes("paypal")) {
    return "paypal";
  }

  if (fingerprint.includes("stripe") || fingerprint.includes("strype")) {
    return "stripe";
  }

  return "unknown";
}

export function normalizeStorefrontPaymentTransaction(payload: unknown): StorefrontPaymentTransaction {
  const raw = asRecord(payload);
  const transaction = extractPaymentTransactionRecord(raw);
  const transactionId =
    asString(transaction.transactionId) ??
    asString(transaction.id) ??
    asString(raw.transactionId) ??
    "";

  return {
    amountMinor: asNumber(transaction.amountMinor) ?? asNumber(transaction.valueMinor),
    currency: asString(transaction.currency),
    nextAction: normalizeTransactionNextAction(transaction.nextAction ?? raw.nextAction ?? transaction.action ?? raw.action),
    paymentSystemId: asString(transaction.paymentSystemId),
    raw: transaction,
    status: asString(transaction.status),
    transactionId,
  };
}

function extractPaymentTransactionRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const settlement = asRecord(raw.settlement);
  const authorization = asRecord(raw.authorization);
  const additionalData = asRecord(raw.additionalData);

  return asRecord(
    raw.transaction ??
    raw.paymentTransaction ??
    asRecord(settlement.transaction).transaction ??
    settlement.transaction ??
    asRecord(settlement.data).transaction ??
    settlement.data ??
    asRecord(authorization.transaction).transaction ??
    authorization.transaction ??
    asRecord(authorization.data).transaction ??
    authorization.data ??
    asRecord(additionalData.transaction).transaction ??
    additionalData.transaction ??
    raw.data ??
    raw,
  );
}

export function normalizeTransactionNextAction(value: unknown): StorefrontPaymentNextAction {
  const raw = asRecord(value);
  const type = normalizeNextActionType(raw.type ?? raw.actionType ?? raw.kind ?? raw.action);
  const nested = asRecord(raw.redirect ?? raw.confirmation ?? raw.data);

  return {
    clientSecret: asString(raw.clientSecret) ?? asString(nested.clientSecret),
    redirectUrl:
      asString(raw.redirectUrl) ??
      asString(raw.url) ??
      asString(raw.href) ??
      asString(nested.redirectUrl) ??
      asString(nested.url) ??
      asString(nested.href),
    raw,
    type,
  };
}

export function decideStorefrontPaymentAction(
  method: Pick<StorefrontPaymentMethod, "provider">,
  transaction: Pick<StorefrontPaymentTransaction, "nextAction">,
): StorefrontPaymentDecision {
  const provider = method.provider;

  if (transaction.nextAction.type === "REDIRECT") {
    const redirectUrl = validateStorefrontPaymentRedirectUrl(provider, transaction.nextAction.redirectUrl);
    if (redirectUrl) {
      return {
        kind: "redirect",
        provider,
        redirectUrl,
      };
    }

    return {
      kind: "unsupported",
      message: "La pasarela no devolvio una URL de redireccion valida.",
      provider,
    };
  }

  if (transaction.nextAction.type === "AWAIT_WEBHOOK" || transaction.nextAction.type === "CLIENT_CONFIRMATION") {
    return {
      kind: "pending",
      provider,
    };
  }

  if (transaction.nextAction.type === "NONE") {
    return {
      kind: "continue",
      provider,
    };
  }

  return {
    kind: "unsupported",
    message: "La pasarela devolvio una accion no soportada por el checkout.",
    provider,
  };
}

export function buildStorefrontPaymentSystemsPath(input: StorefrontPaymentsRequestInput) {
  return `/api/storefront/payments/payment-systems?${buildStorefrontPaymentParams(input).toString()}`;
}

export function buildStorefrontPaymentTransactionPath(input: StorefrontPaymentsRequestInput) {
  return `/api/storefront/payments/transactions?${buildStorefrontPaymentParams(input).toString()}`;
}

export function buildStorefrontPaymentTransactionDetailPath(input: StorefrontPaymentTransactionDetailInput) {
  const params = buildStorefrontPaymentParams(input);
  const query = params.toString();
  return `/api/storefront/payments/transactions/${encodeURIComponent(input.transactionId)}${query ? `?${query}` : ""}`;
}

export function buildStorefrontPaymentCompleteReturnPath(
  provider: Exclude<StorefrontPaymentProvider, "unknown">,
  input: StorefrontPaymentReturnInput,
) {
  const params = buildStorefrontPaymentParams(input);
  return `/api/storefront/payments/transactions/${encodeURIComponent(input.transactionId)}/${provider}/complete-return?${params.toString()}`;
}

export function buildStorefrontPaymentCancelPath(input: StorefrontPaymentCancelInput) {
  const params = buildStorefrontPaymentParams(input);
  return `/api/storefront/payments/transactions/${encodeURIComponent(input.transactionId)}/cancel?${params.toString()}`;
}

export async function listStorefrontPaymentSystems(
  input: StorefrontPaymentsRequestInput,
  paymentsFetch: StorefrontPaymentsFetch = defaultPaymentsFetch,
) {
  const data = await requestStorefrontPaymentJson(buildStorefrontPaymentSystemsPath(input), undefined, paymentsFetch);
  return normalizeStorefrontPaymentMethods(data);
}

export async function createStorefrontPaymentTransaction(
  input: StorefrontPaymentTransactionInput,
  paymentsFetch: StorefrontPaymentsFetch = defaultPaymentsFetch,
) {
  const data = await requestStorefrontPaymentJson(
    buildStorefrontPaymentTransactionPath(input),
    paymentRequestInit("POST", input.body, input.correlationId),
    paymentsFetch,
  );
  return normalizeStorefrontPaymentTransaction(data);
}

export async function getStorefrontPaymentTransaction(
  input: StorefrontPaymentTransactionDetailInput,
  paymentsFetch: StorefrontPaymentsFetch = defaultPaymentsFetch,
) {
  const data = await requestStorefrontPaymentJson(
    buildStorefrontPaymentTransactionDetailPath(input),
    input.correlationId ? { headers: paymentCorrelationHeaders(input.correlationId) } : undefined,
    paymentsFetch,
  );
  return normalizeStorefrontPaymentTransaction(data);
}

export async function completeStorefrontPaymentReturn(
  provider: Exclude<StorefrontPaymentProvider, "unknown">,
  input: StorefrontPaymentReturnInput,
  paymentsFetch: StorefrontPaymentsFetch = defaultPaymentsFetch,
) {
  const data = await requestStorefrontPaymentJson(
    buildStorefrontPaymentCompleteReturnPath(provider, input),
    paymentRequestInit("POST", input.body, input.correlationId),
    paymentsFetch,
  ).catch((error) => {
    if (error instanceof StorefrontPaymentsApiError && error.status === 409 && input.transactionId) {
      return getStorefrontPaymentTransaction({
        correlationId: input.correlationId,
        currency: input.currency,
        country: input.country,
        guestSessionId: input.guestSessionId,
        locale: input.locale,
        organizationId: input.organizationId,
        shopAlias: input.shopAlias,
        shopId: input.shopId,
        transactionId: input.transactionId,
      }, paymentsFetch);
    }
    throw error;
  });
  const transaction = normalizeStorefrontPaymentTransaction(data);

  if (!transaction.status && input.transactionId) {
    return getStorefrontPaymentTransaction({
      correlationId: input.correlationId,
      currency: input.currency,
      country: input.country,
      guestSessionId: input.guestSessionId,
      locale: input.locale,
      organizationId: input.organizationId,
      shopAlias: input.shopAlias,
      shopId: input.shopId,
      transactionId: input.transactionId,
    }, paymentsFetch);
  }

  return transaction;
}

export async function cancelStorefrontPendingPaymentTransaction(
  input: StorefrontPaymentCancelInput,
  paymentsFetch: StorefrontPaymentsFetch = defaultPaymentsFetch,
) {
  const data = await requestStorefrontPaymentJson(
    buildStorefrontPaymentCancelPath(input),
    paymentRequestInit("POST", input.body ?? {}, input.correlationId),
    paymentsFetch,
  );
  return normalizeStorefrontPaymentTransaction(data);
}

export function createStorefrontPaymentAttempt(input: Omit<StorefrontPaymentAttempt, "createdAtIso" | "expiresAtIso" | "status"> & {
  createdAt?: Date;
  status?: StorefrontPaymentAttemptStatus;
}): StorefrontPaymentAttempt {
  const createdAt = input.createdAt ?? new Date();

  return {
    actor: input.actor,
    amountMinor: Math.max(0, input.amountMinor),
    correlationId: input.correlationId,
    createdAtIso: createdAt.toISOString(),
    currency: input.currency,
    customerId: input.customerId,
    expiresAtIso: new Date(createdAt.getTime() + PAYMENT_ATTEMPT_TTL_MS).toISOString(),
    guestSessionId: input.guestSessionId,
    itemsCount: Math.max(0, input.itemsCount),
    orderFormId: input.orderFormId,
    paymentSystemId: input.paymentSystemId,
    paymentSystemName: input.paymentSystemName,
    provider: input.provider,
    status: input.status ?? "STARTED",
    transactionId: input.transactionId,
  };
}

export function saveStorefrontPaymentAttempt(attempt: StorefrontPaymentAttempt) {
  if (!canUseBrowserStorage()) {
    return;
  }

  localStorage.setItem(PAYMENT_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
}

export function readStorefrontPaymentAttempt(now: Date = new Date()): StorefrontPaymentAttempt | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const raw = localStorage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const attempt = parseStorefrontPaymentAttempt(raw);
  if (!attempt || Date.parse(attempt.expiresAtIso) <= now.getTime()) {
    clearStorefrontPaymentAttempt();
    return null;
  }

  return attempt;
}

export function updateStorefrontPaymentAttemptStatus(status: StorefrontPaymentAttemptStatus) {
  const attempt = readStorefrontPaymentAttempt();
  if (!attempt) {
    return null;
  }

  const updated = {
    ...attempt,
    status,
  };
  saveStorefrontPaymentAttempt(updated);
  return updated;
}

export function clearStorefrontPaymentAttempt() {
  if (canUseBrowserStorage()) {
    localStorage.removeItem(PAYMENT_ATTEMPT_STORAGE_KEY);
  }
}

export function createStorefrontPaymentReceipt(input: {
  attempt?: StorefrontPaymentAttempt | null;
  capturedAt?: Date;
  status?: string;
  transaction: StorefrontPaymentTransaction;
}): StorefrontPaymentReceipt {
  const capturedAt = input.capturedAt ?? new Date();
  const provider = input.attempt?.provider ?? inferPaymentProvider({
    paymentSystemId: input.transaction.paymentSystemId,
    raw: input.transaction.raw,
  });
  const transactionId = input.transaction.transactionId || input.attempt?.transactionId || "";
  const correlationId = input.attempt?.correlationId;

  return {
    amountMinor: input.transaction.amountMinor ?? input.attempt?.amountMinor,
    capturedAtIso: capturedAt.toISOString(),
    correlationId,
    currency: input.transaction.currency ?? input.attempt?.currency,
    expiresAtIso: new Date(capturedAt.getTime() + PAYMENT_RECEIPT_TTL_MS).toISOString(),
    orderFormId: input.attempt?.orderFormId,
    paymentSystemId: input.transaction.paymentSystemId ?? input.attempt?.paymentSystemId,
    paymentSystemName: input.attempt?.paymentSystemName,
    provider: provider === "paypal" ? "paypal" : "stripe",
    status: input.status ?? input.transaction.status ?? "PENDING",
    supportReference: [transactionId, correlationId].filter(Boolean).join(":"),
    transactionId,
  };
}

export function saveStorefrontPaymentReceipt(receipt: StorefrontPaymentReceipt) {
  if (!canUseBrowserStorage() || !receipt.transactionId) {
    return;
  }

  localStorage.setItem(PAYMENT_RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
}

export function readStorefrontPaymentReceipt(now: Date = new Date()): StorefrontPaymentReceipt | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const raw = localStorage.getItem(PAYMENT_RECEIPT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const receipt = parseStorefrontPaymentReceipt(raw);
  if (!receipt || Date.parse(receipt.expiresAtIso) <= now.getTime()) {
    clearStorefrontPaymentReceipt();
    return null;
  }

  return receipt;
}

export function clearStorefrontPaymentReceipt() {
  if (canUseBrowserStorage()) {
    localStorage.removeItem(PAYMENT_RECEIPT_STORAGE_KEY);
  }
}

export function makeStorefrontPaymentReturnOnceKey(input: {
  provider: Exclude<StorefrontPaymentProvider, "unknown">;
  transactionId: string;
  pspReference: string;
}) {
  return [
    PAYMENT_RETURN_ONCE_PREFIX,
    input.provider,
    input.transactionId.trim(),
    input.pspReference.trim(),
  ].join(":");
}

export function hasProcessedStorefrontPaymentReturn(key: string) {
  return canUseBrowserStorage() && sessionStorage.getItem(key) === "1";
}

export function markStorefrontPaymentReturnProcessed(key: string) {
  if (canUseBrowserStorage()) {
    sessionStorage.setItem(key, "1");
  }
}

export function sanitizePspReturnSearchParams(searchParams: URLSearchParams) {
  const output: Record<string, string> = {};
  let accepted = 0;

  for (const [key, value] of searchParams.entries()) {
    if (accepted >= 40) {
      break;
    }
    if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) {
      continue;
    }
    output[key] = value.slice(0, 2048);
    accepted += 1;
  }

  return output;
}

function buildStorefrontPaymentParams(input: StorefrontPaymentsRequestInput) {
  const params = new URLSearchParams({
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
  });

  appendOptionalParam(params, "shopId", input.shopId);
  appendOptionalParam(params, "shopAlias", input.shopAlias);
  appendOptionalParam(params, "locale", input.locale);
  appendOptionalParam(params, "currency", input.currency);
  appendOptionalParam(params, "country", input.country);
  appendOptionalParam(params, "guestSessionId", input.guestSessionId);

  return params;
}

function paymentRequestInit(method: string, body: Record<string, unknown>, correlationId?: string): RequestInit {
  const headers = new Headers({
    "content-type": "application/json",
  });

  if (correlationId) {
    headers.set("x-correlation-id", correlationId);
  }

  return {
    body: JSON.stringify(body),
    headers,
    method,
  };
}

function paymentCorrelationHeaders(correlationId: string): Headers {
  const headers = new Headers();
  headers.set("x-correlation-id", correlationId);
  return headers;
}

async function requestStorefrontPaymentJson(
  path: string,
  init: RequestInit | undefined,
  paymentsFetch: StorefrontPaymentsFetch,
) {
  const response = await paymentsFetch(path, {
    cache: "no-store",
    ...init,
  });
  const payload = await response.json().catch(() => null) as unknown;

  if (!response.ok) {
    throw new StorefrontPaymentsApiError(readPaymentErrorMessage(payload, response.status), {
      correlationId: response.headers.get("x-correlation-id") ?? undefined,
      payload,
      status: response.status,
    });
  }

  return payload;
}

function defaultPaymentsFetch(path: string, init?: RequestInit) {
  return fetch(path, init);
}

function parseStorefrontPaymentAttempt(raw: string): StorefrontPaymentAttempt | null {
  const value = asRecord(safeJsonParse(raw));
  const provider = asString(value.provider);

  if (provider !== "paypal" && provider !== "stripe") {
    return null;
  }

  const actor: StorefrontPaymentActor = value.actor === "customer" ? "customer" : "guest";
  const attemptProvider: Exclude<StorefrontPaymentProvider, "unknown"> = provider === "paypal" ? "paypal" : "stripe";
  const attempt = {
    actor,
    amountMinor: asNumber(value.amountMinor) ?? 0,
    correlationId: asString(value.correlationId) ?? "",
    createdAtIso: asString(value.createdAtIso) ?? "",
    currency: asString(value.currency) ?? "",
    customerId: asString(value.customerId),
    expiresAtIso: asString(value.expiresAtIso) ?? "",
    guestSessionId: asString(value.guestSessionId),
    itemsCount: asNumber(value.itemsCount) ?? 0,
    orderFormId: asString(value.orderFormId) ?? "",
    paymentSystemId: asString(value.paymentSystemId) ?? "",
    paymentSystemName: asString(value.paymentSystemName) ?? "",
    provider: attemptProvider,
    status: normalizeAttemptStatus(value.status),
    transactionId: asString(value.transactionId) ?? "",
  };

  const required = [
    attempt.correlationId,
    attempt.createdAtIso,
    attempt.currency,
    attempt.expiresAtIso,
    attempt.orderFormId,
    attempt.paymentSystemId,
    attempt.transactionId,
  ];

  return required.every(Boolean) ? attempt : null;
}

function parseStorefrontPaymentReceipt(raw: string): StorefrontPaymentReceipt | null {
  const value = asRecord(safeJsonParse(raw));
  const provider = asString(value.provider);
  if (provider !== "paypal" && provider !== "stripe") {
    return null;
  }

  const receipt: StorefrontPaymentReceipt = {
    amountMinor: asNumber(value.amountMinor),
    capturedAtIso: asString(value.capturedAtIso) ?? "",
    correlationId: asString(value.correlationId),
    currency: asString(value.currency),
    expiresAtIso: asString(value.expiresAtIso) ?? "",
    orderFormId: asString(value.orderFormId),
    paymentSystemId: asString(value.paymentSystemId),
    paymentSystemName: asString(value.paymentSystemName),
    provider: provider === "paypal" ? "paypal" : "stripe",
    status: asString(value.status) ?? "PENDING",
    supportReference: asString(value.supportReference) ?? "",
    transactionId: asString(value.transactionId) ?? "",
  };

  return receipt.capturedAtIso && receipt.expiresAtIso && receipt.supportReference && receipt.transactionId
    ? receipt
    : null;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function normalizeAttemptStatus(value: unknown): StorefrontPaymentAttemptStatus {
  const status = asString(value);
  switch (status) {
    case "REDIRECTED":
    case "RETURNED":
    case "SETTLED":
    case "CANCELLED":
    case "FAILED":
      return status;
    default:
      return "STARTED";
  }
}

function normalizeNextActionType(value: unknown): StorefrontPaymentNextActionType {
  const normalized = asString(value)?.toUpperCase();
  switch (normalized) {
    case "REDIRECT":
    case "CLIENT_CONFIRMATION":
    case "AWAIT_WEBHOOK":
    case "NONE":
      return normalized;
    default:
      return "UNKNOWN";
  }
}

function normalizeInstallments(value: unknown) {
  return listFromEnvelope(value, ["items", "installments"])
    .map((item) => {
      if (typeof item === "number") {
        return item;
      }
      const record = asRecord(item);
      return asNumber(record.count) ?? asNumber(record.installments) ?? asNumber(record.value);
    })
    .filter((item): item is number => typeof item === "number" && item > 0);
}

function listFromEnvelope(value: unknown, keys: string[]) {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);
  for (const key of keys) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  return [];
}

function readPaymentErrorMessage(payload: unknown, status: number) {
  const record = asRecord(payload);
  const message = record.message;

  if (Array.isArray(message)) {
    return message.map(String).join("; ");
  }

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  return `Payments BFF responded with ${status}`;
}

function appendOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value?.trim()) {
    params.set(key, value.trim());
  }
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined" && typeof sessionStorage !== "undefined";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
