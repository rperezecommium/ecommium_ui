# Comunicaciones por pestañas — 2026-11-05

## Alcance

Configuración > Comunicaciones se organiza en Proveedor email, Plantillas y
Auditoría de entregas. Reutiliza adminTabs/adminTab, employeesToolbar,
employeesTextAction y los estilos de tabla de employeesWorkspace de Equipo.
La barra dispone la navegación a la izquierda y la acción del área a la derecha.
Los ajustes CSS adicionales están limitados a Comunicaciones y no añaden colores.

Proveedor reúne resumen, configuración, estado técnico y envío de prueba.
Plantillas muestra Customer y fulfillment en una tabla común con categoría,
estado, locale, versión, fecha y edición. La paginación usa el total BFF sin
filtrar en cliente una categoría sobre una página parcial. Se conserva la
creación de defaults Customer como operación secundaria desplegable.
Auditoría conserva filtros, paginación, detalle seguro y retry de FAILED.
Actualizar hace GET y conserva los filtros de auditoría.

La pestaña se valida desde URL y se conserva en formularios GET, paginación,
apertura/cierre de paneles y redirects de mutaciones. Los enlaces anteriores con
drawer o parámetros de filtros resuelven su área. Se renderiza solo el área
seleccionada. La carga de datos BFF mantiene sus llamadas existentes.

Las acciones de gestión se ocultan sin communications.manage o permiso global
admitido por el shell; el BFF conserva la autorización definitiva. No cambian
contratos/payloads ecommerce ni se modificó backend. No se añade búsqueda libre:
el contrato local consumido permite filtros y paginación, sin q de plantillas.

## Validación

- `npm run lint`: PASS, cero errores y tres warnings preexistentes ajenos.
- `npm run build`: PASS (compilación, TypeScript y generación de rutas).
- `node --test tests/communications-admin.test.mjs`: 13 PASS; clientes BFF,
  payloads, validación del editor, Media, auditoría, permisos y retry.
- `npx playwright test tests/e2e/admin-login.spec.ts --grep 'communications (configuration|audit|template|tabs)'`: 5 PASS.
  Proveedor y prueba email, bootstrap Customer, crear/preview/activar plantilla,
  filtros/detalle/retry de entrega, persistencia de pestañas y filtros al
  actualizar, cierre de drawer, navegación y acciones de solo lectura.
- Responsive de barra/acción a 1440, 768 y 390 px. Se comprueba acceso al control
  tras desplazar hasta la barra; el shell existente coloca el menú sobre el
  contenido en anchos reducidos. Una aserción inicial sin ese desplazamiento
  falló y se corrigió sin modificar el shell.
- Comprobación de etiquetas accesibles de campos del área de plantillas,
  navegación semántica con aria-current y revisión visual de captura desktop
  `.tmp/communications-templates-desktop.png`.

E2E con BFF simulado en loopback, sin enviar correo real ni modificar servicios
backend. No ejecutados: axe completo, Lighthouse/budgets ni integración con BFF
real. No se afirma cierre de los pendientes generales de seguridad, accesibilidad
ni rendimiento del proyecto. No se añadieron dependencias.

## Ajuste según captura: filtros de auditoría

Se elimina Volver, el encabezado visible «Filtros de entregas» con su explicación
y el enlace Limpiar de auditoría. El formulario conserva nombre accesible.
La barra de filtros ocupa el ancho completo del workspace y usa el mismo tono
existente de cabecera, compartido mediante --admin-table-header-bg (#efefec).
No se cambia el tono de las tablas existentes.

Ver fallidas se conserva dentro del formulario como checkbox sincronizado con
Estado: marcar selecciona FAILED, desmarcar selecciona Todos, y elegir otro
estado desmarca el checkbox. Se aplica al pulsar Aplicar filtros, enviando el
mismo deliveryStatus del contrato existente, sin nuevos parámetros BFF.

Se corrige el mínimo intrínseco de la cuadrícula de Comunicaciones para que la
tabla no ensanche la barra en móvil; la tabla conserva scroll horizontal propio.
Verificado con medidas del formulario/workspace y comparación del fondo con la
cabecera real a 1440/768/390 px. Captura revisada:
`.tmp/communications-audit-filters-desktop.png`.

Validación: lint sin errores (3 advertencias ajenas), build PASS, 13 tests de
Comunicaciones PASS. De los 5 E2E, 4 pasaron en la ejecución conjunta; auditoría
pasó al repetir tras corregir el selector de prueba de Estado a combobox por
nombre accesible. Cubre checkbox, sincronización, URL FAILED, detalle y retry.
Se mantienen los límites de BFF simulado y de auditoría a11y/performance descritos
arriba; no se modificó backend.

El formulario de filtros de Plantillas adopta también ancho completo, padding
12px, radio 4px, fondo de cabecera y borde --admin-filter-border (#e2e2e2), por
petición del usuario. Se conserva su distribución flexible y funcionamiento.
Validación del ajuste CSS: `npm run build` PASS; `npm run lint` sin errores y
con las tres advertencias ajenas habituales. No se repitieron E2E ni revisión
visual para este ajuste de estilo.

## Proveedor: resumen unificado

Por solicitud visual se eliminan los cuatro cuadros superiores. Estado técnico
reúne proveedor configurado/estado, remitente, presencia y fecha de actualización
de credencial, plantillas Customer cargadas y los datos técnicos existentes.
Se retiran las filas Organization y Shop; el contexto funcional sigue en el
shell y en todas las llamadas BFF. Remitente y usuario SMTP se conservan como
datos distintos; tampoco se confunde fecha de credencial con actualización de
configuración. Nunca se muestra el secreto. Sin respuesta de plantillas, el
contador indica ausencia de dato en vez de cero.

Validación: `npm run build` PASS; `npm run lint` sin errores (3 advertencias
ajenas); `node --test tests/communications-admin.test.mjs` 13 PASS;
`npx playwright test tests/e2e/admin-login.spec.ts --grep 'communications configuration saves'`
1 PASS, con aserciones de ausencia de cuadros/Organization/Shop y conservación
de remitente/contador; mantiene configuración, bootstrap y envío de prueba.
El E2E usa BFF simulado; no se ejecutaron servicios reales ni Lighthouse.

Estado técnico se coloca antes de Enviar prueba en el DOM y el layout de
Proveedor pasa a una sola columna, ocupando cada caja todo el ancho disponible.
Ajuste de disposición: build PASS; lint sin errores (3 advertencias ajenas).
No se repitieron E2E ni revisión visual para este cambio de orden/ancho.
