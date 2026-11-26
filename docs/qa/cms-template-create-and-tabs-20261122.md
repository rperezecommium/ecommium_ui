# Plantillas y pestañas CMS · 2026-11-22

## Resultado

- «Crear nueva plantilla» es un enlace subrayado a la derecha de los badges Disponibles/Archivadas, centrado en la misma fila. El formulario se despliega debajo sin abrir una ventana flotante.
- El formulario pide nombre y tipo (Sección o Página), crea una plantilla vacía mediante la acción y el contrato BFF existentes y abre su editor. No crea una sección o página independiente.
- Solo aparece con permiso de escritura; mantiene las comprobaciones de empleado, contexto y validación del contrato de la acción existente.
- Durante la creación muestra «Creando…». Ante una respuesta incierta conserva el comando y su operationId para reintentar la misma operación, evitando crear una segunda plantilla por un reintento.
- Las pestañas CMS usan las clases compartidas de badges: navegación de páginas, ajustes, headers/footers, biblioteca/diseño de módulos y secciones, estado de plantillas, pasos del compositor y selectores de dispositivo, superficie y ámbito CSS. Los botones de acciones conservan su función y presentación.

## Comprobaciones

- `node --test tests/cms-template-create.test.mjs tests/cms-unified-builder.test.mjs tests/cms-section-tree-controls.test.mjs tests/cms-composition-template-copy.test.mjs`: 25 pruebas correctas. Incluye validación de las dos variantes de plantilla contra el schema local `templateCreate`.
- `node tests/e2e/cms-template-create-browser.mjs`: correcto a 1440, 768 y 390 px. Comprueba alineación del enlace, creación de ambos tipos, navegación al editor, reintento idéntico, ausencia de la acción sin permisos, ausencia de desbordamiento y axe (contraste excluido).
- Regresiones de módulos y secciones: correctas a 1440, 768 y 390 px.
- `node tests/e2e/cms-page-composition-browser.mjs` y `node tests/e2e/cms-unified-builder-browser.mjs`: correctos en sus tres casos responsive, sin escrituras CMS reales.
- Lint sin errores; permanecen tres avisos anteriores fuera de CMS. Build correcto.

Las pruebas de navegador usan acciones simuladas; no certifican la disponibilidad del BFF ni crean datos de negocio reales.
