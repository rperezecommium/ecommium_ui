# CMS — Fase 1: contratos y compatibilidad

Fecha: 2026-11-20. Estado vigente: **CERTIFICADA — Fase 1, especificación y compatibilidad**.
La implementación funcional de fases 2–6 continúa NO INICIADA.


## Cierre vigente de Fase 1 — 2026-11-20

D1–D3 aprobadas expresamente. Este cierre sustituye los estados parciales de las
entradas cronológicas posteriores. Certifica los entregables de definición de Fase1;
no certifica endpoints, editores, migraciones ni garantías transaccionales futuras.

Fuente normativa de formas nuevas: `cms-composition-boundary.schema.json`, más
reglas semánticas de este apartado y contrato61 del backend. El pseudocódigo inicial
es orientativo; prevalece el schema (por ejemplo SECTION/PAGE en plantilla).

Entregables cerrados:
- Identidad, copia, ámbito, Media y CSS: reglas D1–D3 y remapeo del apartado original.
- Mensajes de creación/edición/recibo de MODULE, SECTION y TEMPLATE; actualización
  de composición y publicación de PAGE; discriminación y campos cerrados en schema.
- Ocho tipos funcionales con props tipadas; visual v2, presentación y hojas CSS
  reutilizan gramática del owner. Datos de hidratación, placement/target legacy y
  referencias vivas no forman parte de una pieza nueva independiente.
- Compatibilidad: los adaptadores legacy separarán placement/target de la pieza,
  conservarán su superficie y rechazarán insertar bloques exclusivos PLP en una
  página CMS incompatible. No aplicar schemas nuevos retrospectivamente a legacy.
- Presupuesto inicial de contrato:8 niveles estructurales,24 secciones,120 nodos
  estructurales/instancias agregados y1MiB UTF-8 del request completo. El árbol
  interior de cada módulo conserva sus cotas actuales. No es un SLA de rendimiento.
- Conflicto e idempotencia: expectedRevision/revisionToken, operationId persistente,
  autorización antes de replay, hash de entrada y escritura atómica owner.
- Publicación: mismo path; cambio de path por flujo dedicado existente. Preparar
  snapshot validado, resolver ruta, confirmar en transacción local con CAS, estado
  de operación y outbox. El recibo de la misma operación se reproduce sin repetir
  efectos. No almacenar bearer ni crear worker/servicio nuevo para este contrato.

La operación persistida se identifica por organizationId/shopId/locale cuando aplica,
tipo de comando y operationId. Incluye hash, resourceId, snapshot/versionId y estado
PREPARED|COMPLETED; PREPARED no es éxito público. Al recuperar se verifica autorización,
se reusa snapshot inmutable y ruta de la misma entidad/path, y se confirma mediante
CAS; si otro editor cambió el recurso,409 conserva publicación anterior. No avanzar
ruta activa con un cambio de path como efecto de guardar composición. Timeout deja
resultado indeterminado hasta releer/reintentar la misma identidad; no generar una
nueva operación a ciegas. Este mecanismo será implementación de fases2/4, no existe
aún en el backend actual y no se presenta como probado end-to-end.

El schema de composición no sustituye los metadatos existentes de página. En fase4
el owner guardará composition junto con el título/SEO vigente bajo el mismo token;
si la edición incluye metadatos, conserva sus schemas y los incorpora al snapshot
atómico. GET/recibo público conserva los campos legacy de página y agrega composición
solo para documentos del contrato nuevo. No borrar título/SEO por ausencia en payload.

CSS: validar propiedades/selectores con registro existente; las hojas de espacios
solo afectan sus wrappers, nunca el árbol interno de una pieza. Renderizador deberá
aplicar esa frontera además del prefijo de raíz. Copiar regenera IDs y reescribe solo
referencias locales estructuradas; no reemplaza textos/URLs externos por coincidencia.
Contenido ligado usa el tipo declarado en contentSchema; campos requeridos impiden
publicación incompleta. Valores huérfanos legacy se conservan en compatibilidad y no
se convierten silenciosamente en bindings válidos nuevos.

Media: toda referencia asset: debe existir en assetRefs incluso si la lista está
vacía. La normalización legacy permite src asset: con lista vacía; se demuestra en
la prueba semántica y se exige cerrarlo al integrar contrato nuevo en Fase2.
La validación de propiedad/disponibilidad pública pertenece al recorrido BFF/Media
existente; un URL sintácticamente válido no prueba existencia ni autorización.
No se certifica borrado ni subida Media real en esta fase de definición.

Evidencia de cierre:
- `npm run test:cms-contracts`:19/19PASS; conformidad con validadores reales BFF/CMS,
  negativos estructurales/semánticos y presupuestos. Ver tests/contracts.
- Ensayo PostgreSQL real desechable usando clases/repositorios existentes: copia
  inline, reapertura, aislamiento de repositorio, HTTP real al adaptador de Routing,
  fallo inyectado antes de guardar versión CMS y reintento sin ruta duplicada.
  `docs/qa/cms-phase-1-postgres-20261120.json`:4 controles PASS y cleanup confirmado.
- BFF local real: health200, biblioteca/páginas sin sesión401. UI devuelve307.
  Corrige el diagnóstico HTTP000 anterior: restricciones del sandbox, no servicios
  demostrados apagados. No se necesitó iniciar/reiniciar el stack ni publicar allí.
- `npm run lint`:0errores/3avisos previos; `npm run build`:PASS.
- Las suites anteriores CMS45/BFF10PASS complementan, no se suman como casos únicos.

La prueba PostgreSQL NO es un E2E Employee ni UI→BFF: usa bases propias, clases
productivas y un servidor HTTP de ensayo que invoca use cases Routing reales.
No certifica el nuevo CAS o snapshot compuesto aún no implementados. Es evidencia
real de compatibilidad/persistencia y del reintento sobre el puerto existente.

Fases posteriores conservan A1–A11 íntegros, con persistencia/E2E/Media/responsive y
preview público según corresponda. La puerta de Fase1 exigía contratos acordados,
matriz y casos verificables; esas entregas están completas. Su certificación no
traslada las pruebas funcionales futuras a esta fase ni las da por superadas.
No comenzar Fase2 sin autorización expresa posterior al informe de cierre.

## Alcance y viabilidad

Este documento desarrolla exclusivamente la Fase 1 del plan aprobado: contratos,
copia independiente, identidad/contexto/Media/CSS, guardado/conflictos/publicación,
compatibilidad y aceptación. No implementa el constructor de módulos ni cambia
contratos ejecutables. Fases 2–6: NO INICIADAS en esta intervención.

La preparación documental es viable con el repositorio UI. Certificar el acuerdo
requiere aprobación de las decisiones y sincronización con BFF/CMS. En la preparación inicial no se consultó el backend. Posteriormente el usuario
autorizó backend y frontend; véase el contraste al final. No se modificó código backend. AGENTS.md exige esa sincronización y
prohíbe suplir contratos ausentes con almacenamiento en Next.js.

Herramientas comprobadas: Node v22.23.2 y npm 10.9.2 compatibles con package.json;
TypeScript, Next, React y @playwright/test resuelven desde node_modules; existe el
ejecutable Chromium instalado. Esto no acredita un recorrido E2E ejecutado.
Las consultas sin credenciales a localhost:3026/api/v1/admin/cms/visual-modules y
localhost:5173/admin/cms/builder fallaron en conexión (HTTP 000). No se deduce que
un endpoint no exista. No se iniciaron servicios ni se hicieron mutaciones.
La referencia .docs/06-interfaces/00-frontend-bff-contracts.md no está en este repo;
se usa docs/composable-reference/README.md, sin consultar su origen backend.

## Evidencia y reutilización

| Fuente local | Comportamiento observado | Uso previsto |
| --- | --- | --- |
| src/modules/cms/cms-admin.ts | DTOs y cliente de páginas, visual-modules, layouts y templates | Mantener cliente BFF y contexto; evolucionar contratos con aprobación |
| packages/cms-blocks/src/index.ts | visual.module v2, bloques tipados, contenido, Media, scopes y selectores | Reutilizar gramática visual y registro |
| packages/cms-blocks/src/react.tsx | Renderizador visual y bloques funcionales, incluido accordion | Compartir preview/Storefront |
| src/modules/cms/cms-visual-editor.tsx y cms-visual-editing-panel.tsx | Árbol e inspectores compartidos | Constructor independiente, fase 2 |
| src/modules/cms/cms-editor-history.ts | Historial local acotado | Edición; no historial de versiones de negocio |
| src/modules/cms/cms-block-style-sheet-editor.tsx | CSS canónico por scope | Reutilizar parser y validación, no inventar otro motor |
| src/modules/cms/cms-admin-actions.ts | Upload Media y escrituras BFF | Mantener validación y transporte |
| src/modules/cms/cms-composition-receipt.ts | Comparación de composición enviada/recibida | Base para recibos; exige revisión con normalización e IDs canónicos |
| src/modules/storefront/storefront-cms-page.tsx | Regiones/áreas/columnas y módulos | Compatibilidad y futura lectura del árbol |
| docs/composable-reference/README.md y docs/qa/cms-*-20261119.md | Contratos y evidencias históricas | Referencia, no prueba de runtime actual |

El estado Git contiene cambios anteriores extensos. Esta intervención añade solo
este documento; no incorpora ni revierte esos cambios. securityReadme.md conserva
sus pendientes. No se declara ningún hallazgo de seguridad cerrado.

## Modelo propuesto — pendiente de acuerdo

Módulo: pieza autónoma de biblioteca. Sección: composición de contenedores y
piezas. Página: documento con secciones ordenadas. Plantilla: copia guardada de
una sección o composición para iniciar otra. No introduce otro constructor.

Se propone esta forma lógica; los nombres nuevos NO son DTOs existentes ni
autorización para crear endpoints o tablas. Los tipos reutilizados conservan sus
validadores. El diseño físico de almacenamiento corresponde a CMS.

```ts
type ModuleBody =
  | { kind: "visual"; value: CmsVisualModuleV2Props }
  | { kind: "registered"; type: string; props: Record<string, unknown> };
// registered solo admite tipos del registro y su schema específico; no props libres.
type ModuleSnapshot = {
  instanceId: string;
  name: string;
  body: ModuleBody;
  styleSheet?: CmsScopedStyleSheet;
};
type SpaceNode =
  | { nodeId: string; kind: "container"; layout: "stack" | "flex" | "grid";
      presentation: CmsPresentation; children: SpaceNode[] }
  | { nodeId: string; kind: "module"; module: ModuleSnapshot };
type SectionSnapshot = {
  sectionId: string; name: string; root: SpaceNode;
  styleSheet?: CmsScopedStyleSheet;
};
type PageComposition = {
  compositionSchemaVersion: number;
  sections: SectionSnapshot[];
  styleSheet?: CmsScopedStyleSheet;
};
type CopyableTemplate = {
  name: string;
  content: { kind: "section"; value: SectionSnapshot }
         | { kind: "page"; value: PageComposition };
};
```

El orden canónico es el del array; no mantener un segundo orden numérico editable.
Los IDs identifican nodos, nunca su posición. Se rechazan ciclos, IDs duplicados,
nodos desconocidos y referencias internas rotas. BFF/CMS deben acordar límites
de tamaño, profundidad, nodos y reglas CSS antes de implementar persistencia;
no se inventan números sin contrastar sus límites actuales y pruebas de carga.

El árbol estructural y el interior del módulo tienen gramáticas separadas, aunque
reutilicen controles. La sección no inspecciona ni modifica directamente nodos
internos del módulo. Editar una pieza abre su constructor sobre la copia local;
se confirma dentro del borrador del documento propietario. Cancelar descarta esa
edición local; no modifica la biblioteca.

Los bloques funcionales necesitan conservar su tipo. Accordion existe como bloque,
no como tipo de nodo visual; no convertirlo ficticiamente a visual.module. CTA,
banner y card pueden reutilizar las capacidades existentes según su estructura.
Las acciones se limitan a comportamientos ya soportados. Ningún editor ejecuta
JavaScript arbitrario ni crea integraciones comerciales nuevas.

## Copia independiente, identidad y contexto

1. Duplicar en biblioteca crea un recurso con identidad propia y nombre editable.
2. Insertar en una sección materializa el contenido completo, sin definitionId vivo.
3. Duplicar sección/página/plantilla copia recursivamente todos sus descendientes.
4. Editar o archivar el origen no modifica las copias. No existe sincronización.
5. No se borra ni altera el origen para producir una copia.
6. Identidades persistentes de recursos las confirma CMS. IDs de edición locales
   pueden ser provisionales; el recibo devuelve el documento canónico y cualquier
   remapeo necesario. El backend valida unicidad y alcance.
7. Se regeneran IDs de instancia, nodos/paneles/elementos e IDs DOM; se remapean
   referencias internas, fragmentos locales, ARIA y selectores que apunten a ellos.
   Las claves semánticas de contentSchema y assetKey se conservan dentro de su
   ámbito aislado cuando no hay colisión. No se reemplazan strings indiscriminadamente.
8. Organization/Shop se validan con Employee en BFF; no constituyen autoridad por
   venir del navegador. No hay copia entre tenants/tiendas implícita.
9. Páginas, secciones y plantillas respetan el locale explícito del documento.
   La biblioteca visual existente es shop-scoped y no recibe locale. Se propone
   conservar ese alcance: los valores de contenido se copian al locale de destino,
   sin traducción automática ni incorporación de otro sistema de traducciones.
10. Las copias no congelan datos comerciales dinámicos: una parrilla conserva su
    configuración, pero precio/stock siguen procediendo del BFF al renderizar.

## Media, CSS y responsive

Media conserva mediaAssetId; copiar una composición no duplica binarios. Cambiar
la imagen cambia la referencia local. Borrar un módulo no borra assets compartidos.
La disponibilidad pública y permisos Media deben comprobarse por BFF; el proxy
privado Admin no se persiste como URL pública. Publicar con assets no resolubles
debe producir un error verificable, no éxito con imágenes ausentes. La política
de eliminación de Media existente debe contrastarse; no se añade un recolector.

Reutilizar scopes base/desktop/tablet/mobile y reglas canónicas del registro.
La hoja de un módulo se acota a su raíz, la de sección a sus contenedores y la de
página a su envoltura/composición. No permite selectores que atraviesen el límite
de propiedad para rediseñar descendientes internos de módulos. Valores heredables
se resuelven con tokens; propiedades explícitas del módulo prevalecen para su
interior. Esta frontera exige validación/renderer, no basta un prefijo textual.

Fijar y probar precedencia: tokens heredados → estilo base del recurso → override
del dispositivo → estado de interacción del mismo recurso. Definir la prioridad
de hoja avanzada respecto de controles usando la misma regla que se acuerde para
el editor; propuesta: hoja avanzada prevalece en el mismo ámbito, claramente visible.
La hoja y los controles no deben convertirse en dos fuentes contradictorias.

Se reutilizan breakpoints actuales. Secciones distribuyen espacio según dispositivo;
módulos usan layout intrínseco para adaptarse al ancho recibido. Container queries
no se dan por implementadas ni obligatorias: solo se incorporarán si un criterio
responsive aprobado las requiere y se acuerda su representación en BFF/CMS.

## Guardado, conflictos y publicación

Propuesta: token opaco de concurrencia por recurso/documento. El cliente envía
la revisión leída; una escritura obsoleta se rechaza con conflicto y conserva el
borrador local. No equivale a ofrecer versionado al usuario. El mecanismo exacto
(header o campo) debe sincronizarse con BFF; no está acreditado en el PATCH actual.

La página guarda una composición completa y coherente con título/SEO y presentación
relevante. Publicar referencia exactamente el borrador confirmado, no el estado
más reciente que otro editor pudiera haber cambiado. CMS debe garantizar activación
atómica del snapshot y conservar la publicación anterior si la nueva falla.
La revisión técnica actual puede servir internamente sin añadir controles de versiones.

Recibo requerido: identidad, scope, locale aplicable, token vigente, estado y
composición canónica completa. La UI valida equivalencia con lo enviado permitiendo
solo normalización documentada y remapeo de identidad confirmado. No anuncia éxito
si se pierden módulos, CSS, contenido o Media. Fallos parciales no activan la página.
Ante timeout ambiguo se consulta el estado confirmado; no se reintenta crear/copiar
a ciegas. La garantía contra duplicados de esas operaciones queda pendiente de
acuerdo con el mecanismo de reintentos existente del BFF.

JSON inválido, subidas pendientes o referencias no resolubles bloquean el envío
dependiente. Cambiar de recurso no mezcla borradores. Ocultar escrituras sin permiso
y comprobar autorización final en BFF. Los nombres exactos de permisos se reutilizan
tras contrastar la matriz existente; no se inventan permisos nuevos en esta fase.

## Operaciones y gaps de contrato

| Operación | Contrato observado en UI | Cambio requerido / fase |
| --- | --- | --- |
| Biblioteca visual | GET/POST /admin/cms/visual-modules; PATCH /:id/draft; POST draft-revisions, activate, archive | Mantener transporte; acordar guardar sin versionado visible, copias y bloques registered / 2 |
| Copia de módulo | Se puede crear visual.module completo; inserción actual usa definitionId | Snapshot independiente e integridad de IDs; validar soporte registered y concurrencia / 2 |
| Sección anidada | CmsLayout.regions[].areas[] con columnas y placements | Árbol persistido y entrega pública compatible / 3 |
| Página | PATCH /admin/cms/pages/:id/draft; settings separado; POST publish | Composición completa, conflicto y publicación del borrador confirmado / 4 |
| Plantilla copiable | /admin/cms/templates contiene settings heredables | Semántica de copia diferenciada, no sobrecargar silenciosamente templateId / 5 |
| Migración | v1/v2 y referencias coexistentes | Adaptación verificable y conversión explícita / 6 |

No se asignan rutas nuevas por conjetura. BFF/CMS deben decidir si las extensiones
caben en endpoints actuales y cómo discriminarlas. Cualquier ruta nueva requiere
justificarla con estos gaps y sincronizar la referencia antes de implementarla.

## Matriz de compatibilidad

| Documento actual | Lectura durante transición | Conversión propuesta | Evidencia exigida |
| --- | --- | --- | --- |
| visual.module v1 inline | Mantener adaptador existente | v2 solo al convertir con validación | Contenido, Media y estilos equivalentes |
| visual.module v2 inline | Mantener renderer | Snapshot autónomo con IDs seguros | Guardar/reabrir y doble instancia sin colisiones |
| Referencia definitionId ACTIVE | Mantener resolución actual | Materializar versión resuelta mediante acción explícita | Copia estable tras cambiar/archivar origen |
| Referencia ausente/archivada | No fabricar contenido | Bloquear conversión afectada, conservar original | Ausencia visible y cero pérdida silenciosa |
| Bloques funcionales | Mantener tipo y renderer | Snapshot registered validado | Acordeón/carrusel/acciones equivalentes |
| Áreas/columnas/placements | Mantener layout actual | Contenedores equivalentes con orden y visibilidad | Desktop/tablet/mobile y bloques sin ubicación |
| Template settings heredado | Mantener herencia | No conversión implícita a plantilla copiable | Edición antigua conserva semántica |
| Header/Footer y asignaciones | Mantener revisión y resolución actuales | Fuera de la migración de páginas | Regresión de preview, publicación y asignaciones |
| Página publicada | Mantener snapshot activo | Conversión sobre borrador explícito | Publicación anterior intacta hasta activar |

## Casos de aceptación y pruebas

| ID | Criterio | Prueba representativa requerida | Fase de ejecución funcional |
| --- | --- | --- | --- |
| A1 | Copia independiente | Crear, duplicar, cambiar nombre/contenido/CSS y releer ambos por BFF | 2 |
| A2 | Identidad íntegra | Duplicar nodos con links internos/ARIA/CSS; renderizar juntos sin colisiones | 2–3 |
| A3 | Contexto y permisos | Employee lectura/escritura, scope ajeno, locale y guardado rechazado | 2–5 |
| A4 | Media compartida segura | Copia mantiene asset; cambiar imagen solo afecta copia; comprobar URL pública | 2 |
| A5 | Espacios anidados | Crear árbol, mover nodos, rechazar ciclo, guardar y reabrir por BFF | 3 |
| A6 | Responsive y CSS | Misma pieza en contenedores de distintos anchos; 1440/768/390; sin fuga CSS | 2–4 |
| A7 | Página coherente | Ordenar secciones, guardar, reabrir y comparar preview con Storefront publicado | 4 |
| A8 | Conflicto/publicación | Dos editores; segundo guardado obsoleto rechazado; fallo no reemplaza activo | 2–4 |
| A9 | Plantilla independiente | Aplicar, editar/archivar origen y releer página sin cambios | 5 |
| A10 | Compatibilidad | Cada fila de la matriz, equivalencia antes/después y conservación de publicación | 6 |
| A11 | Fallos de edición | JSON inválido, upload pendiente, cambio de documento y timeout sin duplicación | 2–4 |

Estas pruebas futuras no se declaran ejecutadas. Fixtures sirven para negativos y
unidad, nunca sustituyen persistencia/reapertura real. Se necesita BFF/CMS operativo,
Employee con permisos, scope de ensayo y Media público antes de mutaciones E2E.

## Criterios de cierre de Fase 1

| Entregable original | Evidencia actual | Estado |
| --- | --- | --- |
| Contratos propuestos | Modelo, operaciones y gaps en este documento | Preparado; pendiente de acuerdo |
| Semántica de copia | Diez reglas de identidad/propiedad | Preparada; pendiente de aprobación |
| Identidad/contexto/Media/CSS | Reglas y límites explícitos | Pendiente de validación BFF/CMS |
| Guardado/conflictos/publicación | Recibo, concurrencia y snapshot | Propuesto; mecanismo real pendiente |
| Matriz de compatibilidad | Nueve clases de documentos | Preparada; no certifica conversiones |
| Casos de aceptación | A1–A11 y fases de prueba | Preparados; pendientes de acuerdo |

Para certificar la fase: aprobar decisiones D1–D4; contrastar transporte, schemas,
límites, permisos, concurrencia, Media y publicación con BFF/CMS; registrar contratos
aceptados y resolución de gaps sin implementar fases siguientes. Las pruebas de
construcción/migración se ejecutarán en sus fases, no son certificables por diseño.

## Decisiones que requieren aprobación

- D1: insertar módulos/secciones/plantillas por copia materializada; biblioteca
  shop-scoped existente y contenido copiado al locale destino; sin vínculos vivos nuevos.
- D2: módulo visual o funcional tipado; sección como árbol; página como lista de
  secciones; plantillas copiables distintas de settings heredables existentes.
- D3: concurrencia técnica oculta, guardado coherente y publicación del snapshot
  confirmado; CSS acotado con hoja avanzada prevaleciendo en su propio ámbito.
- D4: acceso backend/frontend autorizado expresamente por el usuario el 2026-11-20.
  Se ejecutó contraste de código y pruebas existentes. La conversión automática
  sigue excluida; la autorización no sustituye el acuerdo de las decisiones D1–D3
  ni permite iniciar Fase 2 sin su autorización específica.

## Comprobaciones ejecutadas y limitaciones

`node --test tests/cms-*.test.mjs`: 36 pruebas, 35 PASS, 1 FAIL. Falla
`cms block builder exposes the first interactive builder surface`, en
tests/cms-admin.test.mjs:266, porque exige /Biblioteca visual/ en el código fuente
de página. Reproduce el resultado de la auditoría previa; no se modificó la prueba.
Clasificación B: relacionado, no bloquea redactar contratos; no acredita regresión
funcional ni permite afirmar suite verde. Salida local: /tmp/cms-phase1-tests.log.

No se ejecutaron lint/build: cambio exclusivamente documental. No se ejecutaron
E2E, integración BFF/CMS, escrituras Media ni publicación. Conexión local ausente
y contratos nuevos no acordados impiden certificar integración. Los fallos de
guardado detectados antes se registran en A11 para la fase que los requiere; no
se corrigen durante esta fase. No se crearon tareas paralelas.

Siguiente paso: revisión de D1–D4 y contraste autorizado; después completar y
presentar certificación de Fase 1. Fase 2 requiere otra autorización expresa.


## Contraste backend autorizado — 2026-11-20

Raíz examinada: `/Users/ricardoperez/Documents/ecommium/composable_ecommerce`.
Se consultaron AGENTS.md, referencias CMS del roadmap/índice ADR/contratos y las
implementaciones siguientes. No se ha declarado una decisión arquitectónica
aceptada ni se ha cambiado el contrato HTTP vigente.

| Hecho confirmado en código backend | Fuente relativa a esa raíz | Consecuencia para la propuesta |
| --- | --- | --- |
| Biblioteca shop-scoped con module JSON, schemaVersion y revision | services/cms/prisma/schema.prisma, modelo CmsVisualModuleDefinition | Reutilizar almacenamiento visual; registered no está acreditado como payload de biblioteca |
| Referencias solo resuelven definiciones ACTIVE; ausentes se omiten | services/cms/src/application/use-cases/pages/visual-module-reference.resolver.ts | Copia independiente exige materialización explícita; conservar lectura legacy |
| Guardar borrador rechaza página PUBLISHED y crea versión incremental; no recibe expectedVersion | services/cms/src/application/use-cases/pages/update-draft/page.update-draft.use-case.ts | Añadir concurrencia y edición de borrador con activo conservado es un cambio real de fase 4 |
| Publish admite versionId opcional | services/cms/src/application/use-cases/pages/publish/page.publish.use-case.ts; apps/bff/src/shared/cms-client/domain/models/cms-client.models.ts | Reutilizar el selector existente; falta vincularlo a concurrencia y composición completa |
| Publicación llama Routing/SEO, guarda versión, página y outbox en pasos separados | services/cms/src/application/use-cases/pages/publish/page.publish.use-case.ts | No hay garantía transaccional conjunta demostrada. No prometer atomicidad distribuida; diseñar consistencia local y recuperación de integración |
| Persistencia usa upserts separados de página y versión | services/cms/src/infrastructure/repositories/prisma.cms.repository.ts | Requiere operación atómica del documento para el comportamiento aprobado |
| Blocks versionados y settings por página son almacenamientos separados | services/cms/prisma/schema.prisma, CmsPageVersion y CmsPageSettings | El snapshot nuevo debe abarcar composición y estilos; el modelo actual no basta |
| Biblioteca exige cms.pages.read y cms.pages.write, incluida activación | apps/bff/src/modules/cms/presentation/http/cms-admin-visual-modules.controller.ts | Reutilizar estos permisos; no inventar permisos por los nombres de pantalla |
| Visual v2 limita 24 paneles, 120 elementos, profundidad 8, 40 campos y 40 assets | apps/bff/src/modules/cms/application/validators/cms-visual-module-payload.validator.ts | Conservar límites de módulos; límites del árbol de secciones se acuerdan aparte |
| Hoja CSS limita JSON.stringify a 131072 caracteres, 128 reglas/scope y selector de 256 caracteres | services/cms/src/domain/layout/cms-style-sheet.value-object.ts | Reutilizar límites y validador; no confundir longitud JS con bytes HTTP |

Corrección del diagnóstico anterior: el backend ya permite elegir versionId al
publicar. El gap está en usarlo desde el nuevo flujo con comprobación de concurrencia,
composición íntegra y preservación de publicación anterior. Actualmente el rechazo
a editar PUBLISHED impide el flujo de borrador paralelo propuesto; no es solo UI.

La atomicidad propuesta se refiere al estado propio de CMS. Routing/SEO es otro
owner y no debe incluirse en una transacción de base de datos compartida. Antes de
fase 4 se definirá con los puertos existentes qué ocurre si falla esa integración,
cómo se recupera y cuándo el recibo acredita publicación pública. No se crea un
servicio adicional para resolverlo.

Pruebas ejecutadas contra código existente (sin modificarlo):

- CMS: cuatro suites, **18/18 PASS**: update-draft, publish, get-published y
  prisma.cms.repository. Comando desde services/cms:
  `npm test -- --runInBand src/application/use-cases/pages/update-draft/page.update-draft.use-case.spec.ts src/application/use-cases/pages/publish/page.publish.use-case.spec.ts src/application/use-cases/pages/get-published/page.get-published.use-case.spec.ts src/infrastructure/repositories/prisma.cms.repository.spec.ts`.
- BFF: tres suites, **16/16 PASS**: controladores CMS/piezas visuales y cliente CMS.
  Comando desde apps/bff:
  `npm test -- --runInBand src/modules/cms/presentation/http/cms-admin-visual-modules.controller.spec.ts src/modules/cms/presentation/http/cms-admin.controller.spec.ts src/shared/cms-client/infrastructure/api-v1/cms-client.api-v1.spec.ts`.
- Salidas locales: /tmp/cms-phase1-backend-tests.log y /tmp/cms-phase1-bff-tests.log.

Estas suites usan dobles de puertos/repositorios; PrismaCmsRepository se prueba
con FakeCmsPrismaClient. No acreditan PostgreSQL real, transacciones concurrentes,
HTTP autenticado end-to-end ni persistencia Media. No se sustituyen las pruebas
reales futuras por estos resultados.

Estado: VERIFICACIÓN PARCIAL. Acceso backend/frontend autorizado; D1–D3 continúan
como propuestas pendientes de aprobación expresa. Quedan por cerrar el schema
exacto del árbol y su límite global, integración Media pública, semántica de
reintentos/concurrencia y recuperación de publicación. La Fase 1 no se certifica
ni se inicia la Fase 2 con esta evidencia parcial.


## Aprobación y sincronización — 2026-11-20

El usuario aprobó expresamente D1–D3 después del contraste backend. Esta entrada
sustituye el estado anterior de aprobación pendiente, sin convertir propuestas
no comprobadas en capacidades existentes. ADR-0324 y contrato61 del backend
registran el acuerdo; índice ADR, backlog y plan enlazados. Contratos HTTP sin cambios.

Se constató que Media Admin resuelve getAssetById por ReadIndex con tenant explícito;
por tanto, no es necesario inventar un endpoint de propiedad a partir del DTO del
cliente Media. Falta probar ese recorrido con datos autorizados reales. No se amplía
el trabajo a cambiar Media ni ReadIndex.

Concurrencia: concretar expectedRevision en escrituras y revisionToken opaco en
recibos, con CAS atómico en CMS. Guardado local con token fallido no reintenta ni
sobrescribe; muestra conflicto y preserva edición. No es historial de versiones UX.
Este protocolo es especificación, no un endpoint implementado.

Bloqueo delimitado para certificar la fase: no están cerrados los DTOs/rutas exactos
de persistencia de secciones/plantillas, presupuesto agregado de árbol y mecanismo
persistido de reintento/recuperación de publicación. Deben fijarse y verificarse
antes de declarar Fase 1 terminada. No se desplazan a Fase 2 para simular cierre.
La aprobación D1–D3 no requiere volver a solicitarse.


El contrato61 incorpora ahora rutas y DTOs lógicos candidatos, identidad de operación,
CAS, presupuesto agregado y secuencia de publicación. Son propuestas técnicas para
validación, no nuevos endpoints activos ni cambios de alcance. El bloqueo documental
de falta de propuesta queda resuelto; permanece la verificación del presupuesto,
schemas de borde y garantía de idempotencia del puerto Routing/SEO antes de congelarlas.


## Validación adicional — 2026-11-20

Artefactos nuevos de especificación, sin conexión a rutas productivas:
- `cms-composition-boundary.schema.json`: envolturas de borrador/recibo, árbol,
  discriminadores, campos estructurales cerrados y scopes CSS.
- `tests/contracts/cms-phase-1-boundary.test.mjs`: presupuesto global, profundidad,
  IDs, referencias vivas, UTF-8 y rechazo estructural.

Comando: `node --test tests/contracts/cms-phase-1-boundary.test.mjs`: **6/6 PASS**.
Casos: petición/recibo separados; campos obligatorios; 24/25 secciones; 120/121 nodos
sumados entre secciones; profundidad8/9 contando raíz; IDs repetidos; referencia viva;
1048576 bytes exactos y exceso multibyte; campos/versión estructural desconocidos.
`npx eslint tests/contracts/cms-phase-1-boundary.test.mjs`: PASS.
Ajv6.15.0 ya instalado transitivamente; no se añadió dependencia. Antes de convertir
esta prueba en gate de CI deberá declararse la dependencia de test explícitamente.

Límite importante: el schema es ESTRUCTURAL. Los cuerpos de módulos y presentación
se delegan al schema/validador semántico de su tipo. No certifica props funcionales,
CSS seguro por sí solo, autorización, CAS, Media ni integridad de IDs dentro de la
pieza. Esas obligaciones no se omiten del contrato ni se declaran cubiertas por Ajv.
La prueba de1MiB comprueba transporte/medición; no rendimiento de renderizado.

Se ejecutaron también:
- CMS: visual-module.value-object, cms-style-sheet y http.cms-routing-seo.publisher:
  **3 suites /45 PASS**. `/tmp/cms-phase1-final-domain.log`.
- BFF: cms-site-part-composition.validator y cms-admin-visual-modules.controller:
  **2 suites /10 PASS**. `/tmp/cms-phase1-final-bff.log`.
No sumar como tests únicos a ejecuciones previas: hay cobertura repetida.

Routing/SEO: PrismaRoutingRepository.findCanonicalRouteByEntity filtra ACTIVE.
HttpCmsRoutingSeoPublisher reutiliza esa ruta cuando el path coincide. La suite
prueba ese caso con fetch simulado. No demuestra creación concurrente ni reintento
tras fallo real. Cambiar path queda en el flujo dedicado existente, fuera del
commit de composición; el contrato nuevo no debe mover una ruta activa antes de
confirmar contenido. No se modificó Routing/SEO.

Conectividad repetida: BFF Admin3026 y CMS3017 HTTP000. La prueba E2E existente
`scripts/cms-e2e.mjs` requiere bearer Employee y scope explícito, crea/publica/cambia
path/despublica. Sus defaults sintéticos no identifican un tenant de ensayo válido.
Arrancar CMS con Prisma habilita relay outbox por defecto; no debe tratarse como
lectura sin efectos del entorno configurado. Ningún arranque o mutación ejecutados.

Estado permanece VERIFICACIÓN PARCIAL: falta validación semántica completa de los
nuevos mensajes y ensayo representativo de composición/recuperación con entorno y
scope de prueba identificados. No se certifica funcionamiento nuevo ni se inicia Fase2.
