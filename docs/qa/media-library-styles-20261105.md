# Media / Archivos: patrón de biblioteca — 2026-11-05

## Cambio

La biblioteca utiliza barra con contador, Actualizar y Crear nueva, buscador al
100 % con fondo/borde compartidos, tabla employeesWorkspace/adminTable y
paginación compacta. Las miniaturas y el detalle de assets se conservan. El título
de la colección se edita en la propia fila con un input de 150px y Guardar.

Crear nueva abre un panel lateral mediante drawer=create, con los campos y
subida multipart existentes. Al crear correctamente se cierra el alta y se abre
el detalle de la colección devuelta por BFF, conservando los filtros. Si falla
la validación de archivo, permanece el panel y muestra el error; el archivo
rechazado no se envía al BFF. Se conserva el comportamiento previo de retorno
por redirect, sin prometer retención del archivo seleccionado tras un error.

El menú nativo … ofrece Revisar y Desactivar colección. Esta última opción abre
el detalle en la sección de confirmación de baja. Se mantiene exclusivamente
la baja segura soft prevista para esta UI; la referencia local reserva hard
hasta cerrar ownership y metadata. No se añade una operación de dominio nueva.

Se exige permiso media.assets.write o permiso global para mostrar creación,
edición en fila, subidas, edición de assets y baja. Solo lectura conserva el
listado y el detalle. BFF conserva la autorización real y los permisos mínimos
definitivos. Las llamadas mantienen Organization/Shop/locale y el bearer del
Employee, incluyendo el proxy protegido de imágenes.

Los límites/tipos/firmas de subida, normalización y confirmaciones previos se
preservan. No se cierran los pendientes de SEC-007 ni de infraestructura.
No se modifica backend ni se añaden dependencias.

## Validación

- `npm run build`: PASS.
- `npm run lint`: sin errores; 3 advertencias preexistentes ajenas.
- `node --test tests/media-drawer-navigation.test.mjs tests/media-admin.test.mjs tests/media-upload-security.test.mjs tests/admin-resource-proxies.test.mjs`: 16 PASS.
- Playwright: 3 PASS; listado/detalle/preview y soft con confirmación, búsqueda,
  edición en fila, alta multipart con PNG, rechazo de SVG antes de llamar al
  BFF y acceso de solo lectura sin controles de mutación, incluso por URL.
- Buscador sin desbordamiento a 1440/768/390 px. Foco inicial del panel y capturas
  revisados. El helper de captura respeta popovers abiertos al cerrar avisos de
  recuperación, para no ocultar el menú antes de fotografiarlo.

```sh
ECOMMIUM_QA_SCREENSHOTS=true npx playwright test tests/e2e/admin-login.spec.ts --grep 'media catalog page|media library'
```

BFF simulado y PNG mínimo de prueba. No hubo subidas ni bajas reales. No se
ejecutaron BFF real, axe completo ni Lighthouse/budgets. La cobertura responsive
corresponde a los controles del módulo, sin certificar todo el shell.

## Capturas

![Biblioteca y buscador](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/29-media-library-list.png)

![Menú de colección](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/30-media-library-actions.png)

![Alta lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/31-media-create-drawer.png)

![Detalle tras crear por BFF simulado](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/32-media-created-detail.png)
