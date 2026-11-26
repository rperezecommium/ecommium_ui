# Contenido de copias de módulos en Secciones — 2026-11-22

CMS → Secciones → Diseño → seleccionar módulo → Editar copia del módulo
presenta primero Contenido para módulos visuales. Usa exclusivamente contentSchema
publicado por el diseñador; los bindings no publicados no generan controles.
Los valores iniciales conservan overrides/defaults y, si faltan, muestran el
texto/HTML/src del nodo de diseño. Editar actualiza contentValues de la copia,
sin alterar props/estilos/identidades de nodos ni la biblioteca. Aplicar a la
sección y Guardar conservan el flujo BFF existente; cancelar descarta el borrador.

El editor visual completo y CSS siguen disponibles en opciones Avanzado.
Sin campos publicados hay una explicación y acceso avanzado; no se inventan
bindings ni se migra el documento. Los módulos registrados mantienen sus campos.

Validación: 14 tests de cms-unified-builder; Playwright aislado con CSP de
producción a 1440/768/390: dos copias independientes, textos iniciales, dos campos,
aplicar/cancelar y preview, más regresiones existentes de mover/CSS/errores/permisos.
Axe del formulario sin violaciones, salvo contraste excluido por pendiente
transversal existente. Axe global con dos módulos visuales detecta landmark-unique
en los wrappers del preview: limitación preexistente fuera de esta superficie;
no se considera certificada la accesibilidad global de ese escenario.

No se guardaron ni publicaron recursos reales. Las acciones del navegador de
pruebas son dobles; persistencia autenticada BFF no certificada en esta entrega.
No cambia endpoints, permisos, sesión, seguridad de renderizado o contratos, ni
cierra hallazgos pendientes de securityReadme.md.

## Feedback de actividad

Carga paginada de biblioteca separada del guardado: modulesLoading deshabilita
solo selector/inserción/paginación y anuncia Cargando módulos; conserva la edición
y el botón Guardar. Error local de biblioteca permite reintentar sin perder datos.
Guardado anuncia Guardando sección y mantiene bloqueo/recibo/reintento existentes.
Subida anuncia Subiendo archivo. El formulario expone aria-busy para estas
operaciones bloqueantes. Escribir no inicia loading ni envío al servidor.
Aplicar a la sección informa de cambios pendientes de guardar; la nueva acción
Aplicar y seguir editando conserva abierto el editor y aplica el borrador actual.
Cancelar posterior descarta únicamente lo editado desde la última aplicación.

Regresión Playwright en 1440/768/390 verifica carga retrasada, selector bloqueado,
nombre de sección y Guardar habilitados durante lectura, error recuperable,
aplicar y continuar escribiendo. Suite de 14 pruebas, lint (0 errores/3 avisos
previos), build correctos. No acredita mejoras de latencia de tecleo ni persistencia
BFF real; conserva límites de accesibilidad y demás pendientes anteriores.

## Separación definitiva de diseño y uso — 2026-11-22

Esta entrada sustituye la disponibilidad de Avanzado descrita arriba.
Secciones mantiene diseño de sus contenedores (fondo/padding/display/layout,
CSS acotado de sección) y composición: insertar, ordenar, mover o retirar copias.
Al seleccionar una copia solo permite sus valores explícitos de contentSchema.
Se retiran nombre del módulo, árbol, bindings, Props, editor visual completo,
stylesheet y controles de presentación del módulo; no existen detrás de Avanzado.

CmsModuleInstanceFields es un formulario separado del diseñador. Su actualización
acepta únicamente claves declaradas y conserva nombre, IDs, árbol/paneles,
contentSchema, estilos, stylesheet y valores ajenos existentes. No normaliza ni
migra el diseño para escribir cada valor. Color y fondo se editan únicamente si
el diseñador los declara con sus bindings. Módulos → Diseño sigue disponible
para diseñar/clonar variantes; no se modifica desde Secciones.

Límite contractual: registered no declara campos expuestos por el creador en el
contrato local; por ello se conserva como snapshot sin campos editables en
Secciones. Se retira RegisteredFields de esta superficie. No se interpreta su
registro técnico como permiso del creador. Gap y propuesta acotada documentados
sin modificar el contrato BFF ni ampliar el repositorio backend.

Pruebas: 15 unitarias/renderer y Playwright a 1440/768/390 para ausencia de
controles de diseño, texto/fondo explícitamente expuestos, aislamiento entre
copias, aplicar/continuar/cancelar, módulos sin declaración, controles propios de
sección y regresiones anteriores. Conserva límites de BFF real y axe anteriores.

## Prueba real autorizada — 2026-11-22

Usuario pidió que QA pieza propia de seccion ·3 tuviera su zona editable.
En Módulos se guardó el recurso QA 434f1f41-cf12-454c-a968-18f6456c3559 con
nombre QA pieza propia de seccion, Heading etiquetado Título, binding titulo y
campo de texto declarado. Se observó Módulo guardado tras una espera prolongada
(no se atribuye causa al BFF; health UI200 y BFF401 sin sesión durante diagnóstico).

En QA Fase3 editor B (562f31ba-2fee-4d5d-96c4-101b93bbd5a6) se insertó copia
nueva dentro del contenedor existente y se retiró del borrador la copia antigua
sin campos. No se alteró el diseño desde Secciones. Campos editables mostró solo
Título, sin árbol/bindings/Props/CSS del módulo. Se escribió «Título editable
desde la sección», se aplicó y se guardó: Sección guardada. Recarga completa
confirmó el texto en preview y reapertura del editor confirmó Título persistido.
Se dejó abierto el formulario en Chrome. Sin publicación de páginas ni cambios
sobre otras secciones. Esta prueba acredita persistencia autenticada de este
recorrido QA; no sustituye pendientes de permisos read-only, otros scopes o
accesibilidad global descritos anteriormente.
