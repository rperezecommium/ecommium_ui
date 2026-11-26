# Preview fiel de Headers y Footers — 2026-11-19

## Decisión e implementación

El canvas del editor usa el ancho del Admin para sus media queries. Reducir
visualmente su caja no representa por sí solo un dispositivo distinto. El botón
`Preview` del constructor abre un diálogo con un iframe de viewport real:
Desktop 1440 px, Tablet 768 px, Mobile 390 px y ancho configurable 320–2560 px.
Los anchos son píxeles CSS reales: si no caben, se ofrece desplazamiento sin
escalarlos ni fingir otro breakpoint.

La fuente es el snapshot local vigente, incluidos cambios sin guardar. Los
módulos inline pasan por la misma migración v2 utilizada al guardar. Las
referencias compartidas conservan su árbol hidratado y contenido de instancia;
si falta una definición, se advierte que el resultado está incompleto y no se
sustituye por un árbol ficticio.

Dentro del iframe se monta `StorefrontSitePartView`, con sus bloques funcionales
y renderer visual públicos, sin herramientas de edición y sin fijar un
`visualViewport` artificial. Se clonan las hojas CSS/etiquetas style cargadas y
se espera a estilos/fuentes antes de mostrar el resultado. Si falta el CSS o
falla una hoja, permanece oculto con error y Reintentar. El documento tiene su
propio viewport; las reglas responsive de áreas, columnas, visibilidad y nodos
se ejecutan dentro de él. Cambios posteriores del snapshot actualizan el portal.
Cerrar y abrir vuelve a tomar el estado vigente, sin guardar ni publicar.

La navegación se obtiene por Storefront BFF para la tienda seleccionada y el
locale explícito, tras verificar sesión Employee/permisos CMS. Comparte lectura
y mapeo con la tienda. Se conserva el fallback existente del Storefront y se
marca de forma visible como navegación provisional/de reserva cuando corresponde.
No se añaden endpoints ni se cambia el backend.

Cuenta y carrito usan sus componentes públicos en modo preview, con apariencia
de visitante y carrito vacío. No montan el drawer de autenticación ni consultan
el carrito. Formularios/enlaces no envían ni navegan; no se montan analítica ni
proveedores de consentimiento comercial. No representa una sesión Customer real.

## Seguridad y accesibilidad

El srcdoc es estático; el borrador se representa por React, sin interpolarlo en
HTML. Sandbox `allow-same-origin` permite el portal desde el padre, sin permitir
scripts, forms, popups ni navegación superior. CSP amplía únicamente `frame-src`
con `'self'` para el documento local; conserva `frame-ancestors 'none'`,
X-Frame-Options DENY y las demás restricciones. La prueba usa la CSP de producción.

Diálogo nativo con nombre accesible, Escape también desde el iframe, bloqueo del
scroll del Admin y restauración de foco. El área desplazable es accesible por
teclado. Los controles tienen estado seleccionado y el iframe tiene título.

## Evidencia

- `npm test`: 735/735.
- `npm run lint`: 0 errores; 3 avisos preexistentes ajenos a esta superficie.
- `npm run build`: correcto.
- `node tests/e2e/cms-unified-builder-browser.mjs`: 3 anchos del Admin
  (1440/768/390). Monta el editor real con fixtures, Next dynamic/Link/Image y
  llamadas externas adaptados al laboratorio; no usa datos reales.
- Comprueba cambios sin guardar, viewport iframe 390/1440 real, CSS externo,
  markup y ancho de área idénticos al renderer público al mismo tamaño,
  v2/roundtrip, Escape/foco, enlaces inertes y ausencia de guardados adicionales.
- Simula fallo de CSS: resultado oculto, error y recuperación con Reintentar.
- Axe en Inspector y controles del diálogo: sin infracciones con contraste
  excluido por pendiente transversal. El iframe se excluye del escaneo del
  diálogo; su markup se contrasta con el renderer compartido.
- Unitarios nuevos: permiso/contexto/locale y mapeo/fallback de navegación.

Límites: no se ha publicado ni alterado ninguna cabecera real. No se certifica
producción, una sesión Employee conectada, uploads Media reales ni todos los
estados Customer/carrito. Las pruebas comparan fixtures concretos; no prueban
pixel a pixel cualquier contenido posible ni ejecutan Lighthouse. El preview
representa la pieza, no una página completa de catálogo/checkout. Su disponibilidad
requiere recargar la UI con la configuración CSP actualizada.

Verificación HTTP local final: `/auth/login` devolvió 200 con
`frame-src 'self'`, `frame-ancestors 'none'` y X-Frame-Options DENY.
La configuración necesaria ya está activa en la UI local.
