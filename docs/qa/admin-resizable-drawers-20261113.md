# Paneles laterales Admin ajustables — 2026-11-13

## Alcance

Estándar visual compartido en `AdminResizableDrawer`, integrado también en
`AdminResourceDrawer`. Los paneles propios del Admin pasan por el componente
compartido. Las confirmaciones centradas y los popovers conservan su comportamiento.
No se cambian contratos, peticiones BFF, autenticación ni datos comerciales.
AGENTS.md contiene el estándar obligatorio para nuevos paneles.

La pestaña reproduce la geometría del tirador del menú izquierdo y utiliza un
icono de tres líneas. Outline interior azul de 3px al seleccionar y 5px durante
el arrastre. Al soltar tras arrastrar, el outline desaparece por completo; el
click generado al terminar el gesto no vuelve a activarlo. El ancho se pinta mediante Pointer Events y requestAnimationFrame,
sin transición de ancho que retrase el puntero.

Los límites son 20%-50% del espacio entre el borde derecho visible del menú
izquierdo y el viewport; apertura inicial al 40%. Se recalculan al cambiar el
viewport o plegar el menú. La memoria es un Map por pathname y tipo de módulo,
sin almacenamiento persistente: cerrar/reabrir o cambiar la query conserva el
ancho; cambiar de página lo descarta. Los formularios de módulos distintos
mantienen preferencias independientes.

## Evidencia ejecutada

- `node --test tests/admin-drawer-size.test.mjs`: 4 pruebas pasan. Cálculo,
  límites, dirección del arrastre, teclado e inventario AST de paneles Admin.
- `npm test`: 670 pruebas pasan, 0 fallos.
- `npm run lint`: 0 errores, 3 advertencias previas por símbolos sin uso en
  customers-admin-actions.ts, request-client.ts e invoice-document-pdf.ts.
- `npm run build`: correcto.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'Admin drawers resize within bounds|drawer query changes|specific prices use a separate|product pricing preserves legacy BASE|shipping configuration manages carriers|seo configuration manages routes|communications configuration saves email|media library uses shared|brand list creates in a drawer' --reporter=line`:
  10 pruebas pasan. Incluyen límites reales, outline 3/5px, memoria, navegación,
  menú plegado, teclado, Escape, formularios de precio, fechas Madrid,
  transporte, SEO, comunicaciones, marcas y medios.
- Axe sobre el nuevo tirador: 0 infracciones. No equivale a una auditoría global.
- Comprobación visual de `drawer-resized.png`, generado por la prueba de arrastre.
- Los escenarios de fecha también comprueban límites del panel a 1440, 768 y
  390px. Se mantiene el rango estricto solicitado incluso en pantallas estrechas;
  esto no certifica la ausencia de overflow en todos los formularios al 20%.

Durante las pruebas se reprodujo y corrigió que Escape durante el arrastre
cerraba el panel compartido: ahora cancela el cambio de ancho y mantiene el panel.
El listener de cancelación se ejecuta en captura antes del cierre del diálogo.

## Límites de la verificación

Corrección posterior del estado al soltar: build correcto, lint sin errores
(las mismas 3 advertencias), 4 pruebas de helpers/inventario y el E2E
`Admin drawers resize within bounds` pasan. Este último comprueba la secuencia
de outline 3px → 5px → 0px, además de límites y memoria del ancho.

Playwright usa el BFF de prueba de la suite, no servicios comerciales reales.
No se ha ejecutado una auditoría Lighthouse ni certificado los budgets de
rendimiento, ni probado manualmente cada formulario existente.

Una ejecución ampliada adicional obtuvo 9 pases y 2 fallos: el nuevo test de
marcas buscaba un botón Cerrar donde existe un enlace (selector corregido y
test vuelto a ejecutar con éxito); el test anterior `product basic boxes
collapse HTML and reuse category and brand drawers` espera 4 secciones y
encuentra 5, antes de interactuar con los paneles. Este segundo caso queda
registrado y no se modifica la estructura del formulario en esta tarea.

Logs locales: `/tmp/ecommium-resizable-drawers-{unit,lint,build}.log` y
`/tmp/ecommium-resizable-drawers-e2e-final.log`. Capturas y trazas bajo
`test-results/` son artefactos locales regenerables.

## Corrección semántica autorizada — 2026-11-20

AdminResizableDrawer usa ahora div role=dialog en lugar de aside role=dialog.
Axe detectó aria-allowed-role en el drawer de Plantillas CMS. Cambio limitado
al tag y su tipo de props; geometría/eventos/estilos intactos. Pruebas: helpers
4/4; Playwright arrastre/memoria/query2/2; drawer CMS axe sin contraste a1440,
768 y390PASS; buildPASS y lint0errores/3warnings previos. Evidencias en
cms-phase-5-drawer-unit-20261120.txt, cms-phase-5-drawer-e2e-20261120.txt y
cms-phase-5-template-drawer-axe-20261120.txt.
