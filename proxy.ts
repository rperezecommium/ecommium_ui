import { type NextRequest, NextResponse } from "next/server";
import { isSafeStorefrontTarget, resolveStorefrontPublicPath } from "./src/modules/storefront/public-path";

const reservedFirstSegments = new Set([
  "_next", "public-system", "account", "admin", "api", "assets", "auth", "cart", "checkout", "storefront",
  "login", "logout", "pdp", "pedido", "plp", "search", "static",
]);

export async function proxy(request: NextRequest) {
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
