import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import { createBffHeaders } from "../../shared/bff/headers";
import { bffBaseUrl } from "../../shared/config/env";
import {
  getStorefrontCustomerAuthorizationHeader,
  getStorefrontCustomerSession,
} from "./storefront-customer-session";
import { getStorefrontContext } from "./storefront-context";

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
  caseId?: string;
  status?: string;
};

export type StorefrontAccountData = {
  profile: StorefrontCustomerProfile;
  avatarOptions: StorefrontAvatarOption[];
  addresses: BffResult<StorefrontAddressBook>;
  purchases: BffResult<StorefrontPurchasesData>;
  invoices: BffResult<StorefrontInvoicesData>;
  sessions: BffResult<StorefrontDeviceSessionsData>;
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

function accountPath(path: string, extra?: Record<string, string | undefined>) {
  const context = getStorefrontContext();
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

function makeAuthUrl(path: string) {
  const base = bffBaseUrl.endsWith("/") ? bffBaseUrl.slice(0, -1) : bffBaseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function makeCorrelationId() {
  return `ui-storefront-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readMutationError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => undefined)) as unknown;
    if (typeof payload === "object" && payload !== null && "message" in payload) {
      const message = (payload as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message.map(String).join("; ");
      }
      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    }
  }

  return response.text().catch(() => "");
}

export async function getStorefrontAccountData({
  invoicesLimit = "5",
  invoicesOffset = "0",
  purchasesLimit = "5",
  purchasesOffset = "0",
}: {
  invoicesLimit?: string;
  invoicesOffset?: string;
  purchasesLimit?: string;
  purchasesOffset?: string;
} = {}): Promise<BffResult<StorefrontAccountData>> {
  const session = await getStorefrontCustomerSession();
  const headers = await storefrontAuthHeaders();
  const context = getStorefrontContext();

  if (!session || !headers) {
    return {
      ok: false,
      status: 401,
      error: "Cliente no autenticado.",
      correlationId: "storefront-account-local",
    };
  }

  const [profileResult, avatarResult, addressesResult, purchasesResult, invoicesResult, sessionsResult] = await Promise.all([
    requestBff<ProfileResponse>(accountPath("/storefront/me/profile"), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestBff<AvatarOptionsResponse>(accountPath("/storefront/me/avatar-options"), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestBff<StorefrontAddressBook>(accountPath("/storefront/me/addresses"), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestBff<StorefrontPurchasesData>(accountPath("/storefront/me/purchases", {
      limit: purchasesLimit,
      offset: purchasesOffset,
    }), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestBff<StorefrontInvoicesData>(accountPath("/storefront/me/invoices", {
      limit: invoicesLimit,
      offset: invoicesOffset,
    }), {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
    requestBff<StorefrontDeviceSessionsData>("/auth/sessions", {
      withAuth: false,
      context: { locale: context.locale },
      init: { headers },
    }),
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

  return requestBff<ProfileResponse>(accountPath("/storefront/me/profile"), {
    withAuth: false,
    context: { locale: getStorefrontContext().locale },
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

  return requestBff<StorefrontAfterSalesCaseResponse>(accountPath("/storefront/me/after-sales/cases"), {
    withAuth: false,
    context: { locale: getStorefrontContext().locale },
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

export async function createStorefrontCustomerAddress(
  payload: Record<string, unknown>,
): Promise<BffResult<StorefrontAddressBook>> {
  const headers = await storefrontAuthHeaders();

  if (!headers) {
    return unauthenticatedAddressResult();
  }

  return requestBff<StorefrontAddressBook>(accountPath("/storefront/me/addresses"), {
    withAuth: false,
    context: { locale: getStorefrontContext().locale },
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

  return requestBff<StorefrontAddressBook>(accountPath(`/storefront/me/addresses/${encodeURIComponent(addressId)}`), {
    withAuth: false,
    context: { locale: getStorefrontContext().locale },
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

  return requestBff<StorefrontAddressBook>(accountPath(`/storefront/me/addresses/${encodeURIComponent(addressId)}`), {
    withAuth: false,
    context: { locale: getStorefrontContext().locale },
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

  return requestBff<StorefrontAddressBook>(accountPath(`/storefront/me/addresses/${encodeURIComponent(addressId)}/default-${defaultKind}`), {
    withAuth: false,
    context: { locale: getStorefrontContext().locale },
    init: {
      method: "PATCH",
      headers,
    },
  });
}

export async function logoutCurrentStorefrontSession(): Promise<BffResult<void>> {
  const headers = await storefrontAuthHeaders();
  const correlationId = makeCorrelationId();

  if (!headers) {
    return unauthenticatedSessionMutationResult(correlationId);
  }

  try {
    const response = await fetch(makeAuthUrl("/auth/sessions/logout-current"), {
      method: "POST",
      cache: "no-store",
      headers: createBffHeaders({
        correlationId,
        initHeaders: headers,
        locale: getStorefrontContext().locale,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: await readMutationError(response) || `BFF responded with ${response.status}`,
        correlationId,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: undefined,
      correlationId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "BFF request failed",
      correlationId,
    };
  }
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

  return requestBff<StorefrontLogoutAllSessionsResponse>("/auth/sessions/logout-all", {
    withAuth: false,
    context: { locale: getStorefrontContext().locale },
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
