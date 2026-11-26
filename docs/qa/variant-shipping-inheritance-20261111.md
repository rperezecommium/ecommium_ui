# Transporte heredado y excepciones por variante

## Resultado

Implementado en UI, BFF, Catálogo y Shipping con autorización explícita de Ricardo para revisar y ampliar el composable. Transporte vive dentro de Variantes. Variante 0 edita el paquete base; las adicionales muestran el efectivo y permiten editar directamente cada medida: editar crea el valor propio sin checkbox. «Restaurar herencia» por campo o para todo el paquete elimina la excepción. Cambiar la base actualiza los campos heredados sin copiar valores.

## Contrato

`draft.variants[].shippingPackage` contiene únicamente peso/ancho/alto/profundidad propios. BFF resuelve las identidades de variantes nuevas y guarda `product.shipping.variantPackages`, indexado por UUID de variante adicional, en el JSON existente. Editor-state lo rehidrata. Ausencia hereda; cero es propio; null retira el campo; objeto vacío restaura. PATCH de clientes anteriores que omite el mapa conserva las excepciones existentes.

Catálogo rechaza campos desconocidos, medidas negativas/fraccionarias y variantes ajenas o default. Shipping obtiene de Catálogo el paquete efectivo para variantes reales, con contexto Organization/Shop y entidades activas, antes de cotizar. La entrada técnica sin UUID del simulador conserva su comportamiento. Costes, transportistas y plazos siguen siendo configuración base del producto.

No se creó backend Next ni se aplicó migración. Decisión y contrato backend: ADR-0314 y documentación frontend-BFF.

## Evidencia real

Copia independiente sin publicar «QA Transporte heredado 20261111», producto `c745417b-6f0c-457c-b759-04b34566069d`, SKU `QA-SHIPPING-20261111`. El producto original Argon 18 no se modificó.

- Guardado base de 900 g y 200 × 100 × 300 mm.
- Ancho propio de 400 mm en primera variante: guardado y recarga mantuvieron 400; los demás campos siguieron heredados.
- Cambio de altura base a 150 mm: variante conservó ancho 400 y heredó altura 150.
- Restaurar herencia, guardar y recargar: 900 g y 200 × 150 × 300 mm, sin campos propios.
- Bloques catálogo, variantes y shipping confirmados como guardados.

La copia QA permanece sin publicar con herencia restaurada. No se ejecutó pago ni checkout real. La sustitución por medidas canónicas en cotización se cubre con pruebas de Shipping; no se afirma una venta real.

## Verificación

Comandos y resultados finales se registran al cierre: lint/build UI; pruebas unitarias UI de normalización y valores cero; Playwright focalizado de herencia/restauración; suites Catálogo de normalización, pertenencia y resolución por contexto; BFF de guardado e identidades; Shipping de paquete canónico y fallo sin fallback silencioso. Builds de los tres servicios. Shipping carece de configuración ESLint propia; se verifica compilación y formato de los archivos tocados.

No se ejecutaron axe, Lighthouse ni una auditoría responsive completa. La validación real se realizó en escritorio; no equivale a esos gates.

### Resultados de cierre

- `npm run lint`: PASS, 0 errores y 3 avisos previos ajenos al cambio.
- `npm run build`: PASS.
- `node --test tests/product-variant-shipping.test.mjs tests/product-editor.test.mjs`: 46 PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'variant shipping inherits'`: 1 PASS. Primer intento bloqueado por permiso de puerto loopback del sandbox; reejecución autorizada correcta.
- BFF: suites `admin-product-save-operation.use-case.spec` (30) y `admin-product-editor-state.controller.spec` (10), 40 PASS; build y ESLint focalizado PASS.
- Catalog: `product-shipping.value-object.spec`, `variant-shipping.resolve.use-case.spec`, `product.update.use-case.spec`, `product.aggregate.spec`: 10 PASS; build y ESLint focalizado PASS.
- Shipping: `shipping-options.resolve.use-case.spec`: 4 PASS; build y Prettier focalizado PASS. ESLint no disponible por falta de configuración del servicio.
- Servicios locales reiniciados con `PATH=/Users/ricardoperez/.nvm/versions/node/v22.23.2/bin:$PATH ./scripts/postman-services.sh restart-selected catalog shipping bff-admin bff-storefront`: health correcto en los cuatro procesos.

Sin despliegue remoto. Axe, Lighthouse y responsive completo siguen sin ejecutarse, tal como se indica arriba.

Actualización UX: la intención de valor propio se obtiene de la edición directa. Los campos heredados permanecen habilitados; no se exige checkbox. Se conserva la procedencia visible y restauración individual/global.
