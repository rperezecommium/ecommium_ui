import { cookies } from "next/headers";
import { getStorefrontContext, type StorefrontContext } from "./storefront-context";

export type StorefrontCustomerSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  sessionId: string;
  customerId: string;
  email: string;
  organizationId?: string;
  shopId?: string;
  scope: "storefront";
};

export type StorefrontCustomerSessionInput = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  sessionId: string;
  customerId: string;
  email: string;
  organizationId?: string;
  shopId?: string;
  scope: "storefront";
};

export const storefrontCustomerSessionCookieName =
  "ecommium_customer_session";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseSession(value: string | undefined): StorefrontCustomerSession | null {
  if (!value) {
    return null;
  }

  try {
    const root = asRecord(JSON.parse(value));
    const session: StorefrontCustomerSession = {
      accessToken: asString(root.accessToken),
      refreshToken: asString(root.refreshToken),
      expiresAt: asString(root.expiresAt),
      sessionId: asString(root.sessionId),
      customerId: asString(root.customerId),
      email: asString(root.email),
      organizationId: asString(root.organizationId) || undefined,
      shopId: asString(root.shopId) || undefined,
      scope: root.scope === "storefront" ? "storefront" : "storefront",
    };

    if (!session.accessToken || !session.sessionId || !session.customerId || !session.email) {
      return null;
    }

    if (session.expiresAt && Number.isFinite(Date.parse(session.expiresAt)) && Date.parse(session.expiresAt) <= Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function isStorefrontCustomerSessionForContext(
  session: Pick<StorefrontCustomerSession, "organizationId" | "shopId">,
  context: Pick<StorefrontContext, "organizationId" | "shopId">,
) {
  return session.organizationId === context.organizationId && session.shopId === context.shopId;
}

export async function getStorefrontCustomerSession(): Promise<StorefrontCustomerSession | null> {
  const cookieStore = await cookies();
  const session = parseSession(cookieStore.get(storefrontCustomerSessionCookieName)?.value);
  if (!session || !isStorefrontCustomerSessionForContext(session, await getStorefrontContext())) {
    return null;
  }
  return session;
}

export async function getStorefrontCustomerAuthorizationHeader(): Promise<string | null> {
  const session = await getStorefrontCustomerSession();
  return session ? `Bearer ${session.accessToken}` : null;
}

export async function saveStorefrontCustomerSession(input: StorefrontCustomerSessionInput): Promise<void> {
  if (!isStorefrontCustomerSessionForContext(input, await getStorefrontContext())) {
    throw new Error("La sesion Customer no coincide con el tenant Storefront activo.");
  }

  const cookieStore = await cookies();
  const expiresAt = new Date(
    Date.now() + Math.max(0, input.expiresInSeconds) * 1000,
  ).toISOString();

  cookieStore.set(
    storefrontCustomerSessionCookieName,
    JSON.stringify({
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt,
      sessionId: input.sessionId,
      customerId: input.customerId,
      email: input.email,
      organizationId: input.organizationId,
      shopId: input.shopId,
      scope: input.scope,
    } satisfies StorefrontCustomerSession),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  );
}

export async function updateStorefrontCustomerSessionEmail(email: string): Promise<void> {
  const session = await getStorefrontCustomerSession();
  if (!session) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(
    storefrontCustomerSessionCookieName,
    JSON.stringify({ ...session, email }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  );
}

export async function clearStorefrontCustomerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(storefrontCustomerSessionCookieName);
}
