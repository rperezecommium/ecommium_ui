import { getStorefrontBffBaseUrl } from "../config/storefront-env";
import { requestBffAt, requestBffResponseAt } from "./request-client";
import type { BffRequestOptions } from "./request-client";
import type { BffResult } from "./types";

/**
 * Cliente server-side para rutas pertenecientes a Storefront.
 *
 * No resuelve ni adjunta credenciales Admin. Las peticiones que necesiten una
 * sesión customer deben entregar su Authorization explícitamente en init.headers.
 */
export function requestStorefrontBff<T>(
  path: string,
  options: BffRequestOptions<T> = {},
): Promise<BffResult<T>> {
  return requestBffAt(getStorefrontBffBaseUrl(), path, options);
}

/**
 * Cliente Storefront para documentos/binaries o respuestas 204. Las rutas
 * siguen usando exclusivamente el BFF Storefront, sin caer en el cliente Admin.
 */
export function requestStorefrontBffResponse(
  path: string,
  options: BffRequestOptions<unknown> = {},
): Promise<BffResult<Response>> {
  return requestBffResponseAt(getStorefrontBffBaseUrl(), path, options);
}
