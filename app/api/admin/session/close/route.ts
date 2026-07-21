import { NextRequest, NextResponse } from "next/server";
import { closeAdminSession } from "../../../../../src/shared/auth/admin-session-lifecycle";
import { clearAdminContext } from "../../../../../src/shared/config/admin-context";
import { clearAdminSession, getAdminSession } from "../../../../../src/shared/auth/session";

function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ closed: false }, { status: 403 });
  }

  const session = await getAdminSession();
  if (!session?.accessToken) {
    return NextResponse.json({ closed: false }, { status: 401 });
  }

  const result = await closeAdminSession(session.accessToken);
  if (!result.ok) {
    return NextResponse.json({ closed: false }, { status: result.status });
  }

  await clearAdminContext();
  await clearAdminSession();
  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "no-store" },
  });
}
