# Catálogo: cajas del editor de producto — 2026-11-06

La pestaña básica se organiza en Datos principales (abierta), Categoría y marca / proveedor, Características y especificaciones y Precio base (cerradas inicialmente). Resumen y descripción conservan su editor visual y muestran el código HTML solo al solicitarlo. Referencia / SKU identifica el código interno de la variante predeterminada.

Los botones + abren el drawer compartido con los mismos campos de creación usados en los listados de categorías y marcas. La validación server-side conserva los contratos distintos de ambas entidades; la creación pasa únicamente por el cliente Admin del BFF, respeta el contexto y asigna el registro devuelto. Los botones y acciones comprueban el permiso de escritura específico desde la sesión Admin vigente.

Se elimina el banner y la preparación previa de activación. Guardar abre un diálogo con los requisitos de portada persistida, precio positivo y stock disponible del validador existente. Si falta alguno, ofrece continuar editando o guardar borrador. Si están completos, permite publicar o guardar borrador. El payload del borrador lleva isActive=false; publicar solicita isActive=true e isVisible=true. La validación final permanece en el BFF. Cambiar entre publicar y borrador utiliza una nueva clave de idempotencia, mientras los reintentos del mismo modo conservan su clave.

## Comprobaciones

- `npm run build`: PASS.
- `npm run lint`: sin errores; tres advertencias preexistentes en customers-admin-actions.ts, request-client.ts e invoice-document-pdf.ts.
- `node --test tests/product-editor.test.mjs tests/admin-create-contracts.test.mjs tests/category-list-actions.test.mjs`: 47 PASS.
- `npx playwright test tests/e2e/admin-login.spec.ts --grep 'product editor|product basic|product preview|product taxonomy|category list creates|brand list creates' --reporter=line`: 31 PASS. Se actualizan los recorridos previos para abrir las nuevas cajas y elegir explícitamente el modo de guardado.
- Playwright comprueba HTML cerrado/abierto, creación y asignación de ambas entidades, permisos vigentes, popup incompleto, payload de borrador, publicación completa, reintentos/idempotencia, media, restauración local y preview.
- Accesibilidad acotada: foco inicial del drawer, recorrido circular con Shift+Tab, Escape en el diálogo de guardado y restitución de foco. No equivale a una auditoría axe completa.
- Capturas revisadas en `docs/qa/evidence/20261106/`: escritorio 1440, tablet 768, móvil 390, ambos drawers y ambos estados del diálogo de guardado.

El sandbox impidió abrir los puertos locales (EPERM); las pruebas de navegador se ejecutaron con la escalación autorizada. El primer pase de regresión detectó un test que esperaba el textarea HTML siempre visible; se adaptó al botón explícito y el pase posterior completo quedó en verde. La revisión visual detectó un checkbox que heredaba dimensiones de campos del selector; el drawer se separó de ese contenedor y la regresión verifica su tamaño.

No se accedió ni modificó el repositorio backend. Los recorridos de navegador usan el BFF simulado de la suite; no certifican integración contra servicios reales. No se ejecutaron Lighthouse, budgets ni auditoría axe completa. No se modificaron contratos BFF ni estados del backlog de seguridad.

## Barra de acciones compacta

Se sustituye el bloque de badges y botones por estado + texto de guardado, Vista previa, Guardar y un menú ⋯. El detalle por bloque se conserva exclusivamente en Auditoría. Volver al catálogo se mueve al encabezado. La vista local ofrece Ver en tienda para productos persistidos. Duplicar, Crear otro producto y Desactivar se agrupan en un popover nativo con cierre por Escape/clic exterior. Desactivar mantiene una confirmación explícita antes de enviar el formulario existente al BFF; cancelar no envía PATCH. La capa de guardado deja de enumerar detalles técnicos.

Validación adicional:

- Build PASS; lint sin errores y con las mismas tres advertencias preexistentes.
- Regresión Node 47 PASS.
- Regresión Playwright: 29 recorridos de editor/preview/taxonomía PASS; prueba nueva de barra y menú PASS. Se adaptan las expectativas de estados técnicos para consultarlos en Auditoría y el nombre del botón a Guardar. El primer selector de prueba asumía erróneamente un landmark contentinfo dentro de main; la barra queda como grupo accesible con nombre y su prueba pasa.
- Capturas de la barra a 1440, 768 y 390 px revisadas: `product-footer-*.png`; acciones caben sin desbordarse. Menú: `product-footer-menu.png`. El test comprueba la cancelación de desactivación, las URLs de duplicación/creación y el acceso a la vista de tienda dentro de Vista previa.
- Se conserva el alcance de BFF simulado y las exclusiones de integración real, Lighthouse y axe completo indicadas arriba.

## Guardado de productos activos y concepto de borrador

Corrección autorizada tras analizar el contrato vigente:

- El editor mantiene por separado la activación y visibilidad confirmadas por BFF. Restaurar una copia local antigua no cambia ese estado confirmado.
- Guardar un producto activo ejecuta Guardar cambios conservando isActive=true y la visibilidad existente, incluso cuando isVisible=false. No ofrece Guardar borrador ni solicita desactivarlo.
- Si el borrador de edición de un activo incumple portada, precio o stock, aparece un diálogo con los pendientes y Seguir editando. No se envía la operación de guardado; no se cambia la activación local. La acción explícita Desactivar conserva su confirmación y contrato anterior.
- Nuevos e inactivos mantienen la elección Guardar borrador/Publicar. Activación confirmada por draftPatch.basic o por éxito del bloque publish actualiza el modo del editor; una intención local de publicar no basta.
- Etiquetas compartidas: Borrador para uno nuevo sin identidad persistida, Sin publicar para persistidos inactivos y Activo para activación confirmada. El listado y la vista previa usan las mismas etiquetas; no deducen un ciclo de publicación completo a partir de stock o visibilidad.
- Cambios sin guardar continúa siendo un estado independiente.

Validación: build PASS; lint sin errores, mismas tres advertencias preexistentes; suite Node 48 PASS; regresión Playwright 33 PASS. Los cuatro casos de publicación/activo se verificaron de nuevo incluyendo recuperación de copias locales con isActive=false y visibilidad invertida:4 PASS. Las solicitudes capturadas conservan ambos flags BFF en activos visibles y ocultos. El caso sin portada no envía ninguna operación. Captura: `product-active-save-blocked.png`. BFF simulado; no se certifica despliegue ni integración real. No se han ejecutado Lighthouse/axe completo.

### Gap BFF pendiente de sincronización futura

Los contratos locales no acreditan una distinción persistente DRAFT/PUBLISHED/UNPUBLISHED ni revisiones privadas de productos ya publicados. Propuesta para sincronizar, no implementada: publicationStatus explícito en listado/editor-state y transiciones BFF validadas para publicar y retirar de publicación, conservando isVisible como dimensión independiente. Si se necesitan cambios privados sobre un producto publicado, el BFF debe proporcionar identidad/versionado del borrador y publicación de esa revisión con control de concurrencia. No se crean flags persistidos en navegador, endpoints Next alternativos ni cambios en backend para simular estas capacidades.
