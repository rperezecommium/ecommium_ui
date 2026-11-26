# Postventa: Casos y Pendientes — 2026-11-16

Navegación compartida adminTabs/adminTab con Casos por defecto y Pendientes con contador. Se renderiza una sola bandeja. La pestaña se conserva en URL, enlaces de detalle/cierre y paginación de tareas; los filtros de tareas vuelven a Pendientes. Enlaces históricos con filtros de tareas abren esa área. Atender una tarea conserva el comportamiento existente: retira el aviso y abre el expediente sobre Casos. No se alteran mutaciones, autorización ni contratos BFF. Se incorpora caseReference al parsing de la ruta, que antes omitía ese filtro existente.

Las tres tablas (casos, tareas y líneas del expediente) adoptan los estilos compactos compartidos de productListGrid/productListTable. Continuidad permanece retirada. Cómo gestionar un caso es ayuda nativa desplegable, actualizada al flujo guiado. Cero pendientes usa badge neutro; los indicadores calculados sobre la página cargada explicitan su alcance.

## Validación

- `node --test tests/after-sales-admin.test.mjs`: 23 PASS.
- `npm run lint`: 0 errores, 3 advertencias preexistentes ajenas.
- `npm run build`: PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts --grep 'postventa separates' --workers=1`: 1 PASS. BFF simulado; pestañas, apertura/cierre del expediente, tabla de líneas, filtros y recarga, ayuda plegada, axe sin violaciones en el área principal de Pendientes y anchos 1440/768/390 sin desbordamiento del documento. Navegación lateral plegada para la captura de 390 px. Capturas en test-results.
- Inspección manual de capturas de escritorio y móvil. Tablas anchas conservan desplazamiento horizontal.

No se certifica el flujo contra BFF real: el navegador de revisión de localhost:5173 redirigió a login. No se ejecutaron Lighthouse, presupuestos de rendimiento ni mutaciones de negocio reales. El backend no fue leído ni modificado; se conservan los pendientes de seguridad existentes.

## Simplificación visual posterior — 2026-11-16

Por solicitud de Ricardo se retiran los cuatro indicadores superiores (health, abiertos, sin responsable y esperando retorno). En Pendientes se eliminan el encabezado/explicación de Cola operativa, el contador repetido y el formulario de filtros Tipo/Estado. Se conservan pestañas con su contador, testigo lateral, bandeja, acciones, paginación, errores y ayuda. Los contratos/datos y mutaciones de Postventa permanecen sin cambios; los filtros históricos siguen admitidos en URL, sin controles visibles nuevos.

Validación posterior:23 unitarias PASS; lint0errores/3advertencias anteriores; buildPASS. E2E existente actualizado al diseño solicitado:1PASS, BFF simulado, navegación de casos/detalle/pendientes, ausencia de indicadores y filtros, tabla visible, axe sin infracciones en main y responsive1440/768/390. Inspección Playwright adicional contra Admin real: indicadores0, encabezado0, selectTipo0, contador repetido0 y pestañas conservadas. No se atienden/eliminan tareas ni se modifican expedientes en esta comprobación. Respaldos y logs en `/tmp/ecommium-postventa-cleanup-20261116/`.

## Ayuda en popup blanco — 2026-11-16

El desplegable Cómo gestionar un caso se sustituye por título más botón?; abre un popover nativo blanco con los cinco pasos y la explicación original. Cierre por botónCerrar, Escape o clic exterior. Popup acotado al viewport, scroll interno para texto largo, role dialog y título accesible; sin JavaScript cliente ni cambios de negocio. Pruebas23unitariasPASS, lint0errores/3avisos anteriores, buildPASS y E2E1PASS (apertura, blanco, cinco pasos, cerrar/reabrir/Escape y regresión de bandeja/axe/responsive). Comprobación adicional contra Admin real: popup visible/blanco y cierre correcto. Logs/respaldos en `/tmp/ecommium-postventa-help-20261116/`.

## Buscador de Casos con estilo de Productos — 2026-11-16

FiltersPanel reutiliza productListSearchPanel/productListPageSize y el fondo compartido de Catálogo>Productos. Barra compacta sin cabecera adicional, campos en línea adaptables, selects, control Por página e iconoBuscar como Productos. Conserva nombres, valores, límites, Server Action y filtros de caso/pedido/cliente/responsable/estado; no añade búsqueda por email ni sustituye IDs técnicos por referencias no soportadas. Etiquetas accesibles en los controles.

23unitariasPASS, lint0errores/3avisos anteriores, buildPASS, E2E1PASS con axe/responsive. Admin real: fondoRGB239/239/236, borde1px, padding12px, campos uniformes con los estilos actuales compartidos; móvil390 sin desbordamiento del documento. Inspección visual de captura del buscador realizada. Logs/respaldos en `/tmp/ecommium-postventa-search-20261116/`. Sin mutaciones de casos ni cambios backend.
