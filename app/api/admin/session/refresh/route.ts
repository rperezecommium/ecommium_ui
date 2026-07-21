import { NextRequest, NextResponse } from "next/server";
import { refreshAdminTokens } from "../../../../../src/shared/auth/admin-session-refresh";
import { getAdminSession, saveAdminSession } from "../../../../../src/shared/auth/session";

function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ refreshed: false }, { status: 403 });
  }

  const current = await getAdminSession();
  if (!current?.refreshToken) {
    return NextResponse.json({ refreshed: false }, { status: 401 });
  }

  const result = await refreshAdminTokens(current.refreshToken);
  if (!result.ok) {
    return NextResponse.json({ refreshed: false }, { status: result.status });
  }

  const session = {
    ...current,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
  };
  await saveAdminSession(session);

  return NextResponse.json({
    refreshed: true,
    expiresAt: session.expiresAt,
    sessionId: session.sessionId,
  });
}
