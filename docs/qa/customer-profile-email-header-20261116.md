# Perfil del cliente: correo en cabecera — 2026-11-16

Por solicitud de Ricardo, el correo existente de solo lectura se presenta a la derecha del título/referencia de Perfil, separado por una línea vertical. Sale de Datos personales; Nombre/Apellido/Teléfono/Documento mantienen sus controles y payloads. La creación de cliente conserva el email editable obligatorio. Sin cambios BFF, permisos ni datos.

Se comprobó en la UI real que C-MM606E es customerReference y que el formulario conserva un customerId técnico distinto. getCustomerByReference resuelve la referencia por BFF antes de operar con customerId; no se sustituye una identidad por otra.

Validación:17 unitarias de Clientes PASS; lint0errores/3avisos anteriores; buildPASS; E2E existente de listado/creación/perfil/direcciones/compras1PASS contra BFF simulado. Navegador real: correo en cabecera, separador1px, cero inputs de email en la edición; móvil390 sin desbordamiento del documento y revisión visual de captura de cabecera. No se guardó ningún cambio del cliente. Logs y respaldos previos en `/tmp/ecommium-customer-profile-header-20261116/`.
