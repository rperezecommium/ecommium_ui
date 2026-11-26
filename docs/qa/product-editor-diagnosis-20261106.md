# Diagnóstico y correcciones por caso — 2026-11-06

Continuación de [QA integral](product-editor-integral-20261106.md). Backend consultado en lectura; no se modificaron servicios, configuración, bases de datos ni procesos.

## 1. Reapertura y búsqueda — pendiente backend

Consulta directa autenticada al BFF, con la misma sesión Employee y contexto de la UI:
- GET `/admin/products/9fd81ffc-51b3-45cc-8448-80b60e666e13/editor-state`: HTTP503, `ADMIN_PRODUCTS_READ_INDEX_HTTP_503`.
- GET `/admin/products?q=Casco%20QA%20integral%20PW%2020261106&limit=20&offset=0`: HTTP200, total0.

El BFF carga el detalle desde ReadIndex. `prisma-admin-catalog-detail-read.repository.ts:getProduct` devuelve READ_INDEX_NOT_READY si no encuentra la fila proyectada. También puede fallar al resolver el contexto; no se acredita todavía cuál de esas condiciones produce este503. El log de arranque Catalog informa «Catalog outbox relay disabled by configuration»; es una pista del circuito de proyección, no causa operativa probada. La última revisión del producto de control también mostró indisponibilidad, de modo que el alcance puede ser mayor que el registro nuevo.

## 2. Simulador — defecto backend identificado, feedback UI corregido

GET directo a `/admin/pricing/preview`, VIP, quantity3, devuelve HTTP503 con `ADMIN_PRICING_READ_INDEX_HTTP_400`.

Causa estática verificable: `admin-pricing.controller.ts:previewAppliedPrice` envía quantity y priceTableId a `HttpAdminPricingReadIndexReader`. `read-index.controller.ts:getAdminComputedAutoPrice` no permite esas claves y `payload` rechaza claves desconocidas con400, incluso nulas. No se debe suprimir cantidad en UI: eliminaría la condición que se intenta probar.

Además, `prisma-admin-pricing-read.repository.ts:matchesPricingParams` solo compara moneda, país, política, canal, grupo y tabla. No evalúa cantidad mínima ni vigencia. Si el parámetro solicitado está vacío, acepta cualquier valor restringido de la regla. `matchesItem` mezcla productId y variantId. Estas condiciones requieren regresiones backend antes de certificar99EUR para VIP desde3 unidades.

UI ahora distingue ERROR de NOT_APPLIED: error de simulación, resolución no disponible y fallback sin evaluar. Se conserva el identificador de correlación.

## 3. Recuperación local — protección UI aplicada, recorrido pendiente

La UI eliminaba la copia local incluso ante respuestas parciales con productId y seguía en `/new`. Ahora solo marca limpio con result.ok, conserva el snapshot y actualiza su copia con identidades recibidas en la respuesta. No se fuerza navegar a un detalle que actualmente falla. Se limpia el aviso obsoleto del borrador recuperable tras éxito. Esto no prueba la recuperación completa del guardian; ese caso requiere prueba de navegador.

## 4. Características — corrección UI con regresión

La selección guarda nombres, pero el draftPatch puede volver solo con IDs y reemplazar esos nombres. La Server Action conserva las etiquetas anteriores únicamente cuando coinciden fieldId y fieldValueId. Nunca aplica el nombre anterior a un valor cambiado. Lectura independiente tras recarga sigue pendiente de ReadIndex.

## 5. Servicios asociados — pendiente diagnóstico de proyección

La acción adjunta mediante BFF y después consulta el listado proyectado. La confirmación de escritura no garantiza que ese listado refleje la asociación. No se agregó una asociación local inventada ni se repitió el POST. Falta contrastar actualización del snapshot de Pricing y payload de offeringVariants.

## 6. SEO — contador corregido; cambio de estado pendiente

El contador UI contaba todos los aliases no borrados, incluidos inactivos. Ahora exige status ACTIVE. La UI envía status seleccionado; el caso de uso backend conserva ACTIVE/INACTIVE. La observación de ruta activada exige seguir la respuesta del owner y el draftPatch; todavía no se atribuye a una capa concreta ni se declara resuelta.

## 7. Feedback — correcciones parciales

Se evita duplicar Continuar editando si ya existe entre las acciones recomendadas del BFF. Los badges de guardado no equivalen a verificación de lectura ni de precio efectivo. Avisos obsoletos de lookups y recuperación guardian siguen pendientes de validación.

## Validación de esta tanda

- `node --test tests/product-save-operation-action.test.mjs tests/product-editor.test.mjs`:53PASS; dos regresiones nuevas para ERROR técnico y etiquetas de selección. Se actualizó el harness para las dependencias actuales de sesión/formulario.
- `npm run lint`:PASS, tres advertencias preexistentes.
- `npm run build`:PASS.
- `npx tsc --noEmit`:PASS previo a los últimos cambios; build final incluye TypeScript.
- `git diff --check` en archivos tocados:PASS.
- Playwright: confirmación directa de las tres respuestas BFF anteriores. La comprobación visual del simulador corregido no se pudo completar: el producto de control pasó a mostrar error de carga. No se afirma PASS de navegador de las correcciones.

Sin publicación ni mutaciones adicionales de productos de control. No se ejecutaron axe, Lighthouse ni pruebas responsive en esta tanda. Backend requiere autorización de edición; su AGENTS.md exige confirmación explícita antes de cambios persistentes. La validación integral sigue abierta.

## Seguimiento

Tras la autorización de edición de ambos repos, se aplicaron y verificaron las
correcciones descritas en [reparación integral](product-editor-repair-20261106.md).
Los pendientes anteriores describen la observación inicial y no el estado final.
