# Pestañas, acciones y ancho de tablas Admin

Se inventariaron las navegaciones por badges de `src/modules` (adminTabs,
productEditorTabs, customerDetailTabs, contextSettingsNavigation y paymentsTabs).
Las filas con acción de navegación/alta a su derecha son Equipo, Características /
Atributos y Comunicaciones (`employeesToolbar`), más Pricing incorporado en este
cambio (`adminTabsToolbar`). Comparten alineación vertical centrada, navegación
flexible sin margen inferior y acción a la derecha. En móvil la acción puede
pasar debajo sin desbordar. Media, categorías, marcas y offerings reutilizan
employeesToolbar para contador/acciones, conservando su alineación.

Las demás navegaciones inspeccionadas (Transporte, SEO, Search, Postventa,
Pedidos, cliente, Contexto, CMS, producto y Pagos) no tienen una acción hermana a
la derecha de sus badges: sus acciones pertenecen a otros bloques/formularios.
No se trasladaron esas operaciones por inferencia.

Pricing mueve Crear impuesto, Crear price table, Fijar precio y Actualizar
pipeline a la fila de badges y elimina Ir a productos. Los contadores permanecen
en la cabecera del listado. Las tablas/scrollers del patrón compartido de
Productos/Equipo/Transporte/SEO tienen width:100%; se retira la reserva permanente
de scrollbar en esos scrollers, manteniendo overflow-x:auto.

DELETE en Impuestos es un input de confirmación, no otra acción. Se cambia su
placeholder a Escribe DELETE y el botón Baja a Desactivar; la acción UI existente
llama DELETE al BFF y describe una desactivación. No se consulta ni modifica
backend. Se aclara también el input de confirmación de Price tables y se nombra
su botón Desactivar tabla. Los endpoints, confirmaciones y permisos se conservan.

## Evidencia

- `node --test tests/pricing-admin.test.mjs`: 12 PASS.
- `npm run lint`: PASS, 0 errores / 3 avisos existentes.
- `npm run build`: PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'pricing tabs align|pricing configuration exposes master data|pricing configuration resolves computed auto|pricing governance page manages campaign' --reporter=line`: 4 PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts -g 'Admin badge toolbars|communications tabs isolate|catalog attributes and features page filters' --reporter=line`: 2 PASS / 1 FAIL.

El fallo adicional de Características espera `/field-co.*Color.*Combinacion/`
en el nombre accesible de una fila; el snapshot muestra Color y sus acciones,
pero ese texto no incluye el identificador esperado. No se modifica este test
ajeno para declarar toda la regresión en verde. La prueba nueva de alineación
sí verifica Equipo, Características y Comunicaciones a 1440/768/390 px.

La prueba nueva Pricing mide los ejes verticales de navegación/acción, ancho de
tabla respecto al scroller y ausencia de desbordamiento de documento a
1680/1280/768/390 px; abre ambos drawers y comprueba los nuevos textos. Captura
1680 de Impuestos revisada visualmente:
`test-results/admin-login-pricing-tabs-a-3a8c5-es-fill-the-available-width/pricing-taxes-aligned.png`.
Usa BFF de fixtures. No se ejecutó backend real, axe ni Lighthouse; no certifica
funcionamiento comercial ni accesibilidad de toda la aplicación.
