# Fase 6 — Migración y retirada gradual

Estado: IMPLEMENTADO CON VERIFICACIÓN PARCIAL. No CERTIFICADA. 2026-11-20.
La aprobación del usuario incluye la coordinación acotada de mutaciones legacy.
El bloqueo de concurrencia reproducido inicialmente está resuelto y probado.
Las fases anteriores no quedan certificadas por esta autorización de avance.

## Implementación realizada

CMS: conversores puros legacy-module-migration y legacy-page-migration;
snapshot autoritativo y revisión SHA256; migration-preview sin escritura;
migrate transaccional, idempotente y con publicación legacy conservada.
Lectura mixta de borrador de composición y versión publicada legacy.
Coordinación persistente existente ampliada a publicar, cambiar ruta,
despublicar, borrar, guardar draft y settings de página legacy. Reserva previa
a efectos externos; operaciones ambiguas conservan la reserva. Sin nuevas tablas.

BFF: endpoints de migración, validación de contexto, composición, Media y recibo;
reutilización de hidratación pública para preview. UI: revisión explícita en
AdminResourceDrawer, conversión, reintento de la misma operationId ante resultado
incierto y reapertura en compositor. Builder redirige páginas convertidas y
conserva documentos no convertibles. Sin almacenamiento alternativo en Next.js.

## Contratos

POST /admin/cms/pages/:pageId/migration-preview: {pageId,sourceRevision,
convertible,issues,document?}; fuente owner, no escritura. POST /:pageId/migrate:
{contractVersion:1,operationId:UUID,expectedSourceRevision:SHA256}. Documento
derivado en CMS; respuesta de página con recibo de composición existente.
Employee y cms.pages.read/write respectivamente, contexto Organization/Shop/locale.
409 ante fuente cambiada, página ya convertida con otra operación o mutación en
curso; 400 si no convertible. Replay no crea una segunda versión. Se mantienen
endpoints y payloads legacy. No se ha modificado ReadIndex en esta fase.

## Pruebas ejecutadas y evidencia

- CMS:44/44,10 suites; BFF:11/11,2 suites; UI:5/5. Logs phase-6-*-tests adjuntos.
- Regresión preview/publicación site parts y Footer:12/12 (unidad, no E2E de asignaciones).
- Builds CMS, BFF y UI:PASS. Lint UI:0 errores,3 warnings previos ajenos.
- CMS lint no ejecutable por configuración ESLint ausente; no se creó una nueva.
- PostgreSQL desechable: coordinación legacy PASS y migración10 comprobaciones
  PASS, incluidos rollback, replay simultáneo, fuente cambiada y exclusión mutua.
  Routing controlado en esas pruebas: no equivalen a E2E de Routing real.
- Browser fixture:1440/768/390 PASS; preview, acordeón, reintento idéntico tras
  timeout, incompatibilidad y axe sin contraste. Son fixtures de acciones UI.
- E2E real Employee/Tienda Barcelona: página QA01d727bb-2085-475f-bcfb-2d1f995cde58,
  publicada legacy → preview → convertir → reabrir → publicar composición.
  BFF Storefront devuelve un snapshot JSON idéntico antes/después de convertir.
  Publicación explícita y enlace antiguo del Builder verificados en navegador.
- Geometría DOM de v1, títulos, acordeón y referencia idéntica al baseline en
  1440/768/390. Media mantiene URL y tamaño desktop1385x490. No es pixel diff.
- Archivo real de definición QA2b711518-8d05-4055-9ee2-e21eb83bd1ae: documentos
  guardado/publicado idénticos; contenido permanece visible al recargar Storefront.
- Limpieza reversible: QA despublicada; navegador confirma404. No se eliminó. Dos borradores QA negativos quedaron DRAFT y nunca se publicaron.

Corrección acotada detectada por E2E: resolver legacy incluye espaciado undefined;
se omiten exclusivamente esas propiedades al generar CSS. Prueba representativa
conserva padding explícito y omite campos ausentes. La UI real confirmó el arreglo.

## A10 — cada fila original

| Fila | Resultado y evidencia |
| --- | --- |
| v1 inline | Parcial: unidad y E2E real texto/padding equivalentes; no todas las variantes Media/props legacy |
| v2 inline | Parcial: persistencia/reapertura y Media real; remapeo de IDs en unidad, doble instancia migrada real pendiente |
| Referencia ACTIVE | PASS caso representativo: materialización y archivo real de origen sin alterar copia guardada/publicada |
| Referencia ausente/archivada | PASS: preview real de ambos casos rechaza sin documento y conserva recibo original idéntico; JSON live-unavailable-references |
| Bloques funcionales | Parcial: acordeón real; carrusel/acciones no verificados, slider bloqueado |
| Áreas/columnas/placements | Parcial: orden y bloque sin ubicación,1440/768/390; multicolumna/visibilidad no equivalentes bloqueadas |
| Template settings heredado | Parcial: no se mutan templates; ensayo de edición heredada posterior pendiente |
| Header/Footer y asignaciones | Parcial: contenido público visible tras migración/publicación; edición/preview/asignaciones no ensayadas en esta fase |
| Página publicada | PASS caso real: snapshot público idéntico tras conversión; cambia solo al Publicar; concurrencia/rollback en PostgreSQL |

A10 no certificado: no se sustituye la matriz original por los casos que pasan.

## Regresiones, compatibilidad y limitaciones

Home revisada en navegador: conversión deshabilitada por runtime/PLP/layout,
sin escritura. Documentos comerciales no se migraron. Solo QA se creó, publicó,
convirtió y despublicó. Layout convertible conservador: una columna100%/1fr,
sin CSS legacy de selectores, visibilidad especial, presentación de área ni
alineaciones/modos de contenedor no equivalentes. Esos documentos siguen legacy.
No se retira físicamente Builder ni el adaptador v1. Se requiere ampliar evidencia,
no relajar validaciones, para admitir más casos dentro del plan.

Falta la cuenta Employee de lectura sin escritura/publicación prometida por el
usuario; no se modificaron permisos existentes. No hay certificación real de ese
perfil. Reservas inciertas no se liberan automáticamente; no se creó mecanismo
operativo alternativo de recuperación.

El fixture negativo omitió inicialmente seo.description; CMS lanzó error antes de
persistir. Se completó el campo requerido del fixture y ambos casos pasaron.
No se alteraron contratos ni validaciones para superar la prueba.

Hallazgos B no corregidos: create legacy devuelve error no controlado si falta
seo.description (no corregido en esta fase); preview legacy de referencia puede mostrar fallback
mientras el público resuelve correctamente; nombre idéntico de sección/acordeón
puede duplicar landmarks según axe en fixture. No se cambia renderer compartido.

## Siguiente paso

Completar pendientes de A10 y permisos dentro de Fase6. No existe fase siguiente
autorizada ni se crean tareas paralelas. Ninguna de estas limitaciones se presenta
como certificada.
