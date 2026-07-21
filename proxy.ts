import { type NextRequest, NextResponse } from "next/server";
import { isSafeStorefrontTarget, resolveStorefrontPublicPath } from "./src/modules/storefront/public-path";
import { refreshAdminTokens } from "./src/shared/auth/admin-session-refresh";

const adminSessionCookieName = "ecommium_employee_session";

const reservedFirstSegments = new Set([
  "_next", "public-system", "account", "admin", "api", "assets", "auth", "cart", "checkout", "storefront",
  "login", "logout", "pdp", "pedido", "plp", "search", "static",
]);

export async function proxy(request: NextRequest) {
  const refreshedAdminSession = await refreshExpiredAdminSession(request);
  if (refreshedAdminSession) return refreshedAdminSession;

  if (!isPublicCandidate(request)) return NextResponse.next();

  const resolution = await resolveStorefrontPublicPath(request.nextUrl.pathname);
  if (!resolution.ok) {
    if (resolution.status === 404 && request.nextUrl.pathname !== "/") {
      const notFoundTarget = request.nextUrl.clone();
      notFoundTarget.pathname = "/public-system/not-found";
      notFoundTarget.search = "";
      return NextResponse.rewrite(notFoundTarget, { status: 404 });
    }
    return NextResponse.next();
  }
  if (resolution.data.kind !== "REDIRECT") return NextResponse.next();
  if (!isSafeStorefrontTarget(resolution.data.toPath)) return NextResponse.next();
  if (resolution.data.toPath === request.nextUrl.pathname) return NextResponse.next();

  const target = request.nextUrl.clone();
  target.pathname = resolution.data.toPath;
  target.search = "";
  return NextResponse.redirect(target, resolution.data.statusCode);
}

async function refreshExpiredAdminSession(request: NextRequest) {
  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    !request.nextUrl.pathname.startsWith("/admin")
  ) {
    return null;
  }

  const serialized = request.cookies.get(adminSessionCookieName)?.value;
  if (!serialized) return null;

  let current: Record<string, unknown>;
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    current = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const refreshToken = typeof current.refreshToken === "string" ? current.refreshToken : "";
  const expiresAt = typeof current.expiresAt === "string"
    ? new Date(current.expiresAt).getTime()
    : Number.NaN;
  if (!refreshToken || !Number.isFinite(expiresAt) || expiresAt > Date.now()) return null;

  const result = await refreshAdminTokens(refreshToken);
  if (!result.ok) return null;

  const response = NextResponse.redirect(request.nextUrl);
  response.cookies.set(adminSessionCookieName, JSON.stringify({
    ...current,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

function isPublicCandidate(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase();
  if (!firstSegment) return request.nextUrl.pathname === "/";
  if (reservedFirstSegments.has(firstSegment)) return false;
  return !firstSegment.includes(".");
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
};
