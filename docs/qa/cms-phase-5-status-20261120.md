# CMS — Fase5 Plantillas copiables

**Estado: IMPLEMENTADO CON VERIFICACIÓN PARCIAL. No certificada.**

## Implementación realizada

CMS: TEMPLATE SECTION/PAGE, persistencia propia con revisión CAS, creación
idempotente, remapeo de identidades/CSS, archivo DRAFT→ARCHIVED. Migración
20261120000500 aplicada en cms_app tras ensayo PostgreSQL desechable. BFF:
validación de documento/recibo/Media/contexto, permisos existentes y no-store.
ReadIndex: snapshot TEMPLATE y listado/detalle scoped, estado y paginación.
UI: CMS→Plantillas, guardar desde editores existentes, editar con los mismos,
aplicar como nueva sección/página, archivo con revisión. Página copia solo
composición, no metadatos, ruta ni settings. No almacenamiento Next.js.

## Contratos y decisiones

Las tres decisiones UX/ReadIndex/archivo aprobadas expresamente se han recogido
en contrato61 backend y [readiness](../contracts/cms-phase-5-readiness.md).
Schema compartido incluye templateArchive y estado de recibo. Lecturas BFF
usan ReadIndex; escrituras CMS; Media existente se conserva por referencia.
Settings heredables y endpoints legacy separados. Postman actualizado.

## Pruebas ejecutadas

- PostgreSQL real desechable:12/12 PASS, limpieza confirmada. Incluye migración,
  replay concurrente, hash conflict, CAS, scopes, remapeo CSS, archivo y copia
  de SECTION independiente tras archivo. [Evidencia](cms-phase-5-postgres-20261120.txt).
- CMS TEMPLATE5/5; BFF12/12 (7TEMPLATE+5SECTION); ReadIndex3/3.
- UI contratos23/23, helpers/regresión8/8 (incluye2 de copia TEMPLATE).
- CMS/BFF/ReadIndex/UI compilan. UI lint0errores y3warnings preexistentes.
- Navegador aislado de regresión: compositores Página y Sección PASS a1440,
  768 y390px: copia/CSS/timeout/solo lectura/axe sin contraste. El ensayo actualizado de Página también ejecuta el drawer real de Guardar plantilla,
  axe sin contraste, límites de viewport y reintento con timeout controlado.
- Employee real: login/contexto Barcelona, crear/reabrir plantilla SECTION,
  aplicar y guardar sección destino, editar origen. Lectura SQL limitada a dos
  piezas QA: cero IDs compartidos y misma referencia Media; destino intacto.
  [IDs y resultados](cms-phase-5-live-20261120.json).

## Criterios de aceptación originales

| Criterio | Resultado y evidencia |
| --- | --- |
| A9 aplicar, editar/archivar origen y releer página intacta | PASS real: SECTION y PAGE guardadas/aplicadas; orígenes editados/archivados; destinos conservados. PAGE CSS17px intacto frente a origen39px. |
| A3 contexto y permisos | PARCIAL: scopes/locale en PostgreSQL y BFF; Employee escritor real; falta cuenta Employee lector y pruebas reales de rechazo para ese perfil. |
| Identidad y Media | Copias owner/UI probadas; SECTION real sin IDs compartidos, mismo mediaAssetId; PAGE real sin IDs compartidos con plantilla; doble copia owner/UI cubierta por tests. |
| CSS/responsive | Biblioteca real390/768/1440 usa Compacta13px/padding5px8px y scroll contenido. Remapeo y regresión PASS. Drawer axe PASS tras corrección semántica autorizada; límites/arrastre/memoria PASS. |
| Guardado/conflictos | PASS PostgreSQL/BFF y doble editor TEMPLATE real: persiste41px, obsoleto52px rechazado sin perder borrador. Ensayo controlado de timeout/reintento idéntico y axe del drawer PASS. |
| Preview/Storefront | PASS real: contenido y CSS17px coinciden tras aplicación, edición y archivo del origen. Página QA despublicada al terminar; público404. |

## Regresiones y límites

Conservados editores y rutas MODULE/SECTION/PAGE/settings legacy. No intervenidos
otros servicios. No se borraron piezas QA. La reemisión de4scopes CMS después del
reinicio corrigió503 READ_INDEX_NOT_READY: el proceso anterior había consumido el
evento de migración antes de cargar la fuente con TEMPLATE. Health4/4 correctos.
No se presenta como fallo corregido de otras áreas ni certificación productiva.

La edición real detectó Guardar plantilla deshabilitado por rawDirty, que refleja
cualquier input: se retiró esa condición manteniendo validación antes del envío.
Guardado posterior confirmado. Los editores se bloquean durante un guardado de
plantilla incierto para conservar exactamente el intento sin perder cambios.

El bloqueo inicial de navegador quedó resuelto. El archivo usa ahora el patrón
HTML dialog existente en CMS y se ha verificado con ambos tipos de plantilla.
El pendiente actual es la integración con Employee lector;
se detallan abajo. No hay publicación QA activa.

**Siguiente fase:** Fase6 — Migración y retirada gradual. NO INICIADA; requiere
cerrar la verificación de Fase5 y nueva autorización expresa.

## Continuación tras intervención del usuario

El usuario no veía el diálogo. La pestaña4 ya no existía y se recuperó la
interacción. Se sustituyó únicamente window.confirm de archivo TEMPLATE por
el patrón dialog HTML de CMS, con mismos pasos y contrato; confirmado archivo
real de ambos orígenes. No fue necesaria intervención en autenticación.

A9 PAGE completado con título/ruta/SEO propios; original cambia17→39px, copia
conserva17px al reabrir y publicar. Borrador/publicación conservan contenido.
Cero identidades compartidas entre origen y página según lectura SQL limitada.
Estado final de páginaUNPUBLISHED; documentos QA conservados, sin borrado.

Prueba adicional del drawer con axe produjo fallo reproducible
aria-allowed-role en AdminResizableDrawer (`aside role=dialog`). El resultado
se conserva en cms-phase-5-template-drawer-axe-20261120.txt; no se desactiva la
regla. Requiere autorización acotada para corregir el elemento compartido y
ejecutar regresión. El ensayo anterior del reintento TEMPLATE sin este chequeo
pasó a1440/768/390. Build y lint posteriores al diálogo HTML correctos.

Pendientes actuales: Employee lector real y corrección/validación del drawer
compartido, solicitadas al usuario. El intento de cambiar locale mediante
selector permaneció en es-ES; no se contabiliza como prueba de scope UI ni se
interviene en ese componente. Aislamiento owner/BFF sí consta en ensayos previos.
La fase permanece VERIFICACIÓN PARCIAL; Fase6 no iniciada.

## Cierre de corrección semántica autorizada

El usuario autorizó expresamente cambiar únicamente el elemento del drawer
compartido y ejecutar regresión. AdminResizableDrawer pasa de aside a div,
conservando role=dialog, props, clases, refs, eventos y tamaños. No se modifica
el contrato BFF ni la interacción. La infracción aria-allowed-role queda resuelta.

- `node --test tests/admin-drawer-size.test.mjs`:4/4PASS.
- Playwright `Admin drawers resize within bounds|drawer query changes`:2/2PASS.
  Incluye arrastre, límites, teclado, memoria por módulo y navegación/query.
- Browser compositor/Guardar plantilla:PASS1440/768/390, axe sin contraste,
  límites de viewport y reintento exacto con timeout controlado.
- BuildPASS; lint0errores/3advertencias previas.

**Estado vigente: VERIFICACIÓN PARCIAL. Pendiente únicamente la prueba real
con Employee de lectura sin escritura/publicación.** El usuario confirma que
indicará esa cuenta; todavía no la ha facilitado. No se cambian permisos ni
se sustituye esa prueba por un mock. Fase6 no iniciada.

El usuario autoriza expresamente iniciar Fase6 (2026-11-20). Se inicia su
evaluación acotada sin convertir este permiso en certificación de Fase5.
Referencia: ../contracts/cms-phase-6-readiness.md.
