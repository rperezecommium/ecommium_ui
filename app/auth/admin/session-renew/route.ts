import { NextRequest, NextResponse } from "next/server";
import { refreshAdminEmployeeSession } from "../../../../src/modules/auth/admin-session-actions";
import {
  clearAdminSession,
  saveAdminSession,
} from "../../../../src/shared/auth/session";
// Technical UI session handoff: cookies can be rotated here, not during an RSC render.
export async function GET(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return new NextResponse(null, { status: 403 });
  const value = request.nextUrl.searchParams.get("next") ?? "/admin";
  const next =
    /^\/admin(?:\/|\?|$)/.test(value) && !/[\u0000-\u001f\u007f\\]/.test(value)
      ? value
      : "/admin";
  const session = await refreshAdminEmployeeSession();
  if (session) await saveAdminSession(session);
  else await clearAdminSession();
  const location = session
    ? next
    : "/auth/login?next=" + encodeURIComponent(next);
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
