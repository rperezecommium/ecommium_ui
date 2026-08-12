import { AsyncLocalStorage } from "node:async_hooks";
import type { AdminSession } from "./session";

const adminRequestSessionStorage = new AsyncLocalStorage<AdminSession>();

export function runWithAdminRequestSession<T>(
  session: AdminSession,
  callback: () => T,
): T {
  return adminRequestSessionStorage.run(session, callback);
}

export function getAdminRequestAuthorizationToken() {
  return adminRequestSessionStorage.getStore()?.accessToken;
}

export function getAdminRequestSession() {
  return adminRequestSessionStorage.getStore() ?? null;
}
