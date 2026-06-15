import { adminBffToken, bffBaseUrl } from "../config/env";
import { getAdminAuthorizationToken } from "../auth/session";
import { createBffHeaders } from "./headers";
import type { BffRequestContext, BffResult } from "./types";

type RequestOptions<T> = {
  context?: Partial<BffRequestContext>;
  init?: RequestInit;
  parse?: (value: unknown) => T;
};

function makeCorrelationId() {
  return `ui-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeUrl(path: string) {
  const base = bffBaseUrl.endsWith("/") ? bffBaseUrl.slice(0, -1) : bffBaseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export async function requestBff<T>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<BffResult<T>> {
  const correlationId = options.context?.correlationId ?? makeCorrelationId();
  const sessionToken = await getAdminAuthorizationToken();
  const headers = createBffHeaders({
    adminToken: sessionToken ?? adminBffToken,
    correlationId,
    initHeaders: options.init?.headers,
    locale: options.context?.locale,
  });

  const url = makeUrl(path);

  try {
    const response = await fetch(url, {
      ...options.init,
      cache: "no-store",
      headers,
    });

    if (!response.ok) {
      const authMessage =
        response.status === 401
          ? "BFF responded with 401. Admin BFF authorization is required; configure ECOMMIUM_ADMIN_BFF_TOKEN server-side."
          : `BFF responded with ${response.status}`;

      return {
        ok: false,
        error: authMessage,
        status: response.status,
        correlationId,
      };
    }

    const payload = (await response.json()) as unknown;
    const data = options.parse ? options.parse(payload) : (payload as T);

    return {
      ok: true,
      data,
      status: response.status,
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
