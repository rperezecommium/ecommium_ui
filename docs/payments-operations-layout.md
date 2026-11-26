# Pagos: bandejas operativas

2026-11-03. Los KPIs financieros permanecen únicamente en Resumen. Se retiran
los bloques superiores repetidos de Operaciones y Reembolsos. Ambas bandejas
usan búsqueda GET independiente, superficie y bordes de Productos, acción Buscar
y enlace Limpiar filtros. Después se presenta la cabecera compacta y la tabla.
Se conservan filtros, permisos, confirmaciones y evidencia de reembolsos.
No se modifican contratos BFF ni autenticación.

Validación: `node --test tests/payments-admin.test.mjs` (8 PASS),
`npm run lint` y `npm run build`. Pendiente revisión visual con sesión real,
Playwright, axe, responsive y Lighthouse; no se ha accedido al repo backend.

Ancho: se elimina el límite de 1180px de Pagos y el padding duplicado del
contenedor operativo. Buscador y listado ocupan el 100% del área disponible;
la tabla conserva scroll interno en pantallas estrechas.

Formulario compacto de reembolso: etiqueta «Importe», ancho visual para seis
dígitos y confirmación «Confirmar reembolso». Moneda/céntimos se conservan en
ayuda y nombre accesible; el máximo sigue siendo el saldo reembolsable BFF.

Cancelación bloqueada: explicación en tooltip compartido con icono Info
junto al importe (hover, foco o clic; Escape cierra). CANCELLED se muestra en
verde y cancelledMinor positivo añade la cancelación confirmada con su importe.
No se deduce éxito del mero contador de solicitudes de cancelación.

Estados financieros: SETTLED/CANCELLED verde; AUTHORIZED, PARTIALLY_REFUNDED
y REFUNDED azul; PENDING naranja; FAILED/REJECTED rojo. Estados desconocidos
neutros. Se conserva el texto para no depender exclusivamente del color.

Corrección semántica: CANCELLED y el importe de cancelación confirmada usan
el badge neutro gris; el verde se reserva para SETTLED. Una cancelación
completada no representa un ingreso.

Configuración: Métodos, Proveedores y Routing reutilizan la superficie,
cabecera y tabla compacta de Productos. Las acciones Nuevo método, Nuevo
proveedor y Nueva regla son enlaces de texto alineados a la derecha sobre
la lista. Se conservan permisos, formularios laterales y confirmaciones.
Validación: 8 pruebas de pagos PASS y build PASS; lint sin errores, tres avisos
preexistentes. Revisión visual, responsive, axe y Lighthouse pendientes.

Facturación: retiradas las cuatro tarjetas KPI y el bloque Operación fiscal.
Búsqueda y tabla usan los estilos de Productos a ancho completo. Emitir factura
se presenta arriba a la derecha y abre AdminResourceDrawer, con foco contenido,
Escape y bloqueo de scroll. La query issueInvoice=true solo controla presentación;
canManageInvoices y la autorización BFF siguen gobernando la emisión. Se conserva
la acción y su idempotencia existentes. 12 pruebas de pagos/facturación PASS.
Playwright con BFF, axe, responsive y Lighthouse pendientes.

Métodos: retiradas las tres tarjetas de resumen; esta pestaña consulta siempre
payment-systems con includeInactive=true y no muestra el toggle de inactivos.
Las acciones y creación conservan la vista completa después de redirigir.
