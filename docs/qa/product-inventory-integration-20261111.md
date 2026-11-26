# Inventario integrado en producto y variantes — 2026-11-11

## Resultado y alcance
Se retira la pestaña Inventario; Ajustes básicos y Variantes comparten ProductInventoryPanel. Selector por nombre de almacén, alta asistida con permiso shipping.logistics.write, existencias/reservado/seguridad compactos, tabla de disponible/estado/origen, estimación local y reintento de errores. Resumen conjunto desplegable selecciona variante; no duplica totales compartidos.

Se mantienen las cantidades de cada variante aisladas. Cambiar almacén lee el registro exacto mediante BFF/Inventory sin copiar el anterior ni escribir al guardar otro bloque. Campos pendientes impiden cambiar de almacén hasta guardar. El editor no es una matriz de múltiples ubicaciones: una ubicación seleccionada por variante, contexto comercial inicial al reabrir.

## Contratos y autorización
Ampliación del catálogo y aplicación de migración remota autorizadas explícitamente en el chat. GET/PUT admin/shipping/warehouses, GET admin/inventory/stock-levels. La base contenía una tabla preexistente con países JSONB; se adaptó el esquema y la migración sin borrar/converter datos. Primer intento falló al existir tabla; migrate resolve --rolled-back y deploy compatible posteriores correctos. Hay una migración histórica registrada en base ausente localmente: no se tocó su historial. Backend ADR-0315.

Reservado sigue editable según contrato. Restaurar stock propio persistido sigue sin operación de retirada; acción deshabilitada con explicación. Valores de almacenes antiguos fuera del catálogo se preservan. Disponibilidad no es editable. No se crean reservas de pedidos ni transferencias de stock.

## Evidencia real
Servicios Shipping, Inventory y BFF reiniciados y saludables. Chrome autenticado, Tienda Barcelona, copia QA c745417b-6f0c-457c-b759-04b34566069d sin publicar. Creado almacén «QA Inventario 20261111» (muelle QA-01, ES, ID 8df995ce-cae9-4a4f-b63a-85c7f453edf5). Se guardó stock base 3 existencias, 1 reservado, 1 seguridad: 1 disponible. Bloque inventory confirmado success en operación saved_unpublished. Tras recargar se seleccionó el almacén QA y la lectura canónica mostró 3/1/1 y 1 disponible. Resumen y selección de otra variante visibles. No se modificó el producto original, ni se publicó ni se hizo checkout. Quedan almacén QA y stock en la copia QA.

La prueba real descubrió que la tabla antigua no tiene defaults de fechas; el repositorio ahora inserta timestamps explícitos. También apareció NotFoundError del DOM al actualizar el botón Guardar; se estabilizaron el nodo del spinner y el contenedor del texto. La persistencia ya estaba confirmada y la recarga funcionó.

## Verificación
Resultados y comandos finales se agregan al cierre. Axe se ejecuta sobre el panel de inventario; el contraste inicial falló y se corrigió localmente usando tokens existentes. No se afirma auditoría global del Admin. Capturas responsive del panel a 1440/768/390 px en test-results. Sin Lighthouse nuevo ni benchmark de tablas masivas: el resumen utiliza las variantes ya cargadas y el catálogo de referencia está acotado a 500.


### Resultados de cierre

- `npm run lint`: PASS, 0 errores y 3 avisos previos ajenos al cambio.
- `npm run build`: PASS.
- `node --test tests/product-inventory.test.mjs tests/product-editor.test.mjs tests/product-save-attempt.test.mjs`: 50 PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'integrated inventory edits|variant shipping inherits|added offering appears'`: 3 PASS. Inventario cubre consulta sin marcar cambios, cantidades por variante, bloqueo de cambio de almacén con cantidades pendientes, resumen, payload de guardado, axe sin incidencias y anchuras 1440/768/390 con capturas. En móvil se recoge la navegación existente antes de revisar el panel.
- BFF `npx jest manage-warehouses.spec admin-inventory.controller.spec admin-shipping.controller.spec admin-product-save-operation.use-case.spec --runInBand`: 44 PASS. Incluye rechazo de tenant ajeno y ninguna escritura por readOnlySelection. Build y ESLint focalizado PASS.
- Shipping `npx jest shipping-warehouses.use-case.spec shipping-options.resolve.use-case.spec --runInBand`: 7 PASS; build PASS y Prettier focalizado. `npx prisma validate --schema prisma/schema.prisma`: PASS.
- Inventory `npx jest inventory.stock-level.get.use-case.spec stock-level.aggregate.spec --runInBand`: 7 PASS; build PASS y Prettier focalizado.
- Shipping/Inventory no tienen configuración ESLint utilizable propia: se documenta la limitación, sin crear una configuración paralela. No se ejecutó lint global backend con --fix sobre cambios ajenos.
- Migración: status detectó exclusivamente la nueva pendiente local y un historial previo divergente; intento inicial falló sin insertar datos al existir tabla. Tras inspección de columnas e índices se usó `npx prisma migrate resolve --rolled-back 20261111190000_shipping_warehouses --schema prisma/schema.prisma` y `npx prisma migrate deploy --schema prisma/schema.prisma`: PASS. Tabla preexistente preservada.
- Servicios reiniciados mediante Node 22 + `./scripts/postman-services.sh restart-selected shipping inventory bff-admin bff-storefront`; health correcto. BFF reiniciado de nuevo tras protección de consultas sin escritura.

Total focalizado: 108 pruebas unitarias/contratos y 3 E2E. No equivale a ejecutar toda la suite del monorepo. No se realizó despliegue remoto de aplicaciones, Lighthouse ni checkout real.

Ajuste solicitado: «Resumen de inventario» se traslada a Auditoría. Sus enlaces seleccionan la variante y abren Variantes para editar; el formulario de inventario permanece integrado en Ajustes básicos/Variantes.
