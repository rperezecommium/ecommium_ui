# Vista previa del producto alineada con PDP

## Análisis y cambio

La PDP pública usa `StorefrontPdpPage` → `StorefrontPdpContentClient`, con las
clases `storefrontPdp*` de `app/globals.css`. El editor mantenía un segundo
markup `productPreview*`, dentro de `AdminResizableDrawer`; no compartía ni
galería, selector, ficha de compra ni estructura con la PDP.

Se sustituye esa ficha por `ProductPdpPreviewModal`, un `<dialog>` nativo
centrado al 80vw y 90dvh, con scroll interior. Se carga con `next/dynamic` solo
cuando se solicita la vista previa. El popup renderiza directamente
`StorefrontPdpContentClient` dentro de las mismas superficies `storefrontPage`
y `storefrontShell`. No se copian los estilos ni se crea otra PDP. Los cambios
futuros en el componente y sus selectores CSS compartidos afectan a ambas vistas.

`pdpPreviewData()` adapta el borrador actual al modelo de presentación PDP:
texto, variantes, precios habituales, disponibilidad, imágenes protegidas o
locales, servicios y características. Conserva los cambios sin guardar. No
añade endpoints ni reproduce la resolución comercial de Pricing. Las ofertas
contextuales públicas siguen dependiendo del BFF; la vista del borrador no
certifica el precio público resuelto para un comprador.

El modo preview deshabilita el mismo botón de compra de la PDP y desactiva
los efectos de analítica, incluida la modificación de la cookie de visitante.
La PDP pública mantiene los valores por defecto de compra y analítica. El
selector y el zoom siguen siendo los de la PDP. Escape dentro del zoom cierra
solo la imagen; otro Escape cierra el popup. El diálogo nativo mantiene el
resto de la página inerte y restaura el foco al cerrar.

Se corrigió overflow detectado por las pruebas en el propio CSS compartido:
columnas flexibles y adaptación de compartir/datos/carrito según el ancho de
la ficha, mediante container queries. No hay overrides alternativos de PDP
específicos del Admin. El CSS del popup solo define su marco, cabecera y scroll.

La ruta Admin `/storefront-preview` de lectura real del BFF conserva su flujo
independiente y el enlace «Ver en tienda». No se ha convertido esa pantalla
de diagnóstico ni el header/footer Storefront en parte del popup.

## Pruebas ejecutadas

- `npm run build`: correcto.
- `npm test`: 670 pruebas pasan en la ejecución tras integrar el componente.
- `npm run lint`: sin errores, tres advertencias anteriores de símbolos sin uso.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'PDP preview is a centered|product preview renders rich|product preview uses the PDP' --reporter=line`:
  3 pruebas pasan.
- Ancho 80% y centrado a 1440, 768 y 390px; no overflow horizontal.
- No hay tirador lateral. Se comprueban foco inicial y restaurado, Escape,
  cierre exterior y zoom con Escape independiente.
- El selector cambia referencia, precio propio de variante y disponibilidad;
  la variante sin stock permanece deshabilitada, conforme a la PDP real.
- Texto enriquecido conserva formato y sanitización compartida.
- Modificar una regla CSS de `.storefrontPdpBuyBox h1` afecta inmediatamente
  al popup: se verifica que no está aislado en una copia del CSS.
- Botón de carrito deshabilitado, sin peticiones de carrito/analítica y cookie
  de visitante preservada durante la vista previa.
- Captura revisada:
  `test-results/admin-login-PDP-preview-is-df7be-l-sharing-storefront-styles/pdp-preview-modal.png`.

La fixture de precio usada para comprobar variantes utiliza BASE universal
(`inheritPriceScenario`), en lugar de registros con tabla y sin `source`, que
el mapper actual no trata como precio habitual editable.

## Límites y resultados adicionales

Playwright usa el BFF de fixtures. No se han certificado servicios comerciales
reales, equivalencia de precios públicos resueltos ni Lighthouse/budgets JS.
No se modifica código backend.

Una ejecución ampliada obtuvo 3 pases y 2 fallos antes de abrir la vista previa:
`product footer keeps only preview save and a compact actions menu` busca
«Volver al catálogo», y `product feature groups follow category and inline
administration preserves the product` busca la sección «Características y
especificaciones», que no encuentra. Otra prueba anterior de características
busca «Añadir otra característica» antes del popup y tampoco lo encuentra.
Estos recorridos no acreditan regresiones del popup y quedan documentados;
no se cambian los formularios ni la navegación ajenos a esta tarea.

Logs locales: `/tmp/ecommium-pdp-modal-{build,lint,unit}.log` y
`/tmp/ecommium-pdp-modal-e2e-final.log`.
