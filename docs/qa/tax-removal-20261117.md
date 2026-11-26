# Impuestos: columnas y acciones — 2026-11-17

Las columnas reparten el100% del listado (tabla fija, anchuras por contenido,
scroll interno en móvil). Desactivar y Eliminar usan los botones suaves de
Productos. Desaparece la confirmación escrita de cada fila; ambas operaciones
abren diálogo nativo centrado con advertencia, Cancelar, Escape, foco restaurado
y envío bloqueado mientras está pendiente. Crear/Desactivar/Eliminar se ocultan
sin `pricing.admin.write`; el BFF conserva la autoridad de permisos.

Desactivar llama al DELETE antiguo y conserva impuestos ya asignados. Eliminar
llama exclusivamente al nuevo `/admin/pricing/taxes/:code/permanent` con
`detachPrices=true`. La advertencia informa de todos los precios de esa tienda
sin impuesto, importes almacenados conservados, posible cambio de desglose/total,
históricos fiscales intactos e irreversibilidad/código no reutilizable. No hay
fallback al endpoint de baja. Se valida el recibo modo hard/código/contador/
remainingAssignments0 antes de informar de éxito.

Backend modificado con autorización explícita: transacción y fences de Pricing;
ADRs/contratos/evidencia en el repo composable, ADR-0319 y QA tax-removal-20261117.
La migración fue probada en PostgreSQL desechable, sin borrar impuestos reales.
Activación sobre la base configurada externa pendiente de aprobar el plan exacto.

Comandos/resultados:

- `npm run lint`: 0 errores / 3 avisos preexistentes.
- `npm run build`: PASS.
- `node --test tests/pricing-admin.test.mjs tests/pricing-tax-actions.test.mjs`:16 PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'tax list distributes|tax deletion and creation controls|pricing tabs align|pricing configuration exposes master data|pricing configuration resolves computed auto|pricing governance page manages campaign' --reporter=line`:6 PASS.
- Axe de diálogo sin incidencias con color-contrast excluido (pendiente transversal
  de tokens existente). Escape/Cancel no mutan; readonly oculta las acciones.
- No Lighthouse ni compra comercial. E2E UI usa fixtures; SQL/HTTP backend usa base
  aislada. No acredita un borrado sobre el entorno comercial configurado.

## Activación autorizada

2026-11-17: Ricardo autorizó el plan exacto. Migración APPLIED y Pricing/BFF Admin
reiniciados con script canónico y Node22. Precios2589, asignaciones911 y
referencias20 conservados; tombstones0. Health200/200, Pricing y BFF sin autenticación401. El400 sin acuse se
verificó sobre HTTP aislado, no sobre el endpoint activo autenticado. No se eliminaron impuestos comerciales. Sustituye el estado
pendiente anterior; no acredita una eliminación comercial real.
