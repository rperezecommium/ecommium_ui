# Pricing: filtros de Resumen

El formulario compartido de filtros de Configuración > Pricing reutiliza
`productListSearchPanel` de Catálogo > Productos (superficie, borde, espaciado).
Se distribuye con flex y salto de línea: priceTableId/itemId amplios,
currency/country/quantity de 90px y contexto comercial de 100px. En móvil las
referencias ocupan una fila y los campos cortos pueden permanecer juntos.
En escritorio (viewport desde 1100px), el formulario mantiene todos los campos y
el botón en una fila, reduciendo los campos flexibles si falta espacio.
Los filtros compartidos conservan esta presentación al cambiar de pestaña.
No se cambian parámetros, contratos, sesión ni permisos.

Validación ejecutada:

- `node --test tests/pricing-admin.test.mjs`: 12 PASS.
- `npm run lint`: 0 errores, 3 advertencias preexistentes.
- `npm run build`: PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'pricing configuration exposes master data|pricing configuration resolves computed auto|pricing governance page manages campaign' --reporter=line`: 3 PASS. Se repitió fuera del sandbox tras EPERM al abrir el servidor loopback.

La regresión de navegador usa BFF de fixtures; no acredita revisión visual,
axe, medidas responsive ni servicios reales. No se ejecutaron Lighthouse ni
pruebas contra backend real para este ajuste de presentación.

## Listados Impuestos y Price tables

Ambas pestañas reutilizan `productListGrid`, `productListGridHeader`,
`productListTableScroller` y `productListTable` del listado Productos.
Se elimina su tarjeta exterior Pricing; cabecera con contador, tabla, celdas y
acciones compactas heredan los estilos compartidos de Productos. Los formularios
de alta/baja/activación y las otras pestañas conservan su comportamiento.

Validación tras este cambio: lint sin errores (3 avisos previos), build PASS,
12 pruebas `tests/pricing-admin.test.mjs` PASS y los mismos 3 E2E Pricing PASS.
No se realizó revisión visual responsive/axe ni recorrido con BFF real.
