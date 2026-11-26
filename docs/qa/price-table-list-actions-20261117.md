# Price tables: listado y confirmaciones

Columnas al100%, acciones suaves de Productos y popups centrados para
Activar/Desactivar/Eliminar. Sin input DELETE ni segunda baja en cada fila.
Cancel/Escape/foco restaurado y envío bloqueado mientras está pendiente.
Acciones/drawer de alta ocultos sin pricing.admin.write; BFF es autoridad.

Ricardo elige desactivar precios/reglas al eliminar. La advertencia informa de
asignaciones retiradas, precios inactivos, importes/impuestos conservados y
pedidos/facturas intactos. Backend autorizado añade endpoint propio
`/admin/pricing/price-tables/:id/permanent?deactivatePrices=true`; sin fallback al
DELETE de baja. El recibo se valida antes de mostrar éxito. Fences impiden
reactivar sin reasignar explícitamente otra tabla o recrear la tabla eliminada.
PATCH activation sincroniza maestro/precios en transacción, incluso tabla vacía.

Validación:

- `npm run build`: PASS; `npm run lint`:0errores/3avisos previos.
- `node --test tests/pricing-admin.test.mjs tests/pricing-tax-actions.test.mjs`:16 PASS.
- Pricing Jest8/BFF29 PASS y builds correctos.
- PostgreSQL desechable + HTTP Pricing: PASS, con aislamiento/rollback/fences,
  nueva asignación explícita y tablas vacías; regresión fiscal aislada PASS.
- Playwright Pricing9 PASS (activar/desactivar/eliminar, solo lectura, cancelación,
  recibos, ejes/ancho y responsive). Axe de diálogo sin incidencias con
  color-contrast excluido por pendiente transversal anterior.
- Captura móvil de eliminación revisada. E2E UI usa fixtures; SQL/HTTP backend usa
  una base creada y retirada solo para QA. No se eliminaron tablas comerciales.
- No Lighthouse ni certificación productiva.

ADR-0320 y QA price-table-removal-20261117 en composable. Migración aditiva
20261117140000_price_table_removal y reinicio Pricing/BFF Admin pendientes de
aprobar el plan exacto. Impuestos anterior sí activado con aprobación exacta;
sus datos comerciales se conservaron.

## Activación autorizada — 2026-11-17

Ricardo aprobó exactamente20261117140000_price_table_removal y reinicio de
pricing/bff-admin. Migración APPLIED, reinicio canónico con Node22 y health200/200.
Antes/después:2589 precios,2301 activos,335 asignaciones de tabla,911 fiscales
y20 referencias conservados; tablas eliminadas0/precios retirados0.
Endpoints nuevos sin autenticación401. Se mantiene la evidencia aislada de
confirmación400/borrado completo. Sustituye la activación pendiente anterior.
No se eliminaron/desactivaron tablas comerciales durante la activación.
