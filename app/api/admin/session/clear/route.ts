import { NextRequest, NextResponse } from "next/server";
import { clearAdminContext } from "../../../../../src/shared/config/admin-context";
import { clearAdminSession } from "../../../../../src/shared/auth/session";

function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ cleared: false }, { status: 403 });
  }

  await clearAdminContext();
  await clearAdminSession();
  return NextResponse.json({ cleared: true }, {
    headers: { "Cache-Control": "no-store" },
  });
}
