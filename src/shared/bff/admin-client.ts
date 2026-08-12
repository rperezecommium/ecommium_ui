import { adminBffBaseUrl } from "../config/env";
import { getAdminRequestAuthorizationToken } from "../auth/admin-request-session";
import { getAdminAuthorizationToken } from "../auth/session";
import { requestBffAt, requestBffResponseAt } from "./request-client";
import type { BffRequestOptions } from "./request-client";
import type { BffResult } from "./types";

/**
 * Cliente server-side exclusivo para la superficie StoreAdmin.
 *
 * Resuelve la sesión Employee/Admin y nunca debe usarse para Storefront.
 */
export async function requestAdminBff<T>(
  path: string,
  options: BffRequestOptions<T> = {},
): Promise<BffResult<T>> {
  const shouldSendAuth = options.withAuth !== false;
  const authorizationToken = await resolveAdminAuthorizationToken(shouldSendAuth);
  return requestBffAt(
    adminBffBaseUrl,
    path,
    options,
    authorizationToken,
    adminBffFallbackError,
  );
}

/**
 * Variante Admin para binarios, HTML o respuestas sin body. Conserva la misma
 * resolución de sesión que las peticiones JSON del backoffice.
 */
export async function requestAdminBffResponse(
  path: string,
  options: BffRequestOptions<unknown> = {},
): Promise<BffResult<Response>> {
  const shouldSendAuth = options.withAuth !== false;
  const authorizationToken = await resolveAdminAuthorizationToken(shouldSendAuth);
  return requestBffResponseAt(
    adminBffBaseUrl,
    path,
    options,
    authorizationToken,
    adminBffFallbackError,
  );
}

/**
 * Proxy de recursos privados después de validar una sesión Employee. Recibe
 * el bearer explícitamente para impedir que una ruta de usuario caiga al token
 * técnico configurado para integración local.
 */
export async function requestAdminBffResponseAsEmployee(
  path: string,
  accessToken: string,
  options: BffRequestOptions<unknown> = {},
): Promise<BffResult<Response>> {
  const headers = new Headers(options.init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);

  return requestBffResponseAt(
    adminBffBaseUrl,
    path,
    {
      ...options,
      withAuth: false,
      init: {
        ...options.init,
        headers,
      },
    },
  );
}

async function resolveAdminAuthorizationToken(shouldSendAuth: boolean) {
  if (!shouldSendAuth) {
    return undefined;
  }

  const requestSessionToken = getAdminRequestAuthorizationToken();
  const sessionToken = requestSessionToken ?? await getAdminAuthorizationToken();
  return sessionToken;
}

function adminBffFallbackError(status: number) {
  return status === 401
    ? "BFF responded with 401. An authenticated Employee/Admin session is required."
    : undefined;
}
