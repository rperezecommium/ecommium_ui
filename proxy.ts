import { type NextRequest, NextResponse } from "next/server";
import { isSafeStorefrontTarget, resolveStorefrontPublicPath } from "./src/modules/storefront/public-path";
import {
  resolveStorefrontContext,
  serializeStorefrontContext,
} from "./src/modules/storefront/storefront-context";
import { refreshAdminTokens } from "./src/shared/auth/admin-session-refresh";

const adminSessionCookieName = "ecommium_employee_session";
const maximumPublicPathLength = 2048;
const maximumPublicQueryLength = 2048;
const maximumPublicPathSegments = 12;

const reservedFirstSegments = new Set([
  "_next", "public-system", "account", "admin", "api", "assets", "auth", "cart", "checkout", "storefront",
  "login", "logout", "pdp", "pedido", "plp", "search", "static",
]);

export async function proxy(request: NextRequest) {
  const refreshedAdminSession = await refreshExpiredAdminSession(request);
  if (refreshedAdminSession) return refreshedAdminSession;

  if (!isPublicCandidate(request)) return NextResponse.next();

  let storefrontContext;
  try {
    storefrontContext = await resolveStorefrontContext({
      host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      shopAlias: request.nextUrl.searchParams.get("shopAlias"),
    });
  } catch {
    const unavailableTarget = request.nextUrl.clone();
    unavailableTarget.pathname = "/public-system/storefront-unavailable";
    unavailableTarget.search = "";
    return NextResponse.rewrite(unavailableTarget, { status: 503 });
  }

  const resolution = await resolveStorefrontPublicPath(request.nextUrl.pathname, storefrontContext);
  if (!resolution.ok) {
    if (resolution.status === 404 && request.nextUrl.pathname !== "/") {
      const notFoundTarget = request.nextUrl.clone();
      notFoundTarget.pathname = "/public-system/not-found";
      notFoundTarget.search = "";
      return NextResponse.rewrite(notFoundTarget, { status: 404 });
    }
    return nextWithStorefrontContext(request, storefrontContext);
  }
  if (resolution.data.kind !== "REDIRECT") return nextWithStorefrontContext(request, storefrontContext);
  if (!isSafeStorefrontTarget(resolution.data.toPath)) return nextWithStorefrontContext(request, storefrontContext);
  if (resolution.data.toPath === request.nextUrl.pathname) return nextWithStorefrontContext(request, storefrontContext);

  const target = request.nextUrl.clone();
  target.pathname = resolution.data.toPath;
  target.search = "";
  return NextResponse.redirect(target, resolution.data.statusCode);
}

function nextWithStorefrontContext(
  request: NextRequest,
  context: Awaited<ReturnType<typeof resolveStorefrontContext>>,
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-ecommium-storefront-context", serializeStorefrontContext(context));
  return NextResponse.next({ request: { headers: requestHeaders } });
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
  if (request.nextUrl.pathname.length > maximumPublicPathLength || request.nextUrl.search.length > maximumPublicQueryLength) return false;
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length > maximumPublicPathSegments) return false;
  const firstSegment = segments[0]?.toLowerCase();
  if (!firstSegment) return request.nextUrl.pathname === "/";
  if (reservedFirstSegments.has(firstSegment)) return false;
  return !firstSegment.includes(".");
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
};
