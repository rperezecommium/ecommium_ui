import { adminBffToken, bffBaseUrl } from "../config/env";
import { getAdminRequestAuthorizationToken } from "../auth/admin-request-session";
import { getAdminAuthorizationToken } from "../auth/session";
import { requestBffAt } from "./request-client";
import type { BffRequestOptions } from "./request-client";
import type { BffResult } from "./types";

export async function requestBff<T>(
  path: string,
  options: BffRequestOptions<T> = {},
): Promise<BffResult<T>> {
  const shouldSendAuth = options.withAuth !== false;
  const requestSessionToken = shouldSendAuth ? getAdminRequestAuthorizationToken() : undefined;
  const sessionToken = shouldSendAuth ? requestSessionToken ?? await getAdminAuthorizationToken() : undefined;
  return requestBffAt(
    bffBaseUrl,
    path,
    options,
    shouldSendAuth ? sessionToken ?? adminBffToken : undefined,
    (status) => status === 401
      ? "BFF responded with 401. Admin BFF authorization is required; configure ECOMMIUM_ADMIN_BFF_TOKEN server-side."
      : undefined,
  );
}
