# Fase 4 — Simplificación de Páginas

**Estado: VERIFICACIÓN PARCIAL. Contexto desbloqueado y flujo principal E2E real comprobado. No certificada.**

## Implementación realizada

Editor aprobado Página/Composición/Previsualizar; copia de secciones, orden,
retirada, CSS de página, metadata, guardado con revisión y publicación del borrador
confirmado. Legacy conserva editor y contratos. Persistencia aditiva, operaciones
coordinadas y snapshots publicados; renderer compartido y preview BFF autorizado
con hidratación pública y estado separado del borrador.

Extensión autorizada de path/unpublish/delete: revisión esperada, operación
persistente y reserva única por página. Bloquea cambios incompatibles y efectos
externos concurrentes; devuelve el comando pendiente al reabrir. El recibo de
eliminación sobrevive al recurso. No se modificó el servicio Routing.

[Contratos implementados](../contracts/cms-phase-4-page-commands.md).
[Viabilidad](../contracts/cms-phase-4-readiness.md).

## Contratos y activación

UI → BFF → CMS, sin almacenamiento alternativo ni cambio de lectores a ReadIndex.
Schemas sincronizados UI/BFF/CMS; se conservan los contratos legacy y los permisos
existentes. Nueva lectura de preview exige cms.pages.read y no guarda/publica.

Migración20261120000400_page_composition aplicada al CMS Neon/cms_app configurado,
única pendiente comprobada. Reinicio selectivo canónico con Node22 de CMS,
BFF Admin y BFF Storefront. [Tres health200 y preview anónimo401](cms-phase-4-activation-20261120.json).
No cambiar el SQL de la migración ya aplicada. Sin cambios de credenciales/permisos.

## Pruebas ejecutadas

- [PostgreSQL desechable:16 comprobaciones PASS](cms-phase-4-coordination-postgres-20261120.json), cleanup confirmado.
  CAS, scope, replay, rollback de outbox, snapshot activo, reserva, reapertura,
  duplicados concurrentes y ciclo path/unpublish/delete. Routing simulado.
- CMS:4 suites/14 tests de regresión path/unpublish/delete/controller PASS;
  comprobación anterior de composición/publicación/borrador/lectura:15 tests PASS.
- BFF:3 suites/27 tests legacy/controller/adapter PASS;6 tests de comandos de
  composición incluyendo transporte de los tres comandos nuevos PASS.
- Preview BFF y lectura pública:11 tests PASS.
- UI contratos:22 PASS; validación de comandos y helpers de composición:6 PASS.
- [Navegador aislado1440/768/390 PASS](cms-phase-4-coordination-browser-20261120.txt):
  copia/orden/CSS/timeout/retry, reapertura de publicación reservada con la misma
  identidad, bloqueo de edición/guardado, readonly y axe sin contraste.
- Builds CMS/BFF/UI PASS. Lint UI0 errores/3 warnings previos (Clientes,
  request-client e invoice PDF). No se ejecutó lint backend con --fix global.

## Criterios originales

| Criterio | Resultado y evidencia |
| --- | --- |
| A2 Identidad íntegra | Copias publicadas con IDs internos distintos confirmadas en respuesta BFF real; independencia respecto a cambios posteriores del origen pendiente |
| A3 Contexto/permisos | Parcial:Employee escritor real, idioma/tienda ajenos rechazados, preview anónimo401; pendiente Employee lector real |
| A6 Responsive/CSS | Composición/Media reales en3anchos y CSS aislado PASS; limitación del shell en768 fuera de CMS registrada |
| A7 Página coherente | Guardar/reabrir y equivalencia visual Media/grid dinámico Admin-Storefront real comprobados; respuesta pública archivada |
| A8 Conflicto/publicación | Parcial:CAS/outbox/activo/reserva/replay/race PASS en PostgreSQL; publicación, CAS entre dos editores y snapshot público reales comprobados; path/unpublish/republicación reales PASS; eliminación real autorizada y comprobada |
| A11 Fallos de edición | Parcial:CSS inválido, timeout/retry y estado protegido, reapertura reservada; faltan fallos del flujo integrado |

## Regresiones

Tests legacy CMS y BFF incluidos, módulo existente conservado durante la migración
desechable. Header/Footer presentes en la página QA real; no acredita publicación de páginas
legacy existentes. Fases2/3 conservan sus limitaciones anteriores.

## Limitaciones y bloqueo observado

RUNNING conserva una operación cuyo resultado externo es incierto. No se reenvía
ni libera automáticamente. APPLIED permite completar CMS sin repetir Routing.
No hay mecanismo de resolución automática para RUNNING abandonado: requiere
diagnóstico operativo. No se presenta ese bloqueo conservador como operación
terminada ni como garantía de recuperación automática.

La sesión Employee y el contexto Tienda Barcelona quedaron operativos sin cambios
en autenticación/contexto. Credenciales utilizadas únicamente en el login; no
almacenadas en archivos de evidencia.

### E2E real adicional (2026-11-20)

Página QA `e9940f04-c2f9-46e1-847f-023ffea60fc8`, ruta
`/qa-fase4-20261120`, origen UI `http://localhost:5173`.

- Creación con título/SEO y dos copias de `QA Fase3 editor B`: guardado confirmado.
- Reordenación y CSS `:scope { padding: 13px; }`: guardado y reapertura confirmados.
- Preview real: ambas piezas visibles; publicación: mensaje «Página publicada».
- Storefront real: título publicado, dos piezas, Header/Footer existentes presentes.
- Segundo editor guardó `QA Fase4 borrador B`. Editor obsoleto recibió «La página
  ha cambiado. Tu borrador sigue aquí; vuelve a abrirla para recuperar la revisión
  actual». Reapertura conservó B. Storefront recargado conservó el título publicado
  `QA Fase4 20261120`; lectura HTTP BFF público confirmó 200 y versión 2 publicada.
- [Respuesta pública real](cms-phase-4-public-live-20261120.json): dos sectionId,
  nodos e identidades internas distintos; ambos conservan el mismo mediaAssetId.
- Corregidos en el compositor dos defectos observados: CSS de panel que anulaba
  `hidden` y formulario de despublicación con estilo de popover que solapaba SEO.
- Tras corrección: build PASS; lint 0 errores/3 warnings previos; navegador aislado
  PASS en 1440/768/390 incluyendo aserciones de ocultación de pestañas inactivas.

### Continuación: integración real y correcciones delimitadas

- Cambio de ruta real a `/qa-fase4-20261120-ruta-b` y después
  `/qa-fase4-20261120-ruta-c`. El segundo cambio se reflejó sin recargar tras
  incorporar revisionToken a la identidad React del compositor. Antes de la
  corrección, CMS guardaba correctamente pero la UI retenía el estado anterior.
- Despublicación real: desapareció el control de despublicación, listado
  UNPUBLISHED y Storefront «Error 404 / No encontramos esta página». Republicación
  posterior confirmada con tres secciones y nueva retirada al terminar QA.
- Media: DOM mostró span con display:inline y ancho0 pese a referencia correcta.
  La regla legacy de variables CSS anulaba los defaults. VisualImage conserva ahora
  geometría base explícita y data-cms-style-id para sus reglas responsive.
  Storefront y preview real muestran las imágenes, misma URL Media; altura490px.
- Caso dinámico creado mediante UI: módulo `0cf8ba54-6ae3-41ef-a8f5-37ddfcd4272e`,
  sección `70f8cad0-1faa-4ad3-8781-ec2ff30a0a3d`, categoría bike-brakes, límite2.
  Preview y Storefront mostraron exactamente los mismos nombres/precios/descuento:
  BBB Cycling Code BD-568-0922 (80,24 EUR), BBB Cycling Deore XT BD-219-0573
  (7,00 EUR; anterior7,99; descuento12%). Primera carga fría UNAVAILABLE;
  reintento resuelto tras calentamiento. Sin cambios a contratos comerciales.
- Independencia: renombrar y guardar la sección fuente como
  `QA Fase4 sección origen modificada` no cambió el nombre de la copia publicada.
  No se da por probado cambio de contenido del módulo fuente: su edición no quedó
  persistida y no se utiliza como evidencia.
- Scope real: en-US rechazado; shop `61e6bdf2-e9e4-448d-890b-0be94871cd8e`
  rechazado con «El recurso solicitado no está disponible». Restaurado Barcelona.
- Responsive Storefront real390/768/1440: imágenes dentro del ancho de composición
  (279px/641px/anchura desktop); rejilla sin desbordamiento interno. En768 se
  observó desbordamiento del panel de cuenta del shell existente, fuera de CMS;
  registrado, no corregido. No acredita responsive completo del shell.
- Regresión real de lectura: `/seleccion-bike-brakes` mantiene título, grid20,
  imágenes y Header/Footer. No se republicó ni modificó esa página legacy.
- Nueva regresión aislada: Media con geometría visible y altura responsive
  210/140/90 según viewport; pestañas inactivas ocultas. Tres anchos PASS.
- Build PASS; lint0errores/3warnings previos; helpers/coordinación/renderizador
  13/13 PASS tras los cambios.

[Respuestas públicas de rutas y composición](cms-phase-4-public-lifecycle-20261120.json).
[Regresión de navegador actualizada](cms-phase-4-ui-browser-20261120.txt).
[Regresión unitaria actualizada](cms-phase-4-ui-regressions-20261120.txt).

Eliminación definitiva autorizada expresamente por el usuario y ejecutada desde
el formulario UI para `e9940f04-c2f9-46e1-847f-023ffea60fc8`. Resultado:
«Pagina CMS eliminada definitivamente»; listado pasa de5a4 conservando las cuatro
páginas previas. Reapertura por ID: «El recurso solicitado no está disponible»
(correlation `ui-1795197244878-364bb9e810c43`). Storefront en
`/qa-fase4-20261120-ruta-c`: «No encontramos esta página».

Pendiente: Employee solo lectura (usuario indicó que facilitará cuenta).
Módulo y sección QA permanecen disponibles. No se certifica la fase mientras
falte esta comprobación requerida.

**Fase5 — Plantillas copiables:** el usuario autorizó expresamente iniciarla
el 2026-11-20. Esta autorización no certifica Fase4 ni cierra su pendiente de
Employee lector. Evaluación e incrementos en `../contracts/cms-phase-5-readiness.md`.
