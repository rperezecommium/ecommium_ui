# Fase 2 — evaluación previa y decisiones aprobadas

Fecha: 2026-11-20. Ejecución de Fase 2 autorizada por Ricardo.
Estado actual: IMPLEMENTADA CON VERIFICACIÓN PARCIAL. Navegación, ajustes
contractuales y extensión acotada ReadIndex aprobados expresamente por Ricardo.
Activada tras autorización; Media real verificada, certificación integral pendiente.
No certificada. La evaluación siguiente conserva la evidencia previa; avance y
pruebas actuales en [informe de Fase2](../qa/cms-phase-2-implementation-20261120.md).

## Alcance y reutilización comprobados

Constructor independiente para módulos visuales y los ocho tipos funcionales
del contrato aprobado. Crear, editar, copiar, renombrar y archivar; sin gestión
visible de versiones. No implementar secciones, páginas ni plantillas.

UI reutilizable:
- `src/modules/cms/cms-visual-editing-panel.tsx`: árbol, inspector y subida Media,
  con señal `onBusyChange` para impedir guardar durante la subida.
- `src/modules/cms/cms-visual-editor.tsx`: controles y operaciones visuales.
  `cloneVisualBuilderNode` cambia nodeId pero no remapea referencias; no satisface
  por sí solo el contrato de copia independiente.
- `cms-editor-history.ts`, `cms-block-style-sheet-editor.tsx` y renderer compartido
  `packages/cms-blocks/src/react.tsx`: historial local, CSS y presentación.
- Biblioteca Headers/Footers como patrón de navegación Biblioteca/Diseño,
  conservando el estándar Compacta al implementar su listado.

Backend comprobado en composable_ecommerce:
- Familia existente `admin/cms/visual-modules`, controllers CMS/BFF y use cases
  de creación, lectura, edición de draft, revisiones, activación y archivo.
- `CmsVisualModuleDefinition` y repositorio Prisma: solo cuerpo visual v2;
  edición restringida a DRAFT y guardado con upsert sin CAS.
- Contrato61/ADR0324 prevén discriminante contractVersion1, cuerpos registrados,
  CAS y operación persistida. Estas garantías todavía necesitan implementación;
  no basta ocultar revisiones en la UI.

## Carencias comprobadas del contrato aprobado

### Referencias accesibles e identidad (A2)

La regla7 exige remapear referencias ARIA e IDs DOM. `visualProps` del schema
cerrado solo admite ariaLabel, no referencias ARIA. El renderer actual emite
aria-label y data-cms-node-id, sin id DOM ni aria-labelledby/aria-describedby.
Por tanto la aceptación A2 no está completamente representada por el contrato.

Ajuste aprobado: permitir `ariaLabelledBy` y `ariaDescribedBy` como listas de
IDs locales separadas por espacios, validar que resuelvan dentro de la pieza,
remapearlas estructuralmente al copiar y derivar IDs DOM de la identidad del
módulo y del elemento. Los fragmentos href locales se resuelven mediante ese
mismo mapa. No introducir HTML/JavaScript arbitrario ni modificar textos o URLs
externas por coincidencia. Mantener sin conversión los documentos legacy.

Prueba requerida: dos copias simultáneas, destinos DOM existentes, referencias
ARIA y fragmentos locales correctos, origen intacto y rechazo de destinos ajenos.

### Archivado del contrato nuevo

moduleReceipt cerrado contiene resourceId/revisionToken/context/document, pero
ningún estado. La ruta archive actual devuelve el DTO legacy, cuyo campo module
exige visual v2: no representa el cuerpo registered del nuevo contrato.

Reproducción con Ajv sobre definitions/moduleReceipt: recibo MODULE con acordeón
válido aceptado; el mismo recibo con status ARCHIVED rechazado por
additionalProperties. No es un fallo de Ajv ni de permisos.

Ajuste aprobado: añadir al recibo nuevo `status: DRAFT | ARCHIVED`, conservar
ACTIVE/revisiones solo en DTO legacy y definir archive nuevo con
`contractVersion: 1`, `resourceKind: MODULE`, `expectedRevision`. Archivo usa CAS,
devuelve recibo canónico con nuevo token y no borra Media. GET/listado del contrato
nuevo usan el mismo recibo; filtros mantienen el estado explícito. Reintento con
token obsoleto devuelve409 y se recupera por GET. No añadir endpoints alternativos.

Prueba requerida: archivo visual y registrado, aislamiento de contexto, rechazo
de edición/archivo obsoleto, persistencia tras reapertura y origen/copias intactos.

Estas propuestas completan requisitos existentes, pero modifican el schema que
se declaró cerrado en Fase1. Fueron aprobadas expresamente por Ricardo tras esta evaluación. El cierre previo de Fase1 no demuestra estas capacidades.

## Decisión de navegación presentada

Decisión aprobada: entrada Módulos en CMS, Biblioteca/Diseño, manteniendo Builder actual
durante la transición. No se sustituye la entrada Builder en esta fase.

## Secuencia verificable tras resolver decisiones

1. Corregir contrato/schema y sincronizar referencia backend/UI; negativos ARIA,
   archivo, campos desconocidos y compatibilidad legacy.
2. Implementar validación y persistencia CMS de MODULE, CAS y recibo de creación
   idempotente atómicos. Pruebas PostgreSQL aislado de concurrencia/reapertura,
   replay mismo payload y409 distinto payload. Ninguna migración remota implícita.
3. Adaptar BFF existente, validación de Employee/contexto/Media antes de mutación
   y replay; comprobar contratos HTTP y permisos reales.
4. Conectar biblioteca/editor independiente a esos contratos verificados,
   reutilizando controles/renderer y añadiendo copia materializada; pruebas de
   JSON inválido, upload pendiente, navegación con cambios y timeout ambiguo.
5. E2E UI→BFF→CMS, Media real y1440/768/390; lint/build, regresión legacy y
   contraste preview/renderer. Certificar únicamente con evidencia ejecutada.

## Evidencia histórica de la preparación, antes de implementar

`npm run test:cms-contracts`:19/19PASS. Son pruebas de especificación y
normalizadores actuales; no prueban el nuevo editor, CAS, BFF autenticado ni Media
real. Reproducciones Ajv anteriores realizadas directamente sobre schema vigente.
No se han modificado código productivo, datos, esquema Prisma ni navegación.
No se ha ejecutado lint/build/E2E en esta preparación documental.

## Criterios originales en la evaluación inicial

A1 copia, A2 identidad, A3 permisos, A4 Media, A6 responsive/CSS, A8 conflictos
y A11 fallos de edición: pendientes de implementación y validación de Fase2.
A5/A7/A9 pertenecen a fases posteriores; A10 conservará la matriz legacy y su
certificación final de migración. No se reduce ni se da por satisfecho ningún
criterio con los19 tests de definición.


2026-11-20 — Extensión Media sin producto autorizada y activada. Multipart omite
productId; respuesta nullable explícita. Productos conservan UUID/uniquidad.
Subida, copia compartida, sustitución independiente y URLs200 verificadas por
Employee/UI, SQL y HTTP. Sustituye el bloqueo Media anterior. Fase2 continúa
VERIFICACIÓN PARCIAL. Ver [informe y pendientes](../qa/cms-phase-2-implementation-20261120.md).
