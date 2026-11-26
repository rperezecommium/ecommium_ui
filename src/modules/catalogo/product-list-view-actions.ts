"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productListViewCookieName } from "./product-list-view-cookie";
import { parseProductListView } from "./product-list-view";

export async function pinProductListViewAction(formData: FormData) {
  const name = await productListViewCookieName();
  if (!name) redirect("/auth/login?next=/admin/products");
  const columns = formData.get("columns");
  const view = parseProductListView({
    columns: typeof columns === "string" ? columns.split(",") : null,
    limit: Number(formData.get("limit")),
  });
  if (!view) throw new Error("La vista de productos no es válida.");
  (await cookies()).set(name, JSON.stringify(view), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/admin/products", maxAge: 365 * 24 * 60 * 60,
  });
  revalidatePath("/admin/products");
}

export async function resetProductListViewAction() {
  const name = await productListViewCookieName();
  if (!name) redirect("/auth/login?next=/admin/products");
  (await cookies()).set(name, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/admin/products", maxAge: 0 });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}
