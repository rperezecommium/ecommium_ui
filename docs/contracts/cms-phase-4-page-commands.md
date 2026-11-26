# Fase 4: comandos de composición de páginas

Estado: implementados en código; integración real y certificación pendientes.
2026-11-20. Complementa los contratos aprobados de Fase 1. No sustituye sus
criterios ni autoriza Fase 5.

## Recorrido y compatibilidad

UI → BFF Admin → CMS. Las lecturas Admin de páginas siguen el cliente CMS
existente; no cambian a ReadIndex. Se reutilizan las rutas `/admin/cms/pages`,
`/:pageId/draft` y `/:pageId/publish`, con contexto explícito en query.
Legacy conserva `blocks` y sus rutas/editor actuales. Las nuevas páginas usan
`composition`; no aceptan ambos formatos en un mismo comando.

## Crear

POST pages: `{pageType,title,path,seo,composition}`. `composition` contiene
`{contractVersion:1,operationId,document}`. El documento es
`{compositionSchemaVersion:1,sections,styleSheet?}`. El owner materializa copias
independientes y remapea identidades y selectores. UUID de operación estable en
reintentos; mismo UUID con otro contenido produce conflicto. Página, primera
versión y recibo de creación se guardan en una transacción.

## Guardar borrador

PATCH draft: `{title?,path?,seo?,composition}`. `composition` contiene
`{contractVersion:1,expectedRevision,document}`. CAS del owner; nuevo token y
versión inmutable. Editar una página publicada mantiene el snapshot activo.
Cambiar path con ruta existente sigue el flujo de cambio de path publicado.
La UI confirma contenido, metadata, contexto e identidad del recibo; tras un
resultado ambiguo de guardado consulta el documento para confirmar el snapshot.

## Publicar

POST publish:
`{contractVersion:1,operation:"PUBLISH",operationId,expectedRevision,versionId}`.
Debe identificar exactamente el borrador confirmado. Operación persistente
PREPARED, llamada al puerto Routing existente, confirmación transaccional de
página, versión, outbox y recibo COMPLETED. Replay completado no repite Routing.
Una llamada Routing fallida deja el borrador sin activar y permite reintentar.

## Coordinación de operaciones autorizada

Cambio de ruta: PATCH `/:pageId/path` con
`{contractVersion:1,operation:"CHANGE_PATH",operationId,expectedRevision,nextPath}`.
Despublicar: POST `/:pageId/unpublish` con
`{contractVersion:1,operation:"UNPUBLISH",operationId,expectedRevision}`.
Eliminar: DELETE `/:pageId` con
`{contractVersion:1,operation:"DELETE",operationId,expectedRevision}`.
Se conservan los permisos existentes y contratos legacy. Una página de composición
rechaza los mutadores legacy antes de cualquier llamada a Routing.

La reserva por página se crea bajo bloqueo de fila y tiene índice único parcial.
Mientras está activa bloquea guardado y operaciones incompatibles. Estados:
PREPARED → RUNNING → APPLIED → COMPLETED. Solo la transición PREPARED→RUNNING
habilita un envío externo; los duplicados concurrentes no lo repiten. APPLIED
registra el resultado de Routing antes de confirmar página/outbox/recibo en una
transacción. Reintentar APPLIED completa CMS sin repetir Routing. El recibo de
DELETE permanece disponible después de borrar la página.

GET de la página devuelve un snapshot coherente con `pendingOperation`:
`{state,command}`; la UI conserva la operación al reabrir, sin versiones visibles.
UNPUBLISH mantiene la semántica existente: CMS deja de servir la página, sin
mutación externa de ruta. DELETE de página publicada se rechaza antes de Routing.

**Resultado externo ambiguo:** RUNNING no confirma si Routing llegó a ejecutar.
Se mantiene la reserva; no existe expiración automática, liberación forzada ni
reenvío ciego. Requiere diagnóstico operativo si no llega una confirmación. El
contrato de Routing actual no proporciona un recibo/fencing para resolver esa
ambigüedad automáticamente. Esto es una limitación explícita de recuperación,
no una operación terminada ni un éxito oculto.

La colisión reproducida quedó bloqueada en PostgreSQL real con puerto Routing
simulado, incluidos duplicados concurrentes y replay tras cambio posterior de
ruta. Pendiente validación integrada por navegador.

## Validación y renderer

Schemas sincronizados UI/BFF/CMS; Media se verifica en BFF mediante el caso de
uso existente. Límites globales: 24 secciones,120 nodos,8 niveles,1MiB UTF-8.
CSS de página alcanza raíz y wrappers de sección, no interiores de módulos.
Storefront recibe solo composición publicada y comparte renderer con preview.
El BFF hidrata `commerce.productGrid` en composición y evita cachear su precio.
La UI valida el documento público sin persistir esos campos transitorios.

## Preview autorizado

POST `/admin/cms/pages/preview?organizationId=…&shopId=…&locale=…`.
Body: el documento `composition` directamente, sin operationId ni escritura.
HTTP200: `{context:{organizationId,shopId,locale,currency,country,channel},document}`.
Sesión Employee, guards Admin/tenant/roles y permiso `cms.pages.read`;
Cache-Control Admin no-store. Se validan composición y Media antes de hidratar.
El resolver existente obtiene currency/country/channel del contexto de tienda;
no se admiten overrides de grupos de cliente ni tarifas desde el documento.

Hidratación compartida mediante `hydrateCmsProductGrids` con Storefront,
con el mismo límite, plazo y estados READY/UNAVAILABLE/UNSUPPORTED_SOURCE.
El endpoint no guarda, publica, resuelve rutas ni emite analítica. La lectura de
productos puede calentar sus caches/proyecciones existentes.
La UI valida contexto y equivalencia del documento sin campos transitorios,
mantiene el resultado separado del borrador y descarta respuestas obsoletas.
Implementado tras autorización expresa; pendiente recorrido real integrado.

## Activación

Migración aditiva `20261120000400_page_composition` probada en PostgreSQL Docker
desechable y aplicada el2026-11-20 al CMS Neon/cms_app ya configurado. No editar
su SQL después de esta aplicación. CMS/BFF Admin/BFF Storefront reiniciados por
script canónico con Node22; los tres health listos. Sin cambios de credenciales,
proveedores, permisos ni servicios ajenos. El E2E real está pendiente de seleccionar
el contexto de Tienda Barcelona en la sesión Employee abierta.
