# Características por categoría en producto — 2026-11-06

## Flujo aplicado

La caja de características abre con la ficha técnica organizada por grupos vinculados explícitamente a la categoría actual. Cada campo tiene su selector de valores activos; los campos aparecen aunque no se haya seleccionado todavía un valor. No se aplica herencia implícita entre categorías.

Al cambiar de categoría se conservan las selecciones existentes y se muestran aparte como «Añadidas al producto». Los campos de otros grupos se localizan con «Añadir otra característica», con búsqueda por nombre/grupo. Los atributos SKU, campos/grupos inactivos y valores inactivos no se ofrecen como características descriptivas. Las selecciones antiguas no disponibles siguen visibles hasta que el usuario las quite o cambie.

«Administrar características» abre un lateral que conserva el editor y permite:
- Crear una característica y un grupo, o añadirla a un grupo existente de la categoría.
- Añadir valores a una característica descriptiva.
- Vincular un grupo existente a la categoría actual, conservando su categoría primaria, vínculos anteriores, campos y atributos. La UI explica el alcance sobre todos los productos de esa categoría; no rellena automáticamente valores de productos.

El alta comparte los mismos campos con Catálogo > Características. La página de administración usa ahora AdminResourceDrawer: cierre, Escape, foco contenido y capa superior al aviso de recuperación, que antes podía bloquear el botón del formulario más alto. Las acciones de producto no redirigen ni guardan el producto. Solo una respuesta BFF con identidad confirmada incorpora la nueva definición al catálogo del editor.

Las mutaciones requieren catalog.specifications.write o permiso elevado en servidor y se ocultan sin ese permiso. Datos y mutaciones viajan por el cliente BFF existente; no hay endpoints Next nuevos ni llamadas directas a owners. Las relaciones usan categoryId/linkedCategoryIds del contrato existente. No se cambió backend en esta tarea.

Los valores siguen el contrato actual de catálogo: lista de opciones; pueden incluir unidad, como «10 kg». No se inventaron tipos numéricos ni una conversión de unidades fuera del BFF.

## Verificación real

Producto BICI-20260929-289, Bergamont bicicleta de gravel grandurance20, ID54435985-07df-4235-85dd-8e7a9463e4b2, categoría bicicletas013320a6-527e-4a80-8513-74e4b2b29ecd.

Se verificó con Playwright y sesión Employee que aparecen directamente los tres grupos actualmente vinculados a bicicletas, con sus selectores. El lateral muestra creación contextual, valores y vinculación; al cerrarlo el nombre del producto permanece y no hay cambios locales. No se mutó ni guardó el producto comercial ni se crearon definiciones QA adicionales en el catálogo real.

El campo existente «material» continúa siendo atributo SKU inactivo. No se convirtió ni reactivó automáticamente. Material descriptivo, altura o peso deben definirse explícitamente desde el nuevo lateral cuando corresponda. Vincular el grupo denominado material ofrece sus campos descriptivos activos actuales (durabilidad/elasticidad), no convierte el atributo material en característica.

## Pruebas y evidencia

- `node --test tests/product-feature-flow.test.mjs tests/catalog-feature-create.test.mjs tests/product-bff-scope.test.mjs tests/product-editor.test.mjs tests/product-save-operation-action.test.mjs tests/stock-admin.test.mjs`:73PASS.
- `npm run lint`:PASS,3advertencias previas ajenas.
- `npm run build`:PASS.
- `ECOMMIUM_STOREFRONT_BFF_BASE_URL=https://storefront.example.test npx playwright test tests/e2e/admin-login.spec.ts --grep 'product editor selects catalog feature|product feature groups|product feature administration|catalog attributes and features page|feature creation keeps|confirmed feature creation' --workers=1 --reporter=line`:6PASS. Servidores/tenants de prueba aislados; URL HTTPS solo para ese entorno de fixtures. Incluye crear característica, añadir valor, vincular grupo, mantener nombre/valor seleccionado, preview, rechazo de mutación, lectura proyectada retrasada y permisos.
- La primera ejecución E2E quedó bloqueada por listenEPERM del sandbox; se repitió autorizando loopback. Las regresiones detectaron el aviso de recuperación sobre el antiguo drawer y selectores de pruebas desactualizados; se corrigieron y la ejecución final está en verde.
- Axe-core WCAG2A/AA y2.1AA:0violaciones en `.productSpecificationsBasic` y `.productFeatureManager` después de corregir contraste usando --admin-text. No es auditoría global del Admin.
- Responsive1440/768/390:sin desbordamiento horizontal en el panel/documento observado. Escape cierra el lateral y restaura el flujo.
- `git diff --check` focalizadoPASS. No se ejecutó Lighthouse ni un benchmark de tiempos; no se afirma una certificación global de performance.

Captura focalizada: `evidence/20261106/product-feature-flow/category-fields.png`. No contiene cabecera ni datos de sesión Employee.
