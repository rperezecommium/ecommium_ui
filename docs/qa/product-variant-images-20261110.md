# QA: asignación y herencia de imágenes de variantes

Fecha: 2026-11-10. Mapa de conexiones y contrato:
[product-variant-images](../product-variant-images.md).

## Cambios

- Se elimina Imágenes de variante y se añade lápiz en miniaturas de fila 0 y
  variantes adicionales. Panel AdminResourceDrawer con colección, selección
  exclusiva, inactivas deshabilitadas y opción para quitar portada/heredar.
- Icono genérico si no hay imagen efectiva, incluida colección sin asignaciones.
- product-variant-media centraliza portada, resolución de imagen efectiva,
  aliases de identidad y normalización de overrides activos antes del BFF.
- Upload sin elección automática de portada; respuestas tardías no pisan cambios
  locales de portada/activación/metadata. Retirar portada no elige otra por orden.
- Preview y etiquetas de origen de media usan la misma resolución que la tabla.
- Se ajustan tests fuente que todavía exigían los botones de imágenes/filtros
  retirados en cambios previos; se añaden pruebas conductuales de herencia y
  prueba contractual del draft multipart emitido al BFF.

## Comandos y resultados

- npm run build: correcto.
- npm run lint: 0 errores; 3 warnings existentes en customers-admin-actions,
  request-client e invoice-document-pdf.
- node --test tests/product-variant-media.test.mjs tests/product-editor.test.mjs
  tests/product-save-operation-action.test.mjs tests/product-save-attempt.test.mjs
  tests/product-bff-scope.test.mjs tests/media-upload-security.test.mjs
  tests/admin-resource-proxies.test.mjs: correcto.
- npm test: 628/629 correctos. Falla storefront PDP maps product details,
  variants and specifications (tests/storefront-plp.test.mjs:804): categoría
  esperada Bike Brakes, recibida undefined. El módulo Storefront implicado no
  se editó en esta tarea. El fallo se reproduce aislado con:
  node --test --test-name-pattern='storefront PDP maps product details'
  tests/storefront-plp.test.mjs. No se afirma baseline anterior verificado.

## Límites

Chrome muestra el diálogo nativo Reload site? Changes you made may not be saved.
No se recargó, descartó ni guardó el producto del usuario. No se pudo comprobar
visualmente el nuevo flujo ni hacer asignación/guardado real contra BFF.
No se ejecutaron E2E, axe, QA responsive ni Lighthouse. No se arrancaron servicios
backend ni se leyó/modificó su repositorio. Las expectativas de persistencia
pendientes se detallan en el mapa para contrastarlas con el BFF disponible.
