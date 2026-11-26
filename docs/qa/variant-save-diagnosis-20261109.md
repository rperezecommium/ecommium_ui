# Diagnóstico y corrección controlada del guardado de variantes

## Test de extremo a extremo solicitado: listado y PDP

Resultado general FALLIDO, sin nuevas altas. El guardado del borrador existente tiene recibo published (operación documentada abajo), pero el producto no ofrece una lectura completa de su variante.

| Paso | Resultado |
| --- | --- |
| Guardar variante existente con imagen/precio/stock1 | BFF confirma todos los bloques y published |
| Reabrir editor en pestaña nueva | FALLO: solo default,0variantes adicionales |
| Listado Admin por nombre Argon18 | Aparece el padre Serie172; referencia No disponible. El listado actual tiene filas de producto, no filas independientes de SKU |
| Preview Storefront real desde Admin | FALLO:404, aun con producto Admin activo/visible y canonical ACTIVE/sitemap |
| URL pública canonical /…080eb6a9/p | FALLO: página404 |
| Seleccionar variante en PDP y comprobar imagen/precio/stock | BLOQUEADO por404; no se declara PASS |

Contraste de solo lectura directamente contra apps/bff con sesión Employee efímera y logout al terminar (sin tokens en salida/archivos, sin bearer técnico ni acceso a servicios internos):

- GET StoreAdmin /admin/products/080eb6a9-11e6-45c9-8719-fc326225452e/editor-state:200, variants contiene solo f03e68e1-2690-4be7-8d32-feb82b580e9c, SKU BICI-20260929-172, default=true. variantRows contiene únicamente PRODUCT_SIMPLE. warnings vacío.
- GET StoreAdmin /admin/products/080eb6a9-11e6-45c9-8719-fc326225452e/variants:200, items contiene solo la misma default. No llega c93475b3-b851-48dc-9e8b-0e5744c96058.
- GET Storefront /storefront/pdp/imp-bf62d289bb-argon-18-bicicleta-de-gravel-grey-matter-rival-1-serie-172-172-080eb6a9 con organization111…/shop222…/localees-ES:404 tanto channelweb como channeladmin.

Esto descarta que el parser/render de variantes UI esté eliminando una variante presente en esas respuestas. No demuestra aún si el origen está en proyección, persistencia canónica o alcance/contexto del guardado. Revisar esas causas requiere sincronización explícita de backend; no se soluciona mostrando snapshots locales como datos confirmados de lectura.

Capturas PW en .tmp: variant-qa-product-list-20261109.png, variant-qa-public-pdp-404-20261109.png y variant-qa-storefront-bff-404-20261109.png. Preview correlación ui-1794221296658-b3736c1ed6054. No se modifica código funcional en esta comprobación.

## Revalidación Playwright real posterior

Solicitud expresa de Ricardo: probar la corrección en PW. Se conserva la pestaña del fallo anterior (no se acepta salida con pérdida de cambios) y en otra pestaña se restaura el borrador local existente, sin añadir variantes ni imágenes nuevas. Misma variante BICI-20260929-172-QA-L-1109, combinación corregida ya presente size=qa-l-20261109, precio3814.65 y stock1. Guardar cambios completa la operación pso_231d6c7f-d639-4659-87d1-02b72dacb74c, correlación ui-1794220834486-31555e5db9d15, estado published. Auditoría confirma catalog/variants/variantMedia/specifications/pricing/inventory/shipping/routingSeo/publish Correcto y media Sin cambios. Sin errores de campo. El BFF confirma la asignación de la imagen de prueba previamente subida.

Una pestaña nueva inmediatamente posterior sigue mostrando Activa/Visible, precio3814.65, stock principal29 y Sin variantes adicionales. Por tanto se valida el guardado del borrador corregido, pero no la lectura consistente de la variante ni su stock/precio/imagen tras recarga. No se repite creación ni se declara resuelto el conflicto original size=l; el valor de prueba corregido ya estaba guardado en el borrador de la prueba anterior. El flujo de recuperación parcial se validó en fixtures; este envío real terminó con éxito sin necesitar retry.

Evidencia: `.tmp/variant-qa-save-confirmed-20261109.png` y `.tmp/variant-qa-read-stale-20261109.png`. Revisión automática rechazó aceptar el beforeunload por riesgo de perder el borrador; se canceló la salida y se usó otra pestaña conservando la anterior. No se consultó/modificó el repo backend.

## Alcance

Mismo trabajo, sin crear chats/tareas ni delegar. Cambios exclusivamente en ecommium_ui. La reproducción real fue por Playwright como Employee, sobre Tienda Barcelona, producto080eb6a9-11e6-45c9-8719-fc326225452e, referencia BICI-20260929-172. No se inspeccionó ni modificó el repo backend. No se ejecutan nuevas mutaciones reales durante la investigación/corrección.

## Evidencia y causas

1. Guardado real pso_53e35f6d-ea7f-43ab-ab15-d15c7a420907, correlación ui-1794219585503-66e3f770ac50c: respuesta partial_failed, catalog/shipping success y variants failed con «variant option combination already exists for this product». El draftPatch ya contiene variantId c93475b3-b851-48dc-9e8b-0e5744c96058 y basic.isActive=false. Media/asignación/precios/inventario/publicación quedan pending. Esto prueba persistencia parcial, no rollback ni éxito de variante completa.
2. Error UI confirmado: conservaba solo la clave de idempotencia. Tras aplicar draftPatch, el siguiente intento reconstruía un payload distinto (IDs/estados/archivos cambiados); una edición tampoco invalidaba la clave. El BFF posterior devolvió conflicto, correlación ui-1794219677553-224369f90e99a. La causa interna exacta del409 requiere sincronización BFF; la violación de identidad comando/clave en la UI es reproducible sin backend.
3. Error de contrato UI confirmado: recuperación real usa actionId/block/kind; el cliente tipaba sin adaptar como code/targetBlock/retryable. El botón se mostraba, pero retryable ausente impedía ejecutar el reintento. Corregido en el borde de la respuesta, compatible con ambas formas.
4. Error UI confirmado: la tabla mostraba defaultVariantId en Referencia cuando faltaba reference. Ese UUID no es el SKU humano. Se retira la sustitución; se muestra No disponible cuando BFF no entrega la referencia. No se inventa un SKU ni se hacen lecturas de detalle por cada fila.
5. Lectura real posterior: producto Activo/simple/0variantes y3imágenes, distinta al patch confirmado. Se repitió la lectura tras espera. UI ya usa no-store; no es lícito deducir rollback ni ocultar el patch con esa lectura. Proyección/reconciliación requiere diagnóstico BFF/ReadIndex.
6. Atributos: tanto selector como pantalla independiente tab=attributes muestran0. No hay evidencia suficiente de un error de selección: la ausencia de configuración SKU es compatible con lo observado. No se crean atributos para disimular el fallo de variantes.

## Implementación UI

El intento de guardado conserva el comando multipart original en memoria (incluidos archivos) y su clave. Tras fallo parcial reconocido por operationId, el patch se aplica al editor y se registra su firma como base reconocida. Reintentar sin cambios reproduce el comando original; editar sobre lo reconocido inicia otra clave conservando IDs confirmados. Éxito o rechazo definitivo termina el intento. Ante resultado de transporte incierto se conserva el comando original; no se permite lanzar una operación distinta sin confirmar el anterior. No se guardan tokens ni snapshots binarios en localStorage.

Errores HTTP definitivos (incluido409) no ofrecen reintento automático indiscriminado. Timeout/red/408/429/5xx y respuesta exitosa no interpretable se presentan como resultado sin confirmar, con retry del mismo comando. No se marca catalog failed a partir de un fallo de transporte que no demuestra rollback. El adapter conserva correlationId y mensajes públicos existentes.

No se altera la publicación confirmada por BFF para aparentar que el producto continúa activo. No se silencian duplicados, generan sufijos automáticamente, recrean variantes ni se implementa un orquestador alterno en Next.

## Sincronización BFF necesaria para cerrar el flujo real

La guía AGENTS exige sincronización explícita ante diferencias con BFF y prohíbe consultar/modificar backend por iniciativa propia. Se solicita autorización acotada para revisar Catalog/BFF y ReadIndex relativos a este producto, sin purgas ni reparaciones masivas.

Contrato/criterios a verificar conjuntamente:

- Unicidad de combinación: comparar con variantes reales en el mismo producto/scope, excluir la propia identidad al actualizar y definir tratamiento de variantes inactivas. Debe ser posible distinguir conflicto legítimo de actualización de la misma variante. El error debe identificar la variante conflictiva de forma segura.
- Creación/reanudación: persistir identidad local→variantId y opciones de forma recuperable; replay de la misma operación no recrea la variante ni duplica opciones. Se debe verificar la política exacta de hash/reanudación de product-save-operations antes de certificar compatibilidad del replay.
- Producto activo: definir y probar si un fallo en una variante nueva preserva la publicación anterior o puede desactivar el producto. Un cambio de estado parcial debe ser explícito en el recibo, nunca contradicho por una lectura silenciosamente obsoleta.
- ReadIndex/editor-state: incluir las variantes confirmadas, opciones y disponibilidad; reflejar versión/operación pendiente cuando la proyección aún no alcanza el recibo. No sustituir consistencia con polling sin límite.
- Listado: devolver reference como SKU de default y soportar búsqueda por ese SKU con paginación BFF. No hacer búsqueda frontend ni escaneo completo de productos.
- Reconciliación: contrato de consulta de operación por operationId o clave para resolver resultados inciertos tras recarga/timeout sin repetir mutaciones nuevas. No se asume que existe un endpoint no documentado.

## Validación

Pruebas unitarias/contractuales: tests/product-save-attempt.test.mjs, product-editor.test.mjs, product-save-operation-action.test.mjs y product-bff-scope.test.mjs:65 PASS. Cubren copia exacta de comando/archivo, patch con IDs, edición tras fallo, incertidumbre, rechazo definitivo y shape real de recuperación.

E2E aislados: reintento parcial, edición tras fallo, limpieza de clave tras éxito y presentación de recuperación. Se refuerza la expectativa para comparar draft serializado además de clave y se usa actionId/block/kind del BFF real. Las pruebas existentes que solo verificaban igualdad de clave no detectaban el defecto.

Resultados finales:65 unitarios/contratos PASS; npm run build PASS; npm run lint0errores/3avisos previos ajenos. Cuatro E2E PASS mediante `npx playwright test tests/e2e/admin-login.spec.ts -g 'reuses idempotency key when retrying a partial save|correcting an acknowledged partial save|clears idempotency key after a successful retry|shows BFF recovery actions after partial save failure'`. El BFF fixture rechaza409 si se reutiliza clave con otro draft y la recuperación se prueba mediante clic real. Playwright requiere permiso para escuchar loopback; no utiliza el backend real en esta regresión.

No se ejecuta nueva creación real hasta sincronizar BFF. No se certifica cierre del duplicado, stock/precio/asignación persistidos de la variante, búsqueda SKU, consistencia ReadIndex ni estado final publicado. Sin cambios a hallazgos de securityReadme ni medición de performance/a11y nueva; no cambia carga de datos inicial ni estructura de pantalla.


### Cierre local autorizado de BFF/ReadIndex — 2026-11-09

Se resolvieron los gaps pendientes descritos anteriormente: runtime de proyección detenido, duplicación de opciones sin ID, desactivación durante guardado parcial y búsqueda sin SKU. Playwright real confirma BICI-20260929-172 en listado por SKU padre/variante, reapertura y segundo guardado sin duplicar, PDP con selección QA, imagen cargada, stock1 y precio4196,12 EUR. Se reutilizó la variante existente; no se creó otra. Backend: 52 pruebas BFF +14 ReadIndex +3 runtime PASS y builds BFF/ReadIndex PASS. Evidencia detallada en composable_ecommerce/.docs/qa/variant-publication-recovery-20261109.md. Sin nueva certificación de Lighthouse/a11y/checkout ni despliegue productivo.
