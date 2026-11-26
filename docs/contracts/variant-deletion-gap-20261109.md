# Eliminación revisada de productos y variantes

Fecha: 2026-11-09. Implementado y validado localmente; NO activado en las bases configuradas.

La UI consume exclusivamente BFF. Requiere sesión Employee, contexto y permiso `catalog.products.delete`. El diálogo muestra impacto y bloqueos, exige la referencia exacta y permite cancelar sin mutaciones. Las variantes sin guardar conservan Quitar; las persistidas usan Eliminar. No se elimina la variante predeterminada de forma aislada.

## Contrato implementado

- GET `/admin/catalog-retirements/capability`.
- POST `/admin/products/:productId/deletion-preview` y `/admin/products/:productId/variants/:variantId/deletion-preview`: revisión persistida, ligada a actor/contexto, caducidad cinco minutos y versiones de owners.
- POST en esas mismas bases `/deletion-operations`: body `{reviewId, version, confirmationRefId}`, `Idempotency-Key` obligatorio; devuelve202.
- GET `/admin/catalog-retirements` paginado y GET `/admin/catalog-retirements/:id`.
- POST `/admin/catalog-retirements/:id/retry`: avanza la misma operación durable.
- GET `/admin/catalog-retirements/:id/projection-proof`.

Catalog coordina quince pasos: preparar Inventory, Pricing, Routing/SEO, Media, CMS y Search; sellar Catalog; retirar el origen; purgar los seis participantes; verificar proyecciones y caché. Antes de sellar, un fallo libera las preparaciones (`ABORTING` → `ABORTED`) sin borrar el origen. Después del sellado se reanuda sin fingir rollback. Estados adicionales: RUNNING, RETRYABLE, AWAITING_PROJECTION y COMPLETED. Nunca se anuncia éxito por aceptar el comando.

Se protegen identidades retiradas contra escrituras antiguas. Inventory bloquea reservas activas; Pricing bloquea reglas compartidas que requieren revisión. Los medios exclusivos de producto incluyen originales y miniaturas; retirar una variante conserva imágenes legítimas de la galería del padre. Referencias compartidas o CMS pueden bloquear la operación. Se preservan pedidos, facturas, auditoría mínima y recibos de idempotencia.

Routing/SEO retira canonical, aliases y cadenas de redirección entrantes en todos los idiomas afectados. No crea redirecciones a portada. La variante no retira el sitemap del padre. ReadIndex verifica ausencia en proyecciones operativas de todos los contextos activos. Caché pública usa revisión monotónica por tienda; el modo edge debe ser explícito (`none` con no-store o `purge` con confirmación del proveedor).

La UI incluye `/admin/catalogo/eliminaciones`, `/sitemap.xml` dinámico y `/robots.txt`. Sitemap usa contexto canónico y BFF, escape XML y máximo50.000 entradas. Search conserva un ledger privado durable; despliegues con varios escritores requieren almacenamiento compartido adecuado.

## Activación pendiente

Se prepararon seis migraciones aditivas (Catalog, Inventory, Pricing, Media, Routing/SEO y CMS). El plan detectó seis bases remotas. La revisión automática rechazó aplicar DDL por exceder la autorización local y por posible impacto en bases compartidas. Ninguna migración remota se aplicó; no se habilitaron flags ni se borraron productos reales. La CLI exige aprobación explícita de acceso remoto antes de `apply --allow-remote`; `enable` exige migraciones aplicadas.

Pruebas y límites: ver evidencia `catalog-retirement-20261109.md` en la carpeta QA de este repositorio. No se certifica todavía el recorrido real Admin→PDP contra esas bases ni borrado real en proveedores externos.


## Activación autorizada — 2026-11-09

Ricardo autorizó expresamente las migraciones remotas. `catalog-retirement-runtime.mjs apply --allow-remote` aplicó las seis migraciones y `enable` verificó las seis APPLIED y configuró flags locales. Reinicio canónico de los once servicios afectados: health correcto. Prueba Playwright real en curso con QA-RETIREMENT-20261109-1543; BICI-20260929-172 se conserva activo en el listado. Esta actualización sustituye el bloqueo de activación descrito anteriormente.


Actualización 2026-11-09: autorización remota recibida, seis migraciones APPLIED y flags locales activos. Playwright real completó eliminación de variante y producto QA; BICI-20260929-172 preservado. Evidencia: catalog-retirement-20261109.md en QA. Sustituye el estado previo de activación bloqueada.
