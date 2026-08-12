import { createBffHeaders } from "./headers";
import type { BffRequestContext, BffResult } from "./types";

export type BffRequestOptions<T> = {
  context?: Partial<BffRequestContext>;
  init?: RequestInit;
  parse?: (value: unknown) => T;
  withAuth?: boolean;
};

export const bffRequestTimeoutMs = 15_000;

function bffRequestSignal(existingSignal?: AbortSignal | null) {
  const timeoutSignal = AbortSignal.timeout(bffRequestTimeoutMs);
  return existingSignal ? AbortSignal.any([existingSignal, timeoutSignal]) : timeoutSignal;
}

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

export function publicBffError(status?: number) {
  if (status === 400 || status === 422) return "La solicitud no es válida.";
  if (status === 401) return "Tu sesión ha caducado. Inicia sesión de nuevo.";
  if (status === 403) return "No tienes permiso para realizar esta acción.";
  if (status === 404) return "El recurso solicitado no está disponible.";
  if (status === 409) return "No se pudo completar la operación por un conflicto.";
  if (status === 413) return "La solicitud supera el tamaño permitido.";
  if (status === 415) return "El formato de la solicitud no está permitido.";
  if (status === 429) return "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.";
  return "El servicio no está disponible temporalmente.";
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
  } catch {
    return {
      ok: false,
      error: publicBffError(responseResult.status),
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
      signal: bffRequestSignal(options.init?.signal),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: publicBffError(response.status),
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
  } catch {
    return {
      ok: false,
      error: publicBffError(),
      correlationId,
    };
  }
}
