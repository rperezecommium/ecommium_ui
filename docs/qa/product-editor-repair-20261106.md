# Reparación integral de producto — 2026-11-06

Seguimiento de [QA inicial](product-editor-integral-20261106.md) y [diagnóstico](product-editor-diagnosis-20261106.md). Ricardo autorizó corregir backend y UI. Detalle técnico y reproducción en el repo backend: `/Users/ricardoperez/Documents/ecommium/composable_ecommerce/.docs/qa/product-editor-repair-20261106.md`.

## Resultado por caso

| Caso | Resultado comprobado |
| --- | --- |
| Reabrir producto y búsqueda | Editor-state200; búsqueda exacta200,total1. Mismo producto, sin repetir alta. Relays/worker estaban apagados y ahora procesan eventos. |
| Simulador | VIP2→121EUR; VIP3→99EUR; Todos3→121EUR. Tramo mínimo3 visible. Control existente Argon18 también simula su precio de defaultVariant. |
| Mensaje de error | ERROR técnico separado de NOT_APPLIED; fallback sin evaluar ante fallo. |
| Guardado y badges | Última operación saved_unpublished; bloques confirmados. Media también Correcto al editar metadata. Publish/variantMedia Sin cambios, sin fingir ejecución. |
| Recuperación | Snapshot local conserva IDs/variantes/stock/SEO. Restaurar en pestaña nueva funcionó. Se retira recuperación genérica del guardian para fichas de producto. |
| Características | Tiempo de garantía3años y durabilidad20 muestran nombres tras recarga; etiquetas conservadas si el draftPatch trae solo IDs. |
| Servicio adicional | Ensamblaje10.55EUR aparece en M tras recuperar proyección. Sin repetir asociación. |
| Inventario | Recarga conserva10/2/1→7, L5/1/0→4, M8/1/1→6. Nueva ficha no fija main-warehouse; BFF resuelve contexto si no hay selección explícita. |
| SEO | Canonical/alias INACTIVE y sitemapfalse persistidos. Auditoría cuenta0activos; el alias inactivo sigue siendo editable. |
| Imágenes/metadata | Dos imágenes452×452 cargadas. Alt/título editados de portada persistieron tras guardar/recargar. Se añadió actualización de assets ya subidos, antes omitida. |
| Lookups/transporte | Retirado includeInactive obsoleto de configuración. Lecturas acotadas; última carga sin avisos de indisponibilidad. |
| Precio base | No toma el pricingId de una regla específica devuelta primero. Conserva base y específica separadas tras guardar. |
| Storefront preview | Ahora carga Admin; PDP pública404 coherente con producto offline/canonical inactivo. No se publicó para probarla. |

## Identidad y evidencia

Producto `9fd81ffc-51b3-45cc-8448-80b60e666e13`, «Casco QA integral PW 20261106». Última operación `pso_fdb949c5-6bfb-4cdc-888a-68d0a9494bdf`, correlación `ui-1793976368667-3d90e4b395b96`. Guardado observado13.482s.

La primera prueba corregida de stock añadió las cantidades en warehouse-default, porque la prueba inicial había usado main-warehouse. No se borró ni movió el stock inicial de ese producto QA; la lectura comercial usa el almacén seleccionado del contexto.

Captions finales: alt «Imagen de cascos utilizada para la prueba QA PW 20261106»; título «Portada de control QA PW 20261106». Comprobación DOM de ambas imágenes: complete=true y naturalWidth/naturalHeight452.

Snapshots focalizados sin cabecera Employee en `evidence/20261106/product-full/fixed-*.yml`.

## Validación

- UI:77PASS en pruebas de editor/acciones/contexto/recuperación/login/deadlines. `npm run lint` PASS con3warnings previos; `npm run build` PASS.
- BFF:55PASS; buildPASS y lint focalizadoPASS. Lint global ejecutado pero falla fuera del alcance (2064errores en esa foto; se corrigió el formato de nuestros archivos después). No se afirma repo global verde.
- ReadIndex:74PASS,14suites; buildPASS. No tiene script lint propio.
- `git diff --check` focalizadoPASS.
- Recorrido Playwright real con sesión Employee y BFF, sin mocks.

Un guardado inicialmente agotó el deadline15s aunque el backend terminó después. La mutación ahora usa60s sin ampliar lecturas y conserva idempotencyKey para reintentos inciertos. No se atribuye rollback a un timeout ni se declara resuelta la latencia por ampliar el deadline.

Se preservaron los cambios ajenos. No se publicaron productos ni se modificó el producto de control. No se ejecutaron hard-delete, duplicación, checkout, benchmark, axe ni matriz responsive en esta corrección funcional; no se certifican esos flujos. No se añadió nueva asignación propia de imagen/precio de variante.

El runtime de proyección queda activo, inventariado en `.tmp/catalog-qa-repair/processes.json` del backend, usando credenciales/scopes existentes. No es autoarranque tras reiniciar el ordenador. No hubo grants, rotaciones, proveedores, purgas ni rebuild masivo. Eventos históricos ajenos en DLQ permanecen fuera de este cierre.
