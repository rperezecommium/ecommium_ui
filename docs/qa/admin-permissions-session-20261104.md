# Permisos y sesión Admin — 2026-11-04

Corrección local de los fallos comprobados de acciones visibles sin permiso y
cambio de contraseña que seguía pendiente. No se cambió el backend ni se debilitaron
sus guards; el BFF conserva la autorización definitiva.

| Causa | Corrección | Evidencia |
| --- | --- | --- |
| Sesión no consultaba auth/me mientras el bearer no caducaba | Snapshot autoritativo por render, compartido con React cache entre layout/páginas | Cookie anterior con wildcard pierde acciones al recibir permisos de lectura en auth/me, sin esperar expiración. |
| Arrays vacíos de permisos/roles podían recuperar privilegios previos | Arrays explícitos vacíos se preservan y sustituyen al snapshot anterior | Unit contra login/JWT elevados y auth/me vacío. |
| Equipo mostraba acciones por tener contexto, sin distinguir permiso | employees.manage para empleados; employees.security para perfiles/permisos; reset conserva requisito SuperAdmin existente | Lectura no muestra crear/editar/activar ni asignar permisos; gestión de empleados no habilita seguridad de perfiles y viceversa. Deep link create-employee tampoco abre el formulario sin permiso. |
| Categorías/marcas solo ocultaban el alta | Se ocultan también edición y borrado sin su permiso de escritura | E2E con cookie anterior privilegiada y permisos actuales de lectura. |
| Pagos usaba alias distintos del BFF | Capabilities usan payments.configuration.read/write | El lector no ve nuevo método ni drawer solicitado directamente; gestor mantiene sus acciones. |
| Cambio retenía sesión pero no guardaba el estado nuevo | Después de password_changed se consulta auth/me, se valida identidad/Employee/admin/NORMAL y se actualiza cookie HttpOnly | Permanece normal al recargar y en otra pestaña. Si no se puede verificar, se limpia sesión local y se pide login, sin fingir NORMAL. |
| Rotar cookie durante RSC provoca fallo de Next | RSC deriva 401/403 a Route Handler técnico session-renew antes de rotar; allí refresh, auth/me y cookie | Sesión renovada sin login; redirect relativo conserva host/puerto. Cross-site y destinos externos bloqueados/normalizados. |

`getCurrentAdminSession` es un helper exclusivo de servidor con cache por render,
no un almacenamiento global compartido entre usuarios. Se aplica en las páginas
que calculan capacidades desde la sesión. No cambia tokens en localStorage ni
usa bearers técnicos. La ruta técnica de renovación solo gestiona la cookie de
sesión; no expone tokens ni añade una API ecommerce alternativa.

Se conserva la regla GET auth/me 401/403 → POST auth/refresh → guardar tokens
rotados HttpOnly → reintentar auth/me antes de considerar la sesión perdida.
Se conserva defaultContext automático tras login y la selección multistore.
El helper de lectura nunca intenta escribir cookies durante renderizado RSC.

## Pruebas

- Antes de tocar autenticación: `node --test tests/admin-login-action.test.mjs`, 13 pass.
- `npm test`: 533 pass. `npm run build`: PASS. `npm run lint`: 0 errores/3 avisos previos.
- `node --test tests/admin-session-renew-route.test.mjs tests/admin-permissions-session.test.mjs tests/admin-login-action.test.mjs tests/auth-session-payload.test.mjs`: 30 pass.
- `npx playwright test tests/e2e/admin-login.spec.ts --grep 'live employee|employee manage permission|profile security permission|live catalog read|live payment read|expired admin session' --workers=1`: 6 pass.
- `npx playwright test tests/e2e/admin-credentials.spec.ts --workers=1`: 4 pass,
  incluyendo recuperación existente y cambio forzado persistente después de recarga/otra pestaña.
- Se actualizó únicamente el selector ambiguo de Password en esa prueba para
  apuntar al input; el botón de mostrar contraseña también tenía ese texto.
- BFF real: login/logout y navegación de lectura en Equipo, Categorías y Pagos;
  Admin conserva acciones autorizadas y no queda bloqueado en admin/password.
  No se cambió la contraseña de Ricardo ni de ninguna cuenta real; los cambios
  de contraseña/restricciones se ejercitaron contra BFF aislado de Playwright.

## Rendimiento y límites

Se eliminó la confianza temporal en permisos de cookie vigente, por lo que se
consulta auth/me en cada render y se comparte el resultado con cache de React.
En el servidor local de desarrollo caliente: Equipo 1611ms, Categorías 528ms,
Pagos 524ms de TTFB. Equipo supera el objetivo de 900ms en esta medición; no se
hizo un ajuste de carga de datos ajeno a este fallo ni se afirma cumplir el gate
productivo. No se ejecutó Lighthouse ni se certificó rendimiento de producción.

Cobertura funcional explícita de las acciones de Equipo, categorías/marcas y
configuración de pagos, más el flujo común de sesión. Esto no declara auditadas
todas las acciones de todos los módulos. La autorización real sigue en BFF.
No se marcan cerrados los riesgos generales de securityReadme sin su evidencia.

## Artefactos

No se crearon empleados, perfiles, productos, tiendas ni configuración de pago.
No se enviaron invitaciones reales ni mensajes. La sesión real de lectura se
cerró al finalizar. Los perfiles/credenciales usados por E2E son fixtures aislados.

[Resultados sin secretos](admin-permissions-session-20261104.json).
Scripts/logs de ensayo local: `/private/tmp/import-ui-review/permissions-*` y
`credentials-e2e.log`. Playwright usa `test-results`; los tests de regresión son
código del repo y deben conservarse. No hay despliegue productivo.
