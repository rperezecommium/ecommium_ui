# Badges de Headers y Footers — 2026-11-19

## Alcance

División de ambas bibliotecas en Biblioteca, Diseño, Asignaciones e Historial,
usando los badges existentes del Admin. Editar abre Diseño; los enlaces mantienen
`sitePartId` y `locale`. Las mutaciones conservan idioma y sección de retorno.
Crear fallido vuelve a Biblioteca. Historial consulta el detalle del elemento;
los enlaces anteriores con `sitePartId` sin `tab` siguen abriendo Diseño.
No se cambian endpoints, permisos, modelos ni operaciones de publicación.

## Verificación

- `node --test tests/cms-admin.test.mjs tests/cms-media-validation.test.mjs`:
  14 pruebas aprobadas.
- `npm run lint`: sin errores; tres avisos existentes fuera de CMS.
- `npm run build`: correcto.
- `./node_modules/.bin/tsc --noEmit --incremental false`: correcto.
- Playwright Chromium: seis recorridos, Headers/Footers por 1440, 768 y 390 px.
  Biblioteca → Editar/Diseño → Asignaciones → Historial; sección aislada,
  badge activo, idioma, selección e historial correctos; sin overflow del
  documento en Historial. Se usó SSR del componente real de página, CSS real,
  datos sintéticos y un sustituto del constructor. No acredita el canvas.
- Axe en Historial de ambas bibliotecas: sin incidencias con `color-contrast`
  excluido por el pendiente transversal del Admin.
- Seis simulaciones de Server Actions: crear, guardar draft y asignar para
  Header/Footer conservan destino e idioma. BFF sustituido; sin persistencia.

## Límites

Sin escrituras comerciales ni cambios backend. No se certifica el recorrido con
sesión/BFF reales, comportamiento responsive del canvas ni performance Lighthouse.
Los pendientes de seguridad anteriores permanecen abiertos.

## Distribución vertical del constructor

Por solicitud posterior, el constructor de Header/Footer coloca Vista previa,
Elementos e Inspector en ese orden, cada sección al 100% del ancho disponible.
El orden también se cambia en el DOM para mantener lectura y foco coherentes.
CSS limitado a `.cmsSitePartVisualBuilder`; no altera el Builder de páginas.

Verificación: 14 pruebas CMS aprobadas; lint sin errores y con los tres avisos
anteriores; build correcto. Chromium comprueba seis combinaciones Header/Footer
por 1440/768/390 px, con DOM/CSS reales del constructor: orden vertical y ancho
completo correctos. Solo el contenido interno del preview se sustituye; no se
ejecutan mutaciones ni se certifica el BFF real.

Revisión posterior: se retira la tarjeta exterior `pricingPanel` del editor y
el wrapper `cmsBlockBuilderWorkspace` de estas tres secciones. Vista previa,
Elementos e Inspector son cajas hermanas del constructor, con borde propio y
separación de 14 px, sobre el fondo Admin. Conservan orden y ancho completo.
