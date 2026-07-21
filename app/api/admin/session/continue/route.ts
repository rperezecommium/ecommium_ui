import { NextRequest, NextResponse } from "next/server";
import { continueAdminSession } from "../../../../../src/shared/auth/admin-session-lifecycle";
import { getAdminSession } from "../../../../../src/shared/auth/session";

function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ active: false }, { status: 403 });
  }

  const session = await getAdminSession();
  if (!session?.accessToken) {
    return NextResponse.json({ active: false }, { status: 401 });
  }

  const result = await continueAdminSession(session.accessToken);
  if (!result.ok) {
    return NextResponse.json({ active: false }, { status: result.status });
  }

  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "no-store" },
  });
}
