import type { ProductLookupOption } from "./product-editor-types";

export function parseProductWarehouses(value: unknown): ProductLookupOption[] {
  if (!value || typeof value !== "object" || !("warehouses" in value) || !Array.isArray(value.warehouses)) throw new Error("Respuesta de almacenes inválida.");
  return value.warehouses.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("warehouseId" in item) || !("name" in item) || typeof item.warehouseId !== "string" || !item.warehouseId.trim() || typeof item.name !== "string" || !item.name.trim()) throw new Error("Almacén inválido.");
    const active = "active" in item ? item.active : true;
    if (typeof active !== "boolean") throw new Error("Estado de almacén inválido.");
    return { id: item.warehouseId, label: `${item.name}${active ? "" : " (inactivo)"}`, isActive: active };
  });
}

export function warehouseCreatePayload(input: { name: string; dockId: string; countries: string }) {
  const name = input.name.trim();
  const dockId = input.dockId.trim();
  const countries = [...new Set(input.countries.split(/[,\s]+/).map(country => country.trim().toUpperCase()).filter(Boolean))];
  if (!name || name.length > 200 || !dockId || dockId.length > 200 || !countries.length || countries.length > 250 || countries.some(country => !/^[A-Z]{2}$/.test(country))) throw new Error("Indica nombre, muelle y países con códigos de dos letras (por ejemplo, ES). ");
  return { warehouse: { name, dockId, countries, active: true } };
}

export function parseWarehouseStock(value: unknown, warehouseId: string): import("./product-editor-types").StockDraft {
  if (!value || typeof value !== "object" || !("stockLevel" in value)) throw new Error("Respuesta de stock inválida.");
  if (value.stockLevel === null) return { warehouseId, onHandQuantity: 0, reservedQuantity: 0, safetyStockQuantity: 0, availableQuantity: 0, available: false, persisted: false };
  const stock = value.stockLevel as Record<string, unknown>;
  if (!stock || stock.warehouseId !== warehouseId) throw new Error("Almacén de stock incorrecto.");
  for (const field of ["onHandQuantity", "reservedQuantity", "safetyStockQuantity"] as const) if (!Number.isSafeInteger(stock[field]) || (stock[field] as number) < 0) throw new Error("Cantidad de stock inválida.");
  const onHandQuantity = stock.onHandQuantity as number;
  const reservedQuantity = stock.reservedQuantity as number;
  const safetyStockQuantity = stock.safetyStockQuantity as number;
  const availableQuantity = Math.max(0, onHandQuantity - reservedQuantity - safetyStockQuantity);
  return { warehouseId, onHandQuantity, reservedQuantity, safetyStockQuantity, availableQuantity, available: availableQuantity > 0, persisted: true };
}
