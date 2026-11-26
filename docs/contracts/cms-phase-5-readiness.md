# CMS Fase 5 — Plantillas copiables

2026-11-20. Inicio autorizado expresamente por el usuario. La autorización para
avanzar no certifica Fase4: conserva pendiente Employee solo lectura.

## Alcance y contratos comprobados

Fuente normativa: Fase1, schema `cms-composition-boundary.schema.json` y contrato61
del composable. TEMPLATE contiene `name` y `content:{kind:SECTION|PAGE,value}`.
PAGE contiene composición, no título/SEO/ruta ni settings heredables. Al aplicar,
los metadatos pertenecen a la página destino. No hay vínculo vivo ni sincronización.

Rutas ya previstas en contrato61: GET/POST `/admin/cms/composition-templates` y
GET/PATCH `/:templateId`. Crear usa operationId; actualizar expectedRevision;
recibo resourceId/revisionToken/context/document. Locale obligatorio, permisos
existentes cms.pages.read/write. No se inventa endpoint de clonado o aplicación:
se materializa una copia y se usan los comandos de SECTION/PAGE existentes.

Las rutas de templates existentes administran `CmsTemplateSettings` y herencia.
No representan TEMPLATE y deben conservarse íntegramente. El schema Prisma
inspeccionado no tiene persistencia de plantillas copiables. Se justifica una
entidad CMS separada, mínima, con documento, contexto, revisión, estado y recibo
de creación idempotente, siguiendo CmsSection; no otro servicio ni almacenamiento
Next.js. No aplicar migración antes de validar en PostgreSQL desechable.

## Reutilización y componentes directos

- UI: cms-section-tree, cms-page-composition, validadores de borde, cliente BFF,
  acciones Employee, editores de sección/página y renderizadores compartidos.
- CMS: sectionDocument/materializeSection, validación de composición y remapeo de
  CSS/ARIA/fragmentos; patrón de repositorio SECTION con CAS y recibo persistente.
- BFF: comprobación Media recursiva de ManageIndependentCmsModulesUseCase,
  contexto/guards existentes y transporte CmsClientPort.
- Bibliotecas MODULE/SECTION leen ReadIndex. TEMPLATE requiere colección y
  consultas proyectadas propias; la extensión acotada de ese servicio está aprobada.
- Settings templates, Header/Footer y páginas legacy no se convierten ni editan.

## Decisiones aprobadas por el usuario

UX aprobada: CMS → Plantillas; biblioteca de sección/página; guardar desde
editores existentes; aplicar como copia, usando plantilla PAGE al crear página
nueva. No sustituir una página existente. Edición del contenido reutiliza sus
constructores; no añadir un tercer builder ni historial visible.

El schema aprobado no define archivo ni estado TEMPLATE aunque A9 contempla
editar/archivar el origen. Concreción aprobada: templateReceipt.status DRAFT|ARCHIVED,
comando templateArchive con contractVersion/resourceKind/expectedRevision, POST
`/:templateId/archive`; filtro status en listado. Archivo conserva documento y
recibo de creación, impide editar/aplicar el origen archivado y no afecta copias.
El usuario aprobó expresamente esta extensión y la proyección TEMPLATE en ReadIndex.

## Secuencia y comprobaciones

1. Cerrar decisiones anteriores. Validación TEMPLATE delegando en SECTION/PAGE;
   pruebas de discriminación, cotas, IDs y remapeo sin copiar hidratación comercial.
2. Persistencia CMS: crear/replay, lectura, update CAS y archivo. PostgreSQL real
   desechable: scopes, conflicto, rollback y replay tras archivo, sin datos reales.
3. BFF/ReadIndex: validación de entradas/recibos/Media, contexto y permisos;
   pruebas de proyección y lectura, sin consultas UI al owner.
4. UI: guardar como plantilla, biblioteca/edición y aplicar copia a destino nuevo;
   conflictos/timeout conservan borrador y operationId. Reusar tablas Compacta.
5. E2E real: guardar plantilla SECTION y PAGE, aplicar, guardar/reabrir destino,
   editar/archivar origen, destino permanece intacto; doble copia sin IDs comunes,
   Media compartida, CSS acotado, publicación/preview por flujo ya existente.

Criterios originales: A9 (principal), A3 (contexto/permisos), más identidad,
Media/CSS y regresión necesarias para demostrar independencia. No certificar con
fixtures, compilación o lint únicamente. Employee lector sigue siendo una
dependencia de validación real pendiente; no cambiar permisos para sustituirla.

## Herramientas y estado

Node22, Jest, Prisma, PostgreSQL desechable y navegador disponibles y utilizados
en fases anteriores. Sesión Employee real con escritura comprobada. Antes de
activar cambios, repetir health y comprobar destino de migración/reinicios.
Baseline `npm run test:cms-contracts`: 22/22 PASS el 2026-11-20.

Estado: implementación y verificación en curso; contratos/UX aprobados.
Primer incremento independiente implementado: compositionTemplateDocument en CMS
valida SECTION/PAGE con validadores existentes, devuelve snapshot aislado y rechaza
metadatos de página, herencia, campos desconocidos, hidratación y IDs duplicados.
Registro de las cuatro formas TEMPLATE aprobadas en el validador owner.
Pruebas:3 suites/11 tests PASS (4 nuevos TEMPLATE y7 de regresión sección/copia).
Evidencia: `../qa/cms-phase-5-owner-validation-20261120.txt`.
Sin endpoints nuevos activados, sin migraciones aplicadas, sin Fase6.

2026-11-20 — Incrementos siguientes: repositorio CMS, migración aditiva, comandos
y recibos TEMPLATE, BFF y ReadIndex implementados; UI biblioteca/guardar/editar/
aplicar conectada a editores existentes. PostgreSQL desechable12/12PASS; BFF7/7
y ReadIndex3/3PASS; copia UI2/2PASS. Builds CMS/BFF/ReadIndex/UI PASS; lint UI
0errores/3warnings previos. Migración20261120000500 aplicada en cms_app. Tras
reinicio selectivo se reemitieron scopes CMS: la migración había sido consumida
por el proceso anterior y ReadIndex devolvía503 READ_INDEX_NOT_READY. Reemisión
con fuente nueva restauró biblioteca real sin alterar documentos. E2E en curso.
