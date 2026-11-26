"use client";

import { useId } from "react";
import type { ProductLookupOption, StockDraft } from "./product-editor-types";

export type InventoryQuantityField = "onHandQuantity" | "reservedQuantity" | "safetyStockQuantity";

export function ProductInventoryPanel({ loading, stock, warehouses, warehouseError, canRestore, onRestore, onQuantity, onWarehouse, failed, onRetry }: {
  loading?: boolean;
  stock: StockDraft;
  warehouses: ProductLookupOption[];
  warehouseError?: string;
  canRestore: boolean;
  onRestore?: () => void;
  onQuantity: (field: InventoryQuantityField, value: string) => void;
  onWarehouse: (value: string) => void;
  failed: boolean;
  onRetry: () => void;
}) {
  const id = useId();
  const available = stock.availableQuantity ?? Math.max(0, stock.onHandQuantity - stock.reservedQuantity - stock.safetyStockQuantity);
  const known = warehouses.some((warehouse) => warehouse.id === stock.warehouseId);
  return <details className="productEditorPanel productBasicSection productInventoryPanel" open>
    <summary><span>Inventario: <span className="productBasicSummaryHint">{available} disponibles</span></span></summary>
    <div className="productBasicSectionBody">
      <div className="adminFormGrid productBasicInventoryGrid">
        <div className="adminField">
          <label htmlFor={`${id}-warehouse`}>Almacén</label>
          <select disabled={loading} id={`${id}-warehouse`} value={stock.warehouseId} onChange={(event) => onWarehouse(event.target.value)}>
            <option disabled={Boolean(stock.warehouseId)} value="">Almacén del contexto de la tienda</option>
            {stock.warehouseId && !known ? <option value={stock.warehouseId}>{stock.warehouseId} (no disponible en el catálogo)</option> : null}
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id} disabled={warehouse.isActive === false && warehouse.id !== stock.warehouseId}>{warehouse.label}</option>)}
          </select>
        </div>
        {([['onHandQuantity', 'Existencias'], ['reservedQuantity', 'Reservado'], ['safetyStockQuantity', 'Stock de seguridad']] as const).map(([field, label]) => <label className="adminField" key={field} htmlFor={`${id}-${field}`}>
          <span>{label}</span>
          <input id={`${id}-${field}`} disabled={loading} type="number" min="0" step="1" inputMode="numeric" value={stock[field]} onChange={(event) => onQuantity(field, event.target.value)} />
        </label>)}
      </div>
      {loading ? <p role="status" className="adminContextHint">Cargando stock del almacén…</p> : null}
      {warehouseError ? <p className="adminContextHint" role="status">{warehouseError}</p> : null}
      {!stock.availabilityEstimated && stock.reasons?.length ? <p className="adminContextHint">{stock.reasons.map((reason) => ({ OUT_OF_STOCK: "Sin stock disponible", INSUFFICIENT_STOCK: "Stock insuficiente", STOCK_LEVEL_NOT_FOUND: "Sin registro de stock en este almacén" })[reason] ?? reason).join(" · ")}</p> : null}
      {onRestore ? <div className="productInventoryRestore"><button className="productImageAddLink" type="button" disabled={!canRestore} onClick={onRestore}>Usar stock del producto</button></div> : null}
      {failed ? <div className="adminBanner adminBannerError adminSection" role="alert"><p>No se pudo guardar el inventario. Los demás bloques conservan su resultado.</p><button className="productImageAddLink" type="button" onClick={onRetry}>Reintentar stock</button></div> : null}
    </div>
  </details>;
}
