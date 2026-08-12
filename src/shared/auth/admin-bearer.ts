import type { AdminSession } from "./session";

export function hasUsableAdminBearer(session: AdminSession | null) {
  return Boolean(session?.accessToken);
}
