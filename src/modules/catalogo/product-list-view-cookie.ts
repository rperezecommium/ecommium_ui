import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getAdminSession } from "../../shared/auth/session";
import { parseProductListView } from "./product-list-view";

export async function productListViewCookieName() {
  const session = await getAdminSession();
  if (!session) return null;
  return `ecommium_product_view_${createHash("sha256").update(session.employeeId).digest("hex").slice(0, 24)}`;
}

export async function getPinnedProductListView() {
  const name = await productListViewCookieName();
  if (!name) return null;
  try {
    const raw = (await cookies()).get(name)?.value;
    return raw && raw.length <= 1024 ? parseProductListView(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
