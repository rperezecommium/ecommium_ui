import { NextRequest, NextResponse } from "next/server";
import { requestAdminBffResponseAsEmployee } from "../../../../../src/shared/bff/admin-client";
import { requireAdminRouteAccess } from "../../../../../src/shared/auth/require-admin-route-access";

export async function GET(request: NextRequest) {
  const access = await requireAdminRouteAccess("catalog.products.write");
  if (!access.ok) return access.response;
  const { context } = access.data;
  const query = new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId,
    locale: context.locale ?? "es-ES" });
  for (const name of ["channel", "warehouseId", "currency", "country", "publish", "availableForSale", "manageInventory", "allowBackorder"]) {
    const value = request.nextUrl.searchParams.get(name);
    if (value !== null) query.set(name, value);
  }
  const result = await requestAdminBffResponseAsEmployee(`/admin/catalog-import-jobs/readiness?${query}`, access.data.accessToken,
    { context, init: { method: "GET", cache: "no-store" } });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 502 });
  return NextResponse.json(await result.data.json(), { status: result.data.status, headers: { "Cache-Control": "no-store" } });
}
