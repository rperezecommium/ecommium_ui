# Barra de Equipo — 2026-10-31

Empleados, Perfiles y Permisos comparten una barra con pestañas a la izquierda
y su acción a la derecha, centrada verticalmente. Se eliminan las filas
independientes de Crear empleado, Crear perfil y Asignar permisos. La tabla
queda a 6px de la barra. En anchos reducidos, los controles pueden envolver
sin superponerse. Los paneles laterales y sus acciones siguen funcionando con
los mismos handlers, contexto y contratos BFF.

Validación: `npm run build` PASS; `node --test tests/employees-actions.test.mjs`
5 PASS. `npm run lint` sin errores y con tres advertencias preexistentes ajenas.
Pendientes: revisión visual en navegador, responsive, axe y E2E con sesión real.
No se alteran llamadas BFF ni se modifica backend.

El fondo general de las rutas del shell Admin se unifica en `#f4f4f2` por
petición expresa del usuario, mediante `--admin-bg` limitado al shell y la
superficie de página. Sustituye la excepción previa de Equipo/Transporte/SEO.
Las tarjetas, campos y estados conservan sus tokens de superficie y contraste.
El Storefront no hereda esta redefinición. Comprobación visual entre rutas
pendiente; no añade JS ni peticiones y no se midió Lighthouse.
