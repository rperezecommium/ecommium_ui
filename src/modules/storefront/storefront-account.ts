import {
  requestStorefrontBff,
  requestStorefrontBffResponse,
} from "../../shared/bff/storefront-client";
import type { BffResult } from "../../shared/bff/types";
import {
  getStorefrontCustomerAuthorizationHeader,
  getStorefrontCustomerSession,
} from "./storefront-customer-session";
import { getStorefrontContext, type StorefrontContext } from "./storefront-context";

export type StorefrontAvatarOption = {
  avatarId: string;
  kind: "human" | "animal";
  label: string;
};

export type StorefrontCustomerProfile = {
  customerId: string;
  organizationId: string;
  shopId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarId: string | null;
  phone: string | null;
  clientPreferencesData?: {
    locale?: string;
    optinNewsLetter?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type StorefrontCustomerAddress = {
  addressId: string;
  alias: string;
  addressType: string;
  addressRole?: "SHIPPING" | "BILLING" | "BOTH" | string;
  receiverName: string;
  street: string;
  number: string;
  neighborhood?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  complement?: string | null;
  reference?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StorefrontAddressBook = {
  maxAddresses: number;
  count: number;
  defaultShippingAddressId?: string | null;
  defaultBillingAddressId?: string | null;
  items: StorefrontCustomerAddress[];
};

export type StorefrontPurchaseLine = {
  lineId: string;
  productId: string;
  variantId: string;
  productSlug: string | null;
  productUrlPath: string | null;
  name: string;
  imageUrl: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
};

export type StorefrontPurchaseShipping = {
  status: "PENDING_CONFIRMATION" | "PREPARING_SHIPMENT" | "IN_TRANSIT" | "DELIVERED" | "ISSUE" | "NOT_AVAILABLE";
  trackingNumber: string | null;
  trackingUrl: string | null;
  isTrackingAvailable: boolean;
  carrier: {
    id: string | null;
    label: string | null;
    logoUrl: string | null;
    trackingUrlTemplate: string | null;
  };
  selectedSla: string | null;
  shippingEstimate: string | null;
  deliveryPromise: {
    minDate: string;
    maxDate: string;
  } | null;
  milestones: Array<{
    code: string;
    label: string;
    completed: boolean;
    current: boolean;
    occurredAt: string | null;
  }>;
};

export type StorefrontPurchase = {
  purchaseId: string;
  orderId: string;
  orderReference: string | null;
  customerId: string;
  organizationId: string;
  shopId: string;
  status: string;
  isPaid: boolean;
  currency: string;
  totalAmountMinor: number;
  itemsCount: number;
  items: StorefrontPurchaseLine[];
  placedAt: string;
  sourceEventId: string;
  recordedAt: string;
  shipping?: StorefrontPurchaseShipping;
};

export type StorefrontPurchasesData = {
  customerId: string;
  total: number;
  limit: number;
  offset: number;
  items: StorefrontPurchase[];
};

export type StorefrontInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  orderId: string | null;
  status: string;
  currency: string;
  totalAmountMinor: number;
  issuedAt: string;
  dueAt?: string | null;
  documentStatus?: string | null;
};

export type StorefrontInvoicesData = {
  customerId: string;
  total: number;
  limit: number;
  offset: number;
  items: StorefrontInvoice[];
};

export type StorefrontDeviceSession = {
  sessionId: string;
  organizationId?: string;
  shopId?: string;
  principalType: "CUSTOMER" | "EMPLOYEE" | string;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
  device: {
    deviceId: string | null;
    deviceName: string | null;
    userAgent: string | null;
    ipAddress: string | null;
  };
};

export type StorefrontDeviceSessionsData = {
  sessions: StorefrontDeviceSession[];
  total: number;
};

export type StorefrontLogoutAllSessionsResponse = {
  revokedSessions: number;
  includeCurrent: boolean;
  currentSessionRevoked: boolean;
};

export type StorefrontAfterSalesCaseResponse = {
  caseId: string;
  caseType: string;
  status: string;
  reasonCode: string | null;
  submittedAt: string | null;
  updatedAt: string;
  lastActivityAt?: string;
  lastMessagePreview?: string | null;
  canReply: boolean;
};

export type StorefrontAfterSalesCaseDetail = StorefrontAfterSalesCaseResponse & {
  reviewedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  items: Array<{ name: string; quantityRequested: number; quantityApproved: number | null; status: string }>;
  messages: Array<{ messageId: string; author: "CUSTOMER" | "STORE"; kind: "OPENING" | "MESSAGE" | "STATUS"; body: string; createdAt: string }>;
  attachments: Array<{ privateEvidenceId: string; messageId: string | null; mimeType: "image/jpeg"; name: string; createdAt: string }>;
};

export type StorefrontAfterSalesCasesData = {
  items: StorefrontAfterSalesCaseResponse[];
  total: number;
  limit: number;
  offset: number;
};

export type StorefrontAccountData = {
  profile: StorefrontCustomerProfile;
  avatarOptions: StorefrontAvatarOption[];
  addresses: BffResult<StorefrontAddressBook>;
  purchases: BffResult<StorefrontPurchasesData>;
  invoices: BffResult<StorefrontInvoicesData>;
  sessions: BffResult<StorefrontDeviceSessionsData>;
  afterSales: BffResult<StorefrontAfterSalesCasesData>;
  selectedAfterSalesCase: BffResult<StorefrontAfterSalesCaseDetail> | null;
};

type ProfileResponse = {
  profile: StorefrontCustomerProfile;
  security?: {
    credentialsUpdatedAt?: string;
    sessionsRevoked?: number;
  };
};

type AvatarOptionsResponse = {
  items: StorefrontAvatarOption[];
  total?: number;
};

const fallbackAvatarOptions: StorefrontAvatarOption[] = [
  { avatarId: "human-01", kind: "human", label: "Human 01" },
  { avatarId: "human-02", kind: "human", label: "Human 02" },
  { avatarId: "human-03", kind: "human", label: "Human 03" },
  { avatarId: "human-04", kind: "human", label: "Human 04" },
  { avatarId: "human-05", kind: "human", label: "Human 05" },
  { avatarId: "animal-cat", kind: "animal", label: "Cat" },
  { avatarId: "animal-dog", kind: "animal", label: "Dog" },
  { avatarId: "animal-fox", kind: "animal", label: "Fox" },
  { avatarId: "animal-panda", kind: "animal", label: "Panda" },
  { avatarId: "animal-owl", kind: "animal", label: "Owl" },
];

function accountPath(
  context: StorefrontContext,
  path: string,
  extra?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });

  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return `${path}?${params.toString()}`;
}

async function storefrontAuthHeaders() {
  const authorization = await getStorefrontCustomerAuthorizationHeader();
  return authorization ? { authorization } : null;
}

export async function getStorefrontAccountData({
  invoicesLimit = "5",
  invoicesOffset = "0",
  purchasesLimit = "5",
  purchasesOffset = "0",
  afterSalesCaseId,
  afterSalesLimit = "10",
  afterSalesOffset = "0",
}: {
  invoicesLimit?: string;
  invoicesOffset?: string;
  purchasesLimit?: string;
  purchasesOffset?: string;
  afterSalesCaseId?: string;
  afterSalesLimit?: string;
  afterSalesOffset?: string;
} = {}): Promise<BffResult<StorefrontAccountData>> {
  const session = await getStorefrontCustomerSession();
  const headers = await storefrontAuthHeaders();
  const context = await getStorefrontContext();

  if (!session || !headers) {
    return {
      ok: false,
      status: 401,
      error: "Cliente no autenticado.",
      correlationId: "storefront-account-local",
    };
  }

  const [profileResult, avatarResult, addressesResult, purchasesResult, invoicesResult, sessionsResult, afterSalesResult, selectedAfterSalesCase] = await Promise.all([
    requestStorefrontBff<ProfileResponse>(accountPath(context, "/storefront/me/profile"), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestStorefrontBff<AvatarOptionsResponse>(accountPath(context, "/storefront/me/avatar-options"), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestStorefrontBff<StorefrontAddressBook>(accountPath(context, "/storefront/me/addresses"), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestStorefrontBff<StorefrontPurchasesData>(accountPath(context, "/storefront/me/purchases", {
      limit: purchasesLimit,
      offset: purchasesOffset,
    }), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestStorefrontBff<StorefrontInvoicesData>(accountPath(context, "/storefront/me/invoices", {
      limit: invoicesLimit,
      offset: invoicesOffset,
    }), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestStorefrontBff<StorefrontDeviceSessionsData>("/auth/sessions", {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestStorefrontBff<StorefrontAfterSalesCasesData>(accountPath(context, "/storefront/me/after-sales/cases", {
      limit: afterSalesLimit,
      offset: afterSalesOffset,
    }), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    afterSalesCaseId
      ? requestStorefrontBff<StorefrontAfterSalesCaseDetail>(accountPath(context, `/storefront/me/after-sales/cases/${encodeURIComponent(afterSalesCaseId)}`), {
          withAuth: false,
          context: { locale: context.locale },
          init: { headers },
        })
      : Promise.resolve(null),
  ]);

  if (!profileResult.ok) {
    return profileResult;
  }

  return {
    ok: true,
    status: profileResult.status,
    correlationId: profileResult.correlationId,
    data: {
      profile: profileResult.data.profile,
      avatarOptions: avatarResult.ok && avatarResult.data.items.length >= 10
        ? avatarResult.data.items
        : fallbackAvatarOptions,
      addresses: addressesResult,
      purchases: purchasesResult,
      invoices: invoicesResult,
      sessions: sessionsResult,
      afterSales: afterSalesResult,
      selectedAfterSalesCase,
    },
  };
}

export async function patchStorefrontCustomerProfile(
  payload: Record<string, unknown>,
): Promise<BffResult<ProfileResponse>> {
  const headers = await storefrontAuthHeaders();

  if (!headers) {
    return {
      ok: false,
      status: 401,
      error: "Cliente no autenticado.",
      correlationId: "storefront-account-local",
    };
  }

  const context = await getStorefrontContext();

  return requestStorefrontBff<ProfileResponse>(accountPath(context, "/storefront/me/profile"), {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "PATCH",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  });
}

export async function createStorefrontAfterSalesCase(
  payload: Record<string, unknown>,
): Promise<BffResult<StorefrontAfterSalesCaseResponse>> {
  const headers = await storefrontAuthHeaders();

  if (!headers) {
    return {
      ok: false,
      status: 401,
      error: "Cliente no autenticado.",
      correlationId: "storefront-after-sales-local",
    };
  }

  const context = await getStorefrontContext();

  return requestStorefrontBff<StorefrontAfterSalesCaseResponse>(accountPath(context, "/storefront/me/after-sales/cases"), {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  });
}

export async function replyToStorefrontAfterSalesCase(
  caseId: string,
  body: string,
  idempotencyKey: string,
): Promise<BffResult<StorefrontAfterSalesCaseDetail>> {
  return afterSalesJsonMutation(`/storefront/me/after-sales/cases/${encodeURIComponent(caseId)}/messages`, {
    body,
    idempotencyKey,
  });
}

export async function uploadStorefrontAfterSalesEvidence(
  input: {
    caseId: string;
    originalFileName: string;
    mimeType: string;
    contentBase64: string;
    messageId?: string | null;
    idempotencyKey: string;
  },
): Promise<BffResult<StorefrontAfterSalesCaseDetail>> {
  return afterSalesJsonMutation(`/storefront/me/after-sales/cases/${encodeURIComponent(input.caseId)}/evidences`, input);
}

async function afterSalesJsonMutation(
  path: string,
  payload: Record<string, unknown>,
): Promise<BffResult<StorefrontAfterSalesCaseDetail>> {
  const headers = await storefrontAuthHeaders();
  if (!headers) {
    return { ok: false, status: 401, error: "Cliente no autenticado.", correlationId: "storefront-after-sales-local" };
  }
  const context = await getStorefrontContext();
  return requestStorefrontBff<StorefrontAfterSalesCaseDetail>(accountPath(context, path), {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  });
}

export async function createStorefrontCustomerAddress(
  payload: Record<string, unknown>,
): Promise<BffResult<StorefrontAddressBook>> {
  const headers = await storefrontAuthHeaders();

  if (!headers) {
    return unauthenticatedAddressResult();
  }

  const context = await getStorefrontContext();

  return requestStorefrontBff<StorefrontAddressBook>(accountPath(context, "/storefront/me/addresses"), {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  });
}

export async function patchStorefrontCustomerAddress(
  addressId: string,
  payload: Record<string, unknown>,
): Promise<BffResult<StorefrontAddressBook>> {
  const headers = await storefrontAuthHeaders();

  if (!headers) {
    return unauthenticatedAddressResult();
  }

  const context = await getStorefrontContext();

  return requestStorefrontBff<StorefrontAddressBook>(accountPath(context, `/storefront/me/addresses/${encodeURIComponent(addressId)}`), {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "PATCH",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  });
}

export async function deleteStorefrontCustomerAddress(
  addressId: string,
): Promise<BffResult<StorefrontAddressBook>> {
  const headers = await storefrontAuthHeaders();

  if (!headers) {
    return unauthenticatedAddressResult();
  }

  const context = await getStorefrontContext();

  return requestStorefrontBff<StorefrontAddressBook>(accountPath(context, `/storefront/me/addresses/${encodeURIComponent(addressId)}`), {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "DELETE",
      headers,
    },
  });
}

export async function setStorefrontCustomerAddressDefault(
  addressId: string,
  defaultKind: "shipping" | "billing",
): Promise<BffResult<StorefrontAddressBook>> {
  const headers = await storefrontAuthHeaders();

  if (!headers) {
    return unauthenticatedAddressResult();
  }

  const context = await getStorefrontContext();

  return requestStorefrontBff<StorefrontAddressBook>(accountPath(context, `/storefront/me/addresses/${encodeURIComponent(addressId)}/default-${defaultKind}`), {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "PATCH",
      headers,
    },
  });
}

export async function logoutCurrentStorefrontSession(): Promise<BffResult<void>> {
  const headers = await storefrontAuthHeaders();

  if (!headers) {
    return unauthenticatedSessionMutationResult("storefront-sessions-local");
  }

  const context = await getStorefrontContext();

  const result = await requestStorefrontBffResponse("/auth/sessions/logout-current", {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "POST",
      headers,
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: result.status,
      correlationId: result.correlationId,
    };
  }

  return {
    ok: true,
    status: result.status,
    data: undefined,
    correlationId: result.correlationId,
  };
}

export async function logoutAllStorefrontSessions(
  includeCurrent: boolean,
): Promise<BffResult<StorefrontLogoutAllSessionsResponse>> {
  const headers = await storefrontAuthHeaders();

  if (!headers) {
    return {
      ok: false,
      status: 401,
      error: "Cliente no autenticado.",
      correlationId: "storefront-sessions-local",
    };
  }

  const context = await getStorefrontContext();

  return requestStorefrontBff<StorefrontLogoutAllSessionsResponse>("/auth/sessions/logout-all", {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({ includeCurrent }),
    },
  });
}

function unauthenticatedAddressResult(): BffResult<StorefrontAddressBook> {
  return {
    ok: false,
    status: 401,
    error: "Cliente no autenticado.",
    correlationId: "storefront-address-book-local",
  };
}

function unauthenticatedSessionMutationResult(correlationId: string): BffResult<void> {
  return {
    ok: false,
    status: 401,
    error: "Cliente no autenticado.",
    correlationId,
  };
}
