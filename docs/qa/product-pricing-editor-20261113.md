# Editor de precios — 2026-11-13

Alcance autorizado: retirar el bloque visual de contexto del precio base,
preservar registros existentes, corregir fechas y la selección del simulador de
producto completo. No se implementan descuentos porcentuales ni se cambia el
modelo comercial, las rutas o los contratos BFF. No se modifican datos comerciales.

## Cambios

- `product-editor-client.tsx`: retira solo «Contexto avanzado de precio base».
  Se mantienen Básico/Variantes, tabla de precios, precios específicos y simulador.
- `products.ts` y `product-editor-types.ts`: conservan BASE antiguos con tabla,
  sus IDs, importe, contexto, vigencia, zona, actividad y prioridad. El lector
  los descartaba antes y generaba un precio vacío en el borrador. No se retira
  ninguna restricción ni se reclasifica el registro persistido.
- `product-editor-validation.ts`: un precio de variante con identidad persistida
  conserva su propio contexto; no copia las condiciones del producto al guardar.
- `product-price-dates.ts`: convierte ISO a hora local; conserva el ISO original
  si el campo no cambia (incluidos segundos/milisegundos), y su ocurrencia si se
  edita dentro de una hora repetida. Rechaza horas inexistentes, en vez de
  desplazarlas automáticamente. Una fecha nueva ambigua usa la primera ocurrencia
  elegida por `Date`; la reapertura de una segunda ocurrencia ya persistida no la
  convierte en la primera. No se añade un selector de zona ni de offset.
- BFF `AdminPricingController.resolvePreviewPrice`: producto completo evalúa el
  específico de producto antes del habitual propio de la variante predeterminada.
  Se mantienen fuentes del resultado y el resto de precedencias de ADR-0316.
- BFF `AdminProductSaveOperationUseCase.pricePayload`: conserva prioridad cero;
  solo la ausencia de prioridad aplica el default 10.

## Pruebas

Comandos desde `ecommium_ui`:

```sh
node --test tests/product-price-dates.test.mjs tests/product-bff-scope.test.mjs tests/product-editor.test.mjs tests/product-save-operation-action.test.mjs tests/pricing-admin.test.mjs
npm run lint
npm run build
npx playwright test tests/e2e/admin-login.spec.ts -g 'product editor applies the pricing preview simulator|product pricing preserves legacy BASE|pricing simulator sends future Madrid' --reporter=line
```

- Regresión UI: **83 PASS**. Incluye lectura/normalización/envío del precio
  habitual y del BASE contextual, preservación de la variante universal bajo un
  producto contextual y fechas en UTC, Madrid y Nueva York.
- Lint UI: **0 errores, 3 advertencias preexistentes** en customers-admin-actions,
  request-client e invoice-document-pdf. Build UI correcto.
- `git diff --check` detecta espacios finales anteriores en el editor, ya presentes
  en la copia de inicio de esta tarea; el diff contra esa copia no añade espacios
  finales. Se preservan los cambios previos del workspace.
- Playwright: **4 PASS**, navegador real sobre Next y BFF de prueba. Comprueba la ausencia
  del bloque, edición/reapertura de la segunda ocurrencia de octubre, preservación
  exacta del instante con segundos/milisegundos al editar solo el importe,
  modificación de minuto sin cambiar de ocurrencia, rechazo del hueco de marzo,
  y conservación del BASE contextual en el multipart enviado al BFF. Axe sobre
  los campos de la promoción: **0 violaciones**. Prueba adicional de simulación
  futura con variante/grupo/cantidad sin guardar datos.

Backend, desde cada paquete de `composable_ecommerce`:

```sh
# apps/bff
npm test -- --runInBand --no-cache --cacheDirectory=/tmp/ecommium-price-fix-bff-final regular-price.policy.spec.ts admin-pricing.controller.spec.ts admin-product-save-operation.use-case.spec.ts get-storefront-price-by-variant-id.use-case.spec.ts get-storefront-pdp.use-case.spec.ts
npm run build
npx eslint src/modules/pricing/presentation/http/admin-pricing.controller.ts src/modules/product/application/save-operation/admin-product-save-operation.use-case.ts
# services/pricing
npm test -- --runInBand --no-cache --cacheDirectory=/tmp/ecommium-price-fix-pricing-tests regular-price.policy.spec.ts price-rule-engine.domain-service.spec.ts price-resolution.domain-service.spec.ts price.resolve-batch.use-case.spec.ts price.computed.auto-get-by-item.use-case.spec.ts price.computation.helper.spec.ts price.admin.create.use-case.spec.ts price.admin.update.use-case.spec.ts price.admin.delete.use-case.spec.ts in-memory.price.repository.spec.ts
npm run build
npm run test:regular-price:postgres
# services/commerce-read-index
npm test -- --runInBand --no-cache --cacheDirectory=/tmp/ecommium-price-fix-readindex-tests projected-price-resolution.spec.ts prisma-admin-pricing-read.repository.spec.ts
npm run build
# services/checkout
npm test -- --runInBand --no-cache --cacheDirectory=/tmp/ecommium-price-fix-checkout-tests http.orderform-item-resolver.gateway.spec.ts
npm run build
```

- BFF **80 PASS**, Pricing **51 PASS**, ReadIndex **11 PASS**, Checkout **8 PASS**.
  Total, junto con UI: **233 pruebas unitarias/contractuales PASS**.
- Builds de BFF, Pricing, ReadIndex y Checkout correctos.
- Lint de los dos archivos runtime BFF: **0 errores**. Al incluir sus specs se
  observan **25 errores de formato preexistentes** fuera de los casos añadidos;
  no se aplica autofix global ni se declara el lint completo del backend en verde.
- PostgreSQL/HTTP: **1 ensayo integrado PASS**, base `regular_price_qa_<uuid>`
  creada y eliminada por el script. 72 contextos comparados entre SQL, dominio y
  proyección. Matriz adicional: simulador completo/variante explícita,
  Storefront y Checkout devuelven **1800** con la oferta activa y **3500** tras
  desactivarla. Los habituales persistidos no cambian.
- Fechas SQL/HTTP y simulador: medianoche y cambios de primavera/otoño de Madrid,
  antes/inicio/durante/final/después (**15 casos**). Inicio y final inclusivos;
  oferta 1800 dentro, habitual 2000 fuera. Se mantienen las pruebas existentes
  de grupos, cantidades, herencia, caché caliente, fiscalidad y aislamiento.

## Alcance de la evidencia y límites

- Docker comprobado: PostgreSQL, Redis y RabbitMQ healthy. El ensayo aplica
  migraciones solo a su base desechable. No ejecuta conversiones de catálogo,
  rollout, despliegue ni migraciones sobre las bases comerciales.
- El ensayo usa PostgreSQL real y las aplicaciones HTTP de Pricing/BFF mediante
  Nest/Fastify inject. El simulador usa el controlador real y el resolvedor real
  de ReadIndex sobre snapshots suministrados por el laboratorio. Checkout usa su
  gateway real con transporte dirigido a esa aplicación HTTP de Pricing.
- El contexto comercial y las relaciones de Catalog del laboratorio son fixtures.
  No certifica login Employee/Customer real, permisos de producción, asignación
  real a VIP, entrega de eventos RabbitMQ, proyección desplegada ni convergencia
  con Redis/CDN. Playwright usa BFF simulado, no esos servicios comerciales.
- En anchos 1440/768/390 los campos se verifican visibles. Se observa
  desbordamiento del panel de precios específicos: scroll/client 1108/1108,
  666/656 y 666/294 respectivamente. No se corrige el layout de otros bloques
  dentro de esta tarea, y no se declara certificación responsive completa.
- No se ejecuta el stack comercial con `./scripts/postman-services.sh` ni un
  recorrido autenticado completo contra sus datos. No se certifica producción.
- No se cierran hallazgos pendientes de `securityReadme.md`.
