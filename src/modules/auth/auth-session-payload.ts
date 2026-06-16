import type { AdminSession } from "../../shared/auth/session";

type RawAuthPayload = Record<string, unknown>;
const pendingAdminContextShopId = "__admin_context_pending__";

export type ParsedAuthSessionOptions = {
  requireAccessToken: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = `${base64}${"=".repeat(padLength)}`;

  if (typeof atob === "function") {
    return atob(padded);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf-8");
  }

  return "";
}

function decodeJwtPayload(accessToken?: string): Record<string, unknown> {
  if (!accessToken) {
    return {};
  }

  const [, payloadSegment] = accessToken.split(".");
  if (!payloadSegment) {
    return {};
  }

  try {
    return asRecord(JSON.parse(decodeBase64Url(payloadSegment)));
  } catch {
    return {};
  }
}

function normalizePrincipalType(value: unknown): AdminSession["principalType"] {
  const principalType = asString(value).toUpperCase();

  if (principalType === "ADMIN" || principalType === "EMPLOYEE" || principalType === "CUSTOMER") {
    return principalType;
  }

  return "EMPLOYEE";
}

function normalizeScope(value: unknown): AdminSession["scope"] {
  return asString(value).toLowerCase() === "admin" ? "admin" : "storefront";
}

function profileFromPrincipalType(principalType: AdminSession["principalType"]): AdminSession["profile"] {
  if (principalType === "ADMIN") {
    return "Admin";
  }

  if (principalType === "EMPLOYEE") {
    return "Operator";
  }

  return "Viewer";
}

function resolveExpiresAt(input: {
  expiresAt?: string;
  expiresInSeconds?: number;
  tokenExpSeconds?: number;
}) {
  if (input.expiresAt) {
    const parsed = new Date(input.expiresAt).getTime();
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  if (typeof input.expiresInSeconds === "number" && Number.isFinite(input.expiresInSeconds)) {
    return new Date(Date.now() + Math.max(0, input.expiresInSeconds) * 1000).toISOString();
  }

  if (typeof input.tokenExpSeconds === "number" && Number.isFinite(input.tokenExpSeconds)) {
    return new Date(input.tokenExpSeconds * 1000).toISOString();
  }

  return undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function firstStringArray(...values: unknown[]) {
  for (const value of values) {
    const items = asStringArray(value);
    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

export function parseAuthSessionPayload(
  value: unknown,
  options: ParsedAuthSessionOptions,
): AdminSession {
  const root = asRecord(value) as RawAuthPayload;
  const tokens = asRecord(root.tokens);
  const session = asRecord(root.session);
  const profile = asRecord(root.profile);
  const principal = asRecord(root.principal ?? root.user ?? session.principal ?? session.user);
  const accessToken =
    asString(tokens.accessToken) ||
    asString(root.accessToken) ||
    asString(root.token) ||
    asString(session.accessToken);
  const refreshToken =
    asString(tokens.refreshToken) ||
    asString(root.refreshToken) ||
    asString(session.refreshToken);
  const tokenClaims = decodeJwtPayload(accessToken);
  const principalType = normalizePrincipalType(
    profile.principalType ??
      session.principalType ??
      principal.principalType ??
      root.principalType ??
      tokenClaims.principalType,
  );
  const scope = normalizeScope(session.scope ?? principal.scope ?? root.scope ?? tokenClaims.scope);
  const roles = firstStringArray(principal.roles, session.roles, root.roles, tokenClaims.roles);
  const permissions = firstStringArray(
    principal.permissions,
    session.permissions,
    root.permissions,
    tokenClaims.permissions,
  );

  if (options.requireAccessToken && !accessToken) {
    throw new Error("accessToken ausente en respuesta de autenticacion");
  }

  if ((principalType === "ADMIN" || principalType === "EMPLOYEE") && scope !== "admin") {
    throw new Error("scope invalido para principal admin");
  }

  const expiresInSeconds = asNumber(tokens.expiresInSeconds ?? root.expiresInSeconds ?? session.expiresInSeconds);
  const tokenExpSeconds = asNumber(tokenClaims.exp);
  const email = asString(principal.email ?? profile.email ?? tokenClaims.email);
  const employeeId =
    asString(principal.id) ||
    asString(principal.employeeId) ||
    asString(principal.sub) ||
    asString(profile.principalId) ||
    asString(tokenClaims.sub) ||
    email ||
    "employee";

  return {
    accessToken: accessToken || undefined,
    refreshToken: refreshToken || undefined,
    expiresAt: resolveExpiresAt({
      expiresAt: asString(session.expiresAt ?? root.expiresAt),
      expiresInSeconds,
      tokenExpSeconds,
    }),
    sessionId: asString(session.sessionId ?? root.sessionId ?? tokenClaims.sessionId) || undefined,
    employeeId,
    name:
      asString(principal.fullName) ||
      asString(principal.name) ||
      asString(principal.displayName) ||
      email ||
      "Employee",
    email,
    profile: profileFromPrincipalType(principalType),
    principalType,
    scope,
    roles,
    permissions: permissions.length > 0 ? permissions : ["admin:view"],
    organizationId:
      asString(session.organizationId) ||
      asString(principal.organizationId) ||
      asString(root.organizationId) ||
      asString(tokenClaims.organizationId) ||
      undefined,
    shopId: (() => {
      const shopId =
        asString(session.shopId) ||
        asString(principal.shopId) ||
        asString(root.shopId) ||
        asString(tokenClaims.shopId);
      return shopId && shopId !== pendingAdminContextShopId ? shopId : undefined;
    })(),
  };
}

export function mergeAuthSessions(loginSession: AdminSession, meSession: AdminSession): AdminSession {
  return {
    ...loginSession,
    ...meSession,
    accessToken: meSession.accessToken ?? loginSession.accessToken,
    refreshToken: meSession.refreshToken ?? loginSession.refreshToken,
    expiresAt: meSession.expiresAt ?? loginSession.expiresAt,
    sessionId: meSession.sessionId ?? loginSession.sessionId,
    organizationId: meSession.organizationId ?? loginSession.organizationId,
    shopId: meSession.shopId ?? loginSession.shopId,
    roles: meSession.roles.length > 0 ? meSession.roles : loginSession.roles,
    permissions: meSession.permissions.length > 0 ? meSession.permissions : loginSession.permissions,
  };
}
