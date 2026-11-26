import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";
const { parseProductWarehouses, warehouseCreatePayload, parseWarehouseStock } = loadTs("src/modules/catalogo/product-warehouses.ts");

test("warehouse catalog validates identities, names and active state", () => {
  const [warehouse] = parseProductWarehouses({ warehouses: [{ warehouseId: "main", name: "Barcelona", active: true }] });
  assert.equal(warehouse.id, "main");
  assert.equal(warehouse.label, "Barcelona");
  assert.throws(() => parseProductWarehouses({ warehouses: [{ name: "Missing identity" }] }));
  assert.throws(() => parseProductWarehouses({ warehouses: [{ warehouseId: "main", name: "Barcelona", active: "false" }] }));
  assert.throws(() => parseProductWarehouses([]));
});

test("warehouse create normalizes countries and rejects invalid input", () => {
  const payload = warehouseCreatePayload({ name: " Barcelona ", dockId: " Muelle 1 ", countries: "es, FR es" });
  assert.deepEqual(payload.warehouse.countries, ["ES", "FR"]);
  assert.equal(payload.warehouse.name, "Barcelona");
  assert.throws(() => warehouseCreatePayload({ name: "", dockId: "x", countries: "ES" }));
  assert.throws(() => warehouseCreatePayload({ name: "x", dockId: "x", countries: "Spain" }));
});

test("stock warehouse reads never reuse quantities from another warehouse", () => {
  assert.deepEqual(parseWarehouseStock({ stockLevel: null }, "new"), { warehouseId: "new", onHandQuantity: 0, reservedQuantity: 0, safetyStockQuantity: 0, availableQuantity: 0, available: false, persisted: false });
  const stock = parseWarehouseStock({ stockLevel: { warehouseId: "main", onHandQuantity: 12, reservedQuantity: 4, safetyStockQuantity: 2 } }, "main");
  assert.equal(stock.availableQuantity, 6);
  assert.equal(stock.persisted, true);
  assert.throws(() => parseWarehouseStock({ stockLevel: { ...stock, warehouseId: "other" } }, "main"));
  assert.throws(() => parseWarehouseStock({ stockLevel: { ...stock, onHandQuantity: -1 } }, "main"));
});
