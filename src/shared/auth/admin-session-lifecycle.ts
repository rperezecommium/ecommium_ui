import { adminBffBaseUrl } from "../config/env";

export type AdminSessionState = {
  status: "ACTIVE";
  sessionId: string;
  createdAt: string;
  lastActivityAt: string;
  idleExpiresAt: string | null;
  absoluteExpiresAt: string | null;
  enforcement: "DISABLED" | "ENABLED";
};

export type AdminSessionCloseResult = {
  status: "CLOSED";
  sessionId: string;
  closedAt: string;
  reason: "LOGOUT";
};

type LifecycleResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number };

function lifecycleUrl(path: string) {
  return `${adminBffBaseUrl.replace(/\/$/, "")}/admin/session${path}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asIso(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(new Date(value).getTime())) {
    return undefined;
  }

  return value;
}

function parseState(value: unknown): AdminSessionState | null {
  const record = asRecord(value);
  const sessionId = typeof record.sessionId === "string" ? record.sessionId.trim() : "";
  const createdAt = asIso(record.createdAt);
  const lastActivityAt = asIso(record.lastActivityAt);
  const idleExpiresAt = record.idleExpiresAt === null ? null : asIso(record.idleExpiresAt);
  const absoluteExpiresAt = record.absoluteExpiresAt === null ? null : asIso(record.absoluteExpiresAt);

  if (
    record.status !== "ACTIVE" ||
    !sessionId ||
    !createdAt ||
    !lastActivityAt ||
    idleExpiresAt === undefined ||
    absoluteExpiresAt === undefined ||
    (record.enforcement !== "DISABLED" && record.enforcement !== "ENABLED")
  ) {
    return null;
  }

  return {
    status: "ACTIVE",
    sessionId,
    createdAt,
    lastActivityAt,
    idleExpiresAt,
    absoluteExpiresAt,
    enforcement: record.enforcement,
  };
}

function parseClose(value: unknown): AdminSessionCloseResult | null {
  const record = asRecord(value);
  const sessionId = typeof record.sessionId === "string" ? record.sessionId.trim() : "";
  const closedAt = asIso(record.closedAt);

  if (record.status !== "CLOSED" || !sessionId || !closedAt || record.reason !== "LOGOUT") {
    return null;
  }

  return { status: "CLOSED", sessionId, closedAt, reason: "LOGOUT" };
}

async function requestLifecycle<T>(
  path: string,
  method: "GET" | "POST",
  accessToken: string,
  parse: (value: unknown) => T | null,
): Promise<LifecycleResult<T>> {
  try {
    const response = await fetch(lifecycleUrl(path), {
      method,
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        "x-correlation-id": `ui-admin-session-${Date.now()}`,
      },
    });
    if (!response.ok) return { ok: false, status: response.status };

    const data = parse(await response.json());
    return data ? { ok: true, data } : { ok: false, status: 502 };
  } catch {
    return { ok: false, status: 503 };
  }
}

export function getAdminSessionState(accessToken: string) {
  return requestLifecycle("", "GET", accessToken, parseState);
}

export function continueAdminSession(accessToken: string) {
  return requestLifecycle("/continue", "POST", accessToken, parseState);
}

export function closeAdminSession(accessToken: string) {
  return requestLifecycle("/close", "POST", accessToken, parseClose);
}
