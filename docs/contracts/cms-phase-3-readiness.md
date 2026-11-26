# CMS — Fase 3: evaluación acotada de viabilidad

Fecha: 2026-11-20. Usuario autoriza avanzar a Fase3 tras el informe de Fase2.
Estado actualizado: IMPLEMENTADO CON VERIFICACIÓN PARCIAL. Fase2 mantiene VERIFICACIÓN
PARCIAL: esta autorización no certifica sus pruebas pendientes.

## Alcance aprobado

Constructor de secciones: árbol de contenedores stack/flex/grid, orden de hijos,
inserción de copias de módulos terminados, presentación responsive y CSS propios.
Crear, editar, guardar y reabrir SECTION con Organization/Shop/locale explícitos.
No simplificar Páginas, publicar composiciones ni construir plantillas en esta fase.

Fuente normativa: `cms-composition-boundary.schema.json`, definiciones node,
section, sectionCreate, sectionUpdate y sectionReceipt; contrato61 del backend.
Rutas ya previstas: GET/POST /admin/cms/sections y GET/PATCH /:sectionId.
Estos contratos documentados no implican endpoints operativos.

## Evidencia y reutilización

- `src/modules/cms/cms-independent-modules.ts`: cliente BFF, validación de recibos
  y contexto; reutilizar su patrón, añadiendo locale requerido para secciones.
- `cms-module-builder-client.tsx`, `cms-visual-editing-panel.tsx` y
  `cms-block-style-sheet-editor.tsx`: editor de piezas y controles existentes.
  No permitir que el árbol estructural modifique internamente una pieza.
- `packages/cms-blocks/src/react.tsx`: renderizador compartido de módulos.
  El nuevo renderizado de wrappers debe impedir CSS de sección dentro del módulo.
- CMS: independent-module-copy, value-object, repository y use-case existentes
  proporcionan copia de identidades, validación e idempotencia/CAS reutilizables.
  El schema Prisma inspeccionado no contiene persistencia SECTION.
- ReadIndex: `prisma-admin-cms-read.repository.ts` lee independentModules y
  rechaza snapshots sin esa colección. No representa SECTION. Las lecturas nuevas
  necesitan proyección y consultas de sección, sin consultas directas UI→CMS.
- Pruebas contractuales de Fase1 contienen límites y semántica de árboles;
  son especificación, no evidencia de persistencia SECTION ni de interfaz.

## Decisiones aprobadas por el usuario

1. UX: proponer CMS → Secciones, Biblioteca/Diseño, siguiendo Módulos. Diseño
   contiene árbol, inspector de contenedor y selección de módulos existentes.
   Insertar materializa copia; editar la pieza confirma cambios en el borrador
   de la sección, sin modificar su origen. No añadir versionado visible.
2. Autorizar extensión acotada de ReadIndex para SECTION: proyección, listado y
   detalle por Organization/Shop/locale. La autorización previa era para MODULE.
   Mantener el mecanismo de eventos y snapshots existente.

Justificación de persistencia: SECTION es un recurso autónomo aprobado y no cabe
en HEADER/FOOTER ni en templates de settings. Concretar la migración mínima en
CMS tras revisar sus instrucciones y repositorios; no crear servicio ni almacén
alternativo. No aplicar migraciones durante esta evaluación.

## Secuencia y evidencia exigida

1. CMS: validación de árbol y copia, persistencia con operationId/hash/recibo y
   CAS. PostgreSQL desechable: reapertura, identidad, replay, conflicto y scope.
2. BFF y ReadIndex: permisos existentes cms.pages.read/write, locale, validación
   Media de descendientes y lectura proyectada. Integración HTTP real, eventos
   aplicados y prueba de aislamiento. No declarar PASS con dobles de servicios.
3. UI: biblioteca y editor, movimientos sin ciclos, copia independiente, guardado
   y conservación del borrador ante conflicto/timeout. Reutilizar controles,
   Compacta y renderer; verificar presupuestos antes de enviar y en owner.
4. E2E: crear árbol anidado, insertar dos copias, mover, impedir ciclo, guardar y
   reabrir; editar origen sin alterar sección. Probar 1440/768/390 y CSS aislado.
   Dos editores, locale ajeno y permisos; regresión Módulos y Builder legacy.

A5 es el criterio principal; A2/A3/A6/A8/A11 aplican al árbol. A7/publicación de
páginas corresponde a Fase4. Las pruebas de esta evaluación no sustituyen los
pendientes de Fase2. No hay certificación hasta ejecutar las pruebas reales.

Herramientas ya observadas en el trabajo de Fase2: Node/Jest, Prisma/PostgreSQL
desechable, BFF/CMS/ReadIndex locales y navegador con sesión Employee. Antes de
mutar se debe revalidar salud y destino de migraciones. Falta una sesión de prueba
de solo lectura/contexto ajeno verificada; no modificar permisos para simularla.

## Resultado de ejecución

El usuario aprobó ambas decisiones («aprobadas»). Implementados CMS→Secciones
y la extensión SECTION de ReadIndex, sin iniciar Fase4. La migración
20261120000300_independent_sections está aplicada en CMS; los procesos canónicos
fueron reiniciados y los snapshots actualizados después del reinicio.
La evaluación anterior se conserva como evidencia de preparación, no como estado
actual de las capacidades. Informe y aceptación: [Fase3](../qa/cms-phase-3-implementation-20261120.md).
Fase2 conserva su estado parcial; autorizar Fase3 no cierra sus pendientes.
