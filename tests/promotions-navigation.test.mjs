import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function read(relativePath) {
  return readFileSync(path.resolve(root, relativePath), "utf8");
}

test("admin navigation keeps promotions outside Catalog", () => {
  const shell = read("src/app-shell/admin-shell.tsx");
  const catalogPage = read("app/(admin)/admin/catalogo/page.tsx");
  const promotionsPage = read("src/modules/promociones/promotions-admin-page.tsx");
  const promotionsData = read("src/modules/promociones/promotions-admin.ts");
  const promotionsActions = read("src/modules/promociones/promotions-admin-actions.ts");
  const permissions = read("src/shared/permissions/permissions.ts");

  assert.match(shell, /href: "\/admin\/promociones", label: "Promociones"/);
  assert.doesNotMatch(shell, /\/admin\/catalogo\/descuentos/);
  assert.doesNotMatch(catalogPage, /Descuentos/);
  assert.match(promotionsPage, /Admin \/ Promociones/);
  assert.match(promotionsPage, /Reglas de carrito/);
  assert.doesNotMatch(promotionsPage, /Gap BFF Admin/);
  assert.match(promotionsPage, /Crear cupon/);
  assert.match(promotionsPage, /deletePromotionCouponAction/);
  assert.match(promotionsPage, /hardDeletePromotionCouponAction/);
  assert.match(promotionsPage, /No se borra definitivamente/);
  assert.match(promotionsPage, /Escribe DESACTIVAR/);
  assert.match(promotionsPage, /Eliminar definitivamente/);
  assert.match(promotionsPage, /confirmHardDelete/);
  assert.match(promotionsActions, /deletePromotionCoupon\(context, couponCode, "hard"\)/);
  assert.match(promotionsActions, /Cupon eliminado definitivamente/);
  assert.match(promotionsData, /\/admin\/promotions\/coupons/);
  assert.match(promotionsData, /includeInactive/);
  assert.match(promotionsPage, /Configuracion &gt; Precios/);
  assert.match(permissions, /"admin:promotions:view"/);
  assert.match(permissions, /promotions\.admin\.write/);
});
