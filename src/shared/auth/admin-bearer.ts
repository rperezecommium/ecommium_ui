import type { AdminSession } from "./session";

function defaultServerToken() {
  return process.env.ECOMMIUM_ADMIN_BFF_TOKEN ?? "";
}

export function hasUsableAdminBearer(session: AdminSession | null, serverToken = defaultServerToken()) {
  return Boolean(session?.accessToken || serverToken);
}

export function canUseDevAdminSession(serverToken = defaultServerToken()) {
  return process.env.ECOMMIUM_ADMIN_DEV_SESSION === "1" && Boolean(serverToken);
}
