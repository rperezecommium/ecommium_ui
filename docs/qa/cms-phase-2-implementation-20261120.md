# CMS — Fase 2, constructor independiente de módulos

Fecha: 2026-11-20.
Estado: **IMPLEMENTADO CON VERIFICACIÓN PARCIAL. NO CERTIFICADO.**
Activación autorizada y ejecutada. Integración Employee real comprobada parcialmente.
Extensión Media autorizada, activada y verificada; pendientes de certificación al final.

## Implementación realizada

Entrada aprobada CMS → Módulos, ruta `/admin/cms/modulos`, Biblioteca/Diseño;
crear, editar, duplicar, renombrar y archivar piezas visuales y ocho tipos
registrados del contrato. Reutiliza editor visual, Media, presentación, CSS,
historial local y renderer compartido. No expone versiones ni cambia Builder,
Headers/Footers, composición de páginas o publicación.

CMS materializa una copia con nuevas identidades, conserva Media compartida y
remapea referencias internas/ARIA/CSS. Creación idempotente con recibo original
persistido, edición/archivo con CAS. UI conserva edición ante rechazo y conserva
payload/operationId tras un resultado ambiguo. Bloquea JSON/CSS inválido y guardado
con subida Media pendiente. El formulario de movimiento ahora admite los valores
enteros del contrato: step50 bloqueaba duraciones existentes como160ms; step1
corrige esa validación sin cambiar el valor guardado.

Reutiliza tabla CmsVisualModuleDefinition con discriminante y migración aditiva;
legacy se filtra aparte. BFF mantiene permisos y lectura por ReadIndex. La extensión
ReadIndex autorizada solo añade independentModules al snapshot CMS y lecturas
versionadas. Proyección antigua incompleta produce not-ready, sin fallback al owner.

Archivos principales UI: `src/modules/cms/cms-independent-module*`,
`cms-independent-modules.ts`, `cms-module-builder-client.tsx`, ruta Módulos,
`packages/cms-blocks/src/react.tsx`. Backend: use cases/repository MODULE en CMS,
validator/use case MODULE BFF, repositorio CMS de ReadIndex y fuente CMS de snapshots.

## Contratos y compatibilidad

Schema compartido UI/CMS/BFF comprobado idéntico. Referencia normativa:
[contrato Fase1](../contracts/cms-phase-1-contracts-and-compatibility.md),
[schema](../contracts/cms-composition-boundary.schema.json) y contrato61/ADR0324
backend. Ajustes ARIA, estado y archivo CAS aprobados; extensión ReadIndex aprobada.
Familia HTTP existente visual-modules; GET usa query contractVersion1 y comandos
body contractVersion1/resourceKind MODULE. Sin discriminante sigue DTO legacy.
No se convierten documentos ni páginas publicadas. Archivo no borra Media.
Postman actualizado con ejemplos explícitos Employee y variables QA vacías.

## Pruebas ejecutadas

| Comprobación | Resultado | Límite de evidencia |
| --- | --- | --- |
| UI: `node --test tests/cms-independent-modules.test.mjs tests/cms-unified-builder.test.mjs tests/contracts/cms-phase-*.test.mjs` | 31 PASS | Schema, copia/recibo, identidad DOM/ARIA, CSS y regresión renderer |
| Backend: `node scripts/test-cms-phase2-postgres.cjs` | 11 controles PASS | PostgreSQL real aislado, repositorios/use cases reales; no BFF Employee |
| CMS: Jest5 suites focalizadas | 46 PASS | Copy, visual value object/entity, repositorio legacy y controller |
| BFF: Jest3 suites CMS focalizadas | 22 PASS | Use cases y controller, dobles para Media/ReadIndex |
| ReadIndex: prisma-admin-cms-modules.spec.ts | 4 PASS | Separación, detalle, paginado, not-ready y binding reader; repositorio con doble |
| `node tests/e2e/cms-independent-modules-browser.mjs` | 3 anchos PASS:1440/768/390 | Cliente real hidratado, acción simulada que falla; JSON/CSS, timeout/reintento idéntico, read-only, overflow, axe sin contraste |
| `node tests/e2e/cms-unified-builder-browser.mjs` | 3 casos responsive PASS | Editor/preview compartidos, CSP, markup/layout, inspector axe y foco; sin mutaciones CMS |
| UI `npm run lint` | 0 errores,3 avisos anteriores | customers-admin-actions, request-client, invoice-document-pdf; no corregidos fuera de alcance |
| UI/CMS/BFF/ReadIndex `npm run build` | PASS los4 | Compilación, no certificación funcional |
| CMS `prisma migrate status` contra configuración operativa | Única pendiente:20261120000100_independent_modules | Solo lectura; no aplicada |

[Resultado SQL persistido](cms-phase-2-postgres-20261120.json). El harness crea
base propia en ce-postgres, genera cliente temporal y elimina ambos al terminar.
Prueba migración sobre esquema anterior, reintentos concurrentes, hash distinto409,
CAS entre dos editores, reapertura tras reconexión, copia con nombre/contenido/CSS
independientes, tenant, archivo, separación legacy, ARIA/Media local y snapshot
CMS real con trigger/outbox existente. No demuestra consumo worker→ReadIndex.
La comprobación de sobrescritura legacy observó P2025 (registro no encontrado),
rechazó la operación y verificó recibo intacto; se corrigió la expectativa de prueba.

## Criterios de aceptación originales

| Criterio | Resultado de Fase2 y evidencia pendiente |
| --- | --- |
| A1 Copia independiente | PASS para pieza visual: Employee→UI→BFF→CMS y reapertura ReadIndex; original intacto tras editar copia. Tipos registrados aún sin recorrido real completo |
| A2 Identidad íntegra | PARCIAL: copia estructural, destinos ARIA/href, CSS raíz/elementos y dos piezas renderizadas sin colisiones; falta integración real y nodos de secciones de Fase3 |
| A3 Contexto y permisos | PARCIAL: aislamiento SQL, schema, guardas conservadas y UI read-only; faltan Employee lectura/escritura y scope ajeno en HTTP real |
| A4 Media compartida segura | PASS subida/copia/reemplazo: referencia compartida inicial y distinta solo en copia tras reemplazar; ambas URLs200. Evidencia cms-phase-2-media-live-20261120.json; rechazo de assets inválidos con dobles |
| A5 Espacios anidados | NO INICIADO: Fase3 |
| A6 Responsive y CSS | PARCIAL: renderer compartido, scopes y navegador1440/768/390; falta integración real, contenedores reales y comparación calculada Compacta contra Productos |
| A7 Página coherente | NO INICIADO: Fase4 |
| A8 Conflicto/publicación | PASS conflicto y archivo por Employee/UI más SQL: B guarda y A obsoleto conserva borrador local; copia sigue DRAFT tras archivar origen. Publicación corresponde a Fase4 y no fue modificada |
| A9 Plantilla independiente | NO INICIADO: Fase5 |
| A10 Compatibilidad | PARCIAL: filtros legacy, prevención de sobrescritura, tests existentes y renderer; matriz completa/publicaciones reales pendiente de Fase6 |
| A11 Fallos de edición | PARCIAL: JSON/CSS inválidos y timeout con payload retenido en navegador; upload real pendiente/fallido y conflicto integrado comprobados. Cambio de documento/contexto y restantes fallos integrados pendientes |

## Regresiones y limitaciones

Builders legacy y nuevo comparten renderer/controles; regresiones focalizadas
pasan. No hay evidencia de equivalencia contra páginas publicadas del entorno.
No se da por cerrado ningún criterio con mocks. No se tocaron las incidencias
anteriores ajenas: aserción textual Biblioteca visual de la suite CMS general ni
mocks BFF de productos incompletos en tsc general; los builds productivos sí pasan.
No se ejecutó la suite global de ecommerce ni se certifica contraste de accesibilidad.

## Preparación de activación (estado anterior a la aprobación)

CMS apunta a Neon remoto, base cms_app. Preparada y probada la migración
`services/cms/prisma/migrations/20261120000100_independent_modules/migration.sql`:
columnas aditivas contract_version/revision_token/operation_id/operation_hash/
creation_receipt e índice único por org/shop/op. Default0 preserva legacy.
No se aplicó esta migración remota ni se reiniciaron servicios para activarla.

Tras autorización: aplicar únicamente la migración comprobada, regenerar cliente
Prisma CMS, activar código con flujo canónico `./scripts/postman-services.sh`,
refrescar snapshots CMS mediante mecanismo existente y ejecutar pruebas reales
Employee/UI/BFF/CMS/ReadIndex/Media, permisos, conflictos y regresiones. No activar
nuevo CMS contra esquema anterior. Si el estado de migraciones cambia, revisar
antes de ejecutar deploy para no incluir cambios ajenos.

## Siguiente fase

Fase3 — Árbol de secciones. **NO INICIADA**. Antes corresponde cerrar las pruebas
pendientes y certificar Fase2; solo después puede solicitarse autorización de Fase3.

## Activación y comprobaciones reales tras autorización

2026-11-20: Ricardo autorizó aplicar la migración y activar procesos.
`prisma migrate status` confirmó que solo estaba pendiente
20261120000100_independent_modules. `prisma migrate deploy` la aplicó y
`prisma generate` regeneró cliente; status posterior: Database schema is up to date.
Sin conversión de documentos ni eliminación de filas.

`PATH=/Users/ricardoperez/.nvm/versions/node/v22.23.2/bin:$PATH ./scripts/postman-services.sh restart-selected cms commerce-read-index bff-admin`
reinició los tres procesos. Node23 fue rechazado previamente antes de detenerlos.
CMS health200, ReadIndex ready200, BFF health200; listado MODULE sin sesión401.

El supervisor commerce-read-runtime omitía CMS de su lista de relays. Existían
relay, perfil y credencial CMS coincidentes. Se incorporó únicamente cms a esa
lista, se ajustaron conteos y aserción de binding en sus tests (2PASS), y se
reinició el supervisor existente para cargar relay y worker actualizados.
No se crearon servicios, credenciales ni mecanismos de proyección alternativos.
Se observaron eventos CMS revision239/240 PUBLISHED y APPLIED en el worker.
La biblioteca pasó de unavailable a listar/reabrir el módulo por ReadIndex.

Pruebas reales por Chrome, sesión Employee guardada y contexto existente
Tienda Barcelona seleccionado por shopAlias, sin extraer credenciales:

- Creación visual y recibo Módulo guardado; recarga y reapertura desde ReadIndex.
- Duplicación con otro resourceId/identidades; nombre, heading y CSS23px propios.
  Recarga conserva cambios; consulta SQL de solo las dos piezas confirma origen
  intacto y copia independiente.
- Dos pestañas sobre la misma revisión: editorB guarda; editorA obsoleto recibe
  conflicto y conserva su texto local. SQL confirma que B no fue sobrescrito.
- Archivo del origen por UI: permanece ARCHIVED; copia DRAFT, reabierta y editable.
- Subida PNG local: Guardar deshabilitado durante la operación; al terminar falla.
  Se detectó que el error no se mostraba si aún no existía assetRef. Se corrigió
  en CmsVisualEditingPanel mostrando los uploads fallidos sin cambiar el contrato.
  Prueba navegador con fallo inyectado confirma feedback/desbloqueo en3 anchos.

[Corroboración SQL acotada](cms-phase-2-live-20261120.json). Piezas QA conservadas:
original22841e08-0ecf-4be8-8c52-df9c52af1a9e archivado;
copia434f1f41-cf12-454c-a968-18f6456c3559 DRAFT. La pestaña obsoleta conserva
el borrador rechazado; no es una tercera pieza persistida. No se publicó página.

### Bloqueo Media: requiere decisión de alcance

El flujo CMS uploadCmsBuilderMediaAction crea CMS Builder Assets sin productId.
MediaCreateCollectionUseCase exige productId UUID antes de llamar repositorio o
storage. Reproducción directa de esa clase existente con cuerpo CMS y dependencias
que fallarían si se ejecutasen:400, `productId must be a valid UUID`, sin escrituras.
El navegador devuelve error de solicitud inválida; no se capturó su respuesta
interna completa y no se atribuyen otros fallos de Media sin evidencia.

No se inventó productId ni se reutilizó una colección de un producto. No se
modificó Media. Hace falta aprobar soporte acotado de colecciones no asociadas a
producto para CMS, manteniendo pertenencia Shop, permisos y contrato de productos.
La forma exacta y migración necesaria deben evaluarse con el owner antes de editar.
A4 permanece BLOQUEADO; no se certifica Fase2. A1 y conflicto/archivo de A8 tienen
ahora evidencia integrada representativa, pero no se extiende a publicación ni a
tipos funcionales aún no probados en vivo. A3 mantiene pendientes perfiles
read-only/scope ajeno; A6 mantiene contraste calculado Compacta y contenedores;
A11 tiene evidencia real de conflicto y subida pendiente/fallida, no de todos los casos.

Comprobaciones tras corrección de feedback:32 tests focalizados UI/contratos/Media
PASS; navegador módulos3 anchosPASS; supervisor2PASS. Lint final:0 errores y los mismos3 avisos previos; build final UI PASS.
Fase3 no iniciada.


### Fase2 — Media sin producto, autorización y verificación 2026-11-20

El usuario autorizó la extensión acotada Media/BFF para CMS. Sustituye el bloqueo
anterior: POST `/admin/media/collections` reutiliza multipart y permite **omitir**
`productId`; si se envía exige UUID (vacío/null no son omisión). Colección y asset
responden `productId: null` para CMS. Shop, permisos, validación binaria, storage,
metadata y rutas existentes se conservan. Productos mantienen asociación única;
el flujo draft de producto rechaza una colección sin producto o de otro producto.
No hay endpoint nuevo ni almacenamiento de negocio en Next.js.

Migración `20261120000200_cms_media_collections` aplicada en Neon/media_app:
columna nullable, sin reescribir asociaciones; trigger emite invalidación scope
`reason=non-product-collection`. ReadIndex actualiza AdminMedia y evita recorrer
productos para ese evento; primera vinculación verificada cubre scope sin binding.
Reiniciados Media/ReadIndex/BFF Admin y supervisor existente con Node22; salud200.
Evento Media dd99c500-8228-4aea-84d2-801ddd642a4f observado PUBLISHED→APPLIED.

Pruebas: Media5 suites/29 PASS; BFF Media/adapter/product draft3 suites/17 PASS,
incluido rechazo de colección CMS; ReadIndex nuevo test
scope PASS. Builds Media/BFF/ReadIndex PASS. PostgreSQL desechable5 controles PASS:
migración conserva producto, guardar/reabrir sin producto, múltiples null,
eventos scope y unicidad por producto. Script `scripts/test-cms-media-postgres.cjs`.

Employee real en Chrome: subida PNG, guardado y reapertura; duplicación preserva
mediaAssetId; sustitución por JPG solo en copia; nuevo guardado/reapertura.
SQL acotado confirma origen con asset4c0ede21-b32a-4cbc-8e4d-33b6299e4fd3 y copia
con assetfb2c599c-884b-47c0-ab02-8c197ca372aa; ambos activos, mismo Shop, productId
null y URLs públicas HTTP200. No se borraron assets ni publicaron páginas.
Evidencia UI: `docs/qa/cms-phase-2-media-live-20261120.json` y
`docs/qa/cms-phase-2-media-postgres-20261120.json`.

A4 tiene evidencia integrada de subida/copia/sustitución; no certifica eliminación
de assets compartidos ni permisos ajenos. Fase2 sigue VERIFICACIÓN PARCIAL:
pendientes perfiles Employee read-only/scope ajeno, contraste Compacta calculado,
contenedores responsive reales y regresión publicada. Fase3 no iniciada.

Comprobación final: BFF3 suites/17 PASS y ReadIndex1 PASS ejecutados juntos tras
incorporar el rechazo de colecciones CMS en producto; UI3 tests de identidad,
sincronización de schemas y validación Media PASS. Ejemplo Postman añadido sobre
el endpoint multipart existente (sin ejecución de Postman; el E2E fue por UI).
