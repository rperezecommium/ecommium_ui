import { cache } from "react";
import { refreshAdminEmployeeSession } from "./admin-session-actions";
// One authoritative snapshot per render, shared by layouts and independently rendered pages.
export const getCurrentAdminSession = cache(() =>
  refreshAdminEmployeeSession({ cookieWrite: false }),
);
