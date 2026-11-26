# Ubicación de la copia de recuperación

El aviso añade un enlace con aspecto de botón «Ir a [sección]», por ejemplo
«Ir a Catálogo / Productos». Abre la pantalla del borrador y conserva `tab`;
Recuperar y Descartar mantienen su comportamiento. La URL procede del router
actual, no de un destino arbitrario almacenado. No cambia el contrato BFF.

Validación (2026-10-31):

- `node --test tests/admin-login-action.test.mjs`: 13 PASS antes del cambio.
- `node --test tests/cms-admin.test.mjs`: 13 PASS.
- `npm run lint`: sin errores; tres advertencias preexistentes ajenas.
- `npm run build`: PASS, incluido TypeScript.

Pendiente: comprobación visual desktop/tablet/mobile, axe y Playwright con una
copia real en la sesión Admin; no se ejecutaron Lighthouse ni integración BFF
para este enlace de presentación.

Descartar conserva una marca por empleado/pantalla/pestaña durante la vida de
sessionStorage: las capturas pasivas de salida no recrean el aviso aunque al
recargar cambien los valores del formulario. Una edición humana nueva puede
generar una copia nueva. Se recuerda la identidad del último campo recuperable
editado, excluyendo los campos sensibles existentes. «Ir a…» y «Recuperar» lo
enfocan y desplazan a la vista; el contorno usa el token de foco y se retira al
perder foco. Las copias anteriores sin metadata de campo siguen recuperándose.

Validación adicional: `node --test tests/admin-recovery.test.mjs
tests/cms-admin.test.mjs` (15 PASS), regresión login (13 PASS), build PASS y
lint sin errores, con las mismas tres advertencias ajenas. Las pruebas nuevas
ejecutan los helpers con DOM simulado; la comprobación en navegador sigue pendiente.
