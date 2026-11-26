# Vigencia por fechas opcionales — 2026-11-13

Petición de Ricardo: confirmar que Pricing soporta inicio y final independientes
y retirar el check «Ilimitado» del formulario de precios específicos.

## Confirmación e implementación

Se ejecutaron las funciones reales compiladas de Pricing `buildPriceForCreate`,
`buildPriceForUpdate` e `isPriceActiveAt`, y el `pricePayload` real del BFF.
Con hora de consulta anterior/durante/posterior se comprobó:

| Inicio | Final | Aplicación temporal |
| --- | --- | --- |
| Vacío | Vacío | Sin restricción temporal |
| Definido | Vacío | Desde el inicio, sin vencimiento por fecha |
| Vacío | Definido | Sin límite inicial, hasta el final |
| Definido | Definido | Solo dentro del período |

Siempre sujeto a actividad, contexto y cantidades de la regla. Se mantiene la
inclusión de ambos extremos del contrato existente. No cambia el núcleo de Pricing.

El check se elimina del estado y del DOM del formulario. Ambos campos quedan
siempre habilitados y son opcionales. El booleano interno `unlimited` se conserva
por compatibilidad del borrador y se deriva de la ausencia de fecha final; ya no
hay un control independiente que pueda contradecirla. No se convierten datos
antiguos ni se normalizan masivamente reglas existentes.

Se reprodujo antes del cambio una omisión del BFF: al borrar el inicio, el
payload no incluía `validFrom`, por lo que Pricing conservaba el valor anterior.
`AdminProductSaveOperationUseCase.pricePayload` ahora reenvía el `null` explícito
para retirar cualquiera de los límites. Los campos omitidos siguen omitidos,
sin borrar fechas de clientes antiguos; se conserva también `unlimited` legado.
No cambia ningún DTO ni se añade un endpoint.

## Pruebas ejecutadas

UI:

```sh
node --test tests/product-price-dates.test.mjs tests/product-bff-scope.test.mjs tests/product-editor.test.mjs tests/product-save-operation-action.test.mjs tests/pricing-admin.test.mjs
npm run lint
npm run build
npx playwright test tests/e2e/admin-login.spec.ts -g 'specific price supports optional dates|product pricing preserves legacy BASE|specific prices use a separate products-style table|pricing simulator sends future Madrid' --reporter=line
```

- **83 pruebas UI PASS**; lint **0 errores/3 advertencias previas**; build correcto.
- **8 Playwright PASS**: las cuatro combinaciones editando una regla con fechas
  ya persistidas en el fixture, reapertura del formulario y payload multipart
  final. Incluye retirada de inicio/final, final siempre habilitado y ausencia del
  check, más las regresiones de fechas de Madrid, tabla, lateral y simulación.

BFF, desde `apps/bff`:

```sh
npm test -- --runInBand --no-cache --cacheDirectory=/tmp/ecommium-open-price-dates-bff-tests admin-product-save-operation.use-case.spec.ts admin-pricing.controller.spec.ts
npx eslint src/modules/product/application/save-operation/admin-product-save-operation.use-case.ts
npm run build
```

- **66 pruebas BFF PASS**, incluidos los cuatro pares explícitos de límites en
  update y la compatibilidad con omisión/booleano legado. Lint runtime sin errores;
  build correcto.
- Comprobación adicional con módulos reales de `services/pricing/dist` y
  `apps/bff/dist`: las cuatro combinaciones atraviesan `pricePayload` y
  `buildPriceForUpdate`; **12 comprobaciones temporales correctas**, incluida
  la retirada efectiva del inicio y final anteriores mediante `null`.

La comprobación del núcleo usa funciones reales con datos sintéticos, sin
transporte ni base comercial. Playwright usa Next real con BFF fixture. No se
ejecutan migraciones, despliegues, mutaciones de catálogo comercial ni un ensayo
autenticado sobre servicios distribuidos. No se recertifican cachés/proyecciones
remotas ni se cierran los pendientes de seguridad existentes.
