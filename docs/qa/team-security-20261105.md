# Seguridad integrada en Equipo — 2026-11-05

## Cambio

Equipo incorpora la pestaña Seguridad. Se retira la entrada independiente del
menú de Configuración y su acceso redundante desde el resumen de Configuración.
La ruta anterior /admin/configuracion/seguridad redirige a
/admin/configuracion/equipo?tab=security conservando error/notice. También siguen
funcionando los retornos existentes de las acciones y de contraseña obligatoria.

Cambiar contraseña y Confirmaciones para acciones sensibles se abren mediante
botones en paneles laterales AdminResourceDrawer: cierre por Escape/enlace/fondo,
foco inicial y contención de Tab, sin persistir contraseñas en el navegador.
Se reutilizan las acciones existentes, sin alterar refresh, cookies HttpOnly,
MUST_CHANGE_PASSWORD, revocación de otras sesiones ni validación final de auth/me.

La lista de dispositivos adopta employeesWorkspace/adminTable, filas compactas,
scroll horizontal, sesión actual identificada sin botón de revocación y acciones
para cerrar otro dispositivo o todas las demás sesiones. Cerrar todos los demás
se deshabilita cuando no hay otra sesión en la lista.

La seguridad personal no exige permisos de gestión de empleados. Para conservar
su acceso anterior, Equipo aparece con el permiso de Configuración; al abrirlo
sin permiso de lectura de empleados se entra directamente en Seguridad. En esa
pestaña se consultan solo step-up/sesiones, sin cargar empleados/perfiles ni
ampliar sus permisos. El BFF mantiene autorización y alcance definitivos.

## Validación

- Antes de tocar la superficie: `node --test tests/admin-login-action.test.mjs`: 15 PASS.
- `node --test tests/team-security-navigation.test.mjs tests/admin-login-action.test.mjs tests/admin-credentials-ui.test.mjs tests/admin-permissions-session.test.mjs tests/employees-actions.test.mjs`: 33 PASS.
- `npm run lint`: cero errores, 3 advertencias preexistentes ajenas.
- `npm run build`: PASS.
- Playwright: 9 PASS entre admin-credentials y los casos de permisos de Equipo.
  Recuperación de contraseña y limpieza de token, contraseña obligatoria, estado
  NORMAL tras recarga/otra pestaña, compatibilidad de URL, paneles, foco y Escape,
  cambio de contraseña desde Seguridad, confirmación, revocación individual y de
  otras sesiones, y acceso personal sin gestión de empleados. Se conservan los
  casos de employees.read/manage/security sin exposición de acciones ajenas.
- Barra verificada a 1440/768/390 px. Se revisaron capturas y se corrigió el
  estiramiento heredado de campos; el test limita la altura del input a 48px.
- El fixture de login tuvo que incorporar su contexto disponible y esperar al
  redirect antes de navegar; el intento previo falló sin ese contexto sintético.

E2E con BFF simulado en loopback; no se cambiaron contraseñas ni revocaron
sesiones reales. No se ejecutaron BFF real, axe completo ni Lighthouse. Se
conservan los pendientes generales del backlog de seguridad. No hay cambios de
backend ni dependencias nuevas.

## Capturas

![Equipo: Seguridad y dispositivos](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/18-team-security-devices.png)

![Cambiar contraseña en panel lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/19-team-security-password-drawer.png)

![Confirmación sensible en panel lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/20-team-security-step-up-drawer.png)
