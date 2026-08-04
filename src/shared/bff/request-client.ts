import { createBffHeaders } from "./headers";
import type { BffRequestContext, BffResult } from "./types";

export type BffRequestOptions<T> = {
  context?: Partial<BffRequestContext>;
  init?: RequestInit;
  parse?: (value: unknown) => T;
  withAuth?: boolean;
};

function makeCorrelationId() {
  return `ui-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeBffBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function makeBffUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBffBaseUrl(baseUrl)}${normalizedPath}`;
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => undefined) as unknown;
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

  const text = await response.text().catch(() => "");
  return text.trim();
}

export async function requestBffAt<T>(
  baseUrl: string,
  path: string,
  options: BffRequestOptions<T> = {},
  authorizationToken?: string,
  fallbackError?: (status: number) => string | undefined,
): Promise<BffResult<T>> {
  const responseResult = await requestBffResponseAt(
    baseUrl,
    path,
    options,
    authorizationToken,
    fallbackError,
  );

  if (!responseResult.ok) {
    return responseResult;
  }

  try {
    const payload = (await responseResult.data.json()) as unknown;
    const data = options.parse ? options.parse(payload) : (payload as T);

    return {
      ok: true,
      data,
      status: responseResult.status,
      correlationId: responseResult.correlationId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "BFF response is not valid JSON",
      status: responseResult.status,
      correlationId: responseResult.correlationId,
    };
  }
}

/**
 * Variante técnica para endpoints Storefront que devuelven binarios, HTML o
 * respuestas sin body. Mantiene base URL, contexto, correlationId y errores
 * centralizados sin forzar un parseo JSON.
 */
export async function requestBffResponseAt(
  baseUrl: string,
  path: string,
  options: BffRequestOptions<unknown> = {},
  authorizationToken?: string,
  fallbackError?: (status: number) => string | undefined,
): Promise<BffResult<Response>> {
  const correlationId = options.context?.correlationId ?? makeCorrelationId();
  const headers = createBffHeaders({
    authorizationToken: options.withAuth === false ? undefined : authorizationToken,
    correlationId,
    initHeaders: options.init?.headers,
    locale: options.context?.locale,
  });

  try {
    const response = await fetch(makeBffUrl(baseUrl, path), {
      ...options.init,
      cache: "no-store",
      headers,
    });

    if (!response.ok) {
      const detail = await readErrorMessage(response);
      return {
        ok: false,
        error: detail || fallbackError?.(response.status) || `BFF responded with ${response.status}`,
        status: response.status,
        correlationId,
      };
    }

    return {
      ok: true,
      data: response,
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
