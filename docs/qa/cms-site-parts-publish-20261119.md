# Publicación del diseño actual — 2026-11-19

## Causa

El formulario Publicar era independiente del constructor y solo enviaba identidad
y locale. Publicaba la última revisión persistida aunque el canvas tuviera
cambios locales. La revisión inicial podía contener nombre y bloques vacíos.
No se ha confirmado el registro real test_header ni recuperado su contenido:
el navegador inspeccionado redirigió a login.

## Corrección

Headers y Footers usan «Guardar y publicar» en el formulario del snapshot actual.
La Server Action valida la envoltura, guarda nombre/layout/bloques mediante PATCH
draft, comprueba la identidad del recibo y solo entonces llama a POST publish.
El BFF conserva autoridad sobre permisos y dominio. Sin cambios backend.

Si falla el guardado, no publica. Si falla la publicación, informa del borrador
guardado. Los errores vuelven a useActionState sin redirect para conservar estado
local. Ambos botones de guardado se deshabilitan durante la publicación.
Una revisión activa sin cambios no vuelve a publicarse desde el botón.

## Evidencia

- `node --test tests/cms-site-parts-publish.test.mjs tests/cms-admin.test.mjs tests/cms-media-validation.test.mjs`:
  20 aprobadas. Header/Footer, orden save→publish, snapshot actual, errores de
  guardado/publicación, composición inválida/ausente y recibo ajeno.
- `npm run build`: correcto tras corregir el tipado de useActionState.
- `npm run lint`: cero errores; tres avisos previos ajenos a CMS.
- Chromium con builder real hidratado: añadir logo y publicar envía store.logo.
  Acción simulada devuelve error: bloque y cambios pendientes permanecen y
  permiten reintento. Botón accesible en 1440/768/390 px; preview interno fixture.
- Axe: sin incidencias, contraste excluido por pendiente general Admin.
  Sin escrituras BFF ni contenido real modificado.

## Límites

No acredita el recorrido conectado ni conflictos entre empleados. Guardar y
publicar siguen siendo dos peticiones BFF; un fallo de publicación deja el draft
disponible. No recupera cambios locales perdidos antes de esta corrección.
Se conservan los hallazgos de seguridad pendientes.
