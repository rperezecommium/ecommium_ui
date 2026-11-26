# Secciones: identificación visual de áreas — 2026-11-22

CmsSectionPreview reutiliza CmsSectionView sin modificar el renderer público.
La selección en el árbol marca la envoltura real en preview y abre estilos del
contenedor seleccionado. Seleccionar área permite elegir por clic/táctil: busca
el ancestro de sección reconocido más cercano y sincroniza la fila del árbol.
Nunca ofrece seleccionar nodos internos del módulo. Mostrar límites distingue
los contenedores/envolturas; selección y hover usan outlines sin bordes guardados.
Áreas vacías reciben altura mínima solo en ayudas del editor para poder elegirlas.
Escape cancela el selector. Edición de copia/guardado/subida/conflicto bloquean
el selector visual para conservar el borrador. Árbol sigue siendo alternativa
accesible con botones; la preview no necesita convertir cada div en un botón.

Referencias legibles: Contenedor principal y rutas de contenedores, o nombre del
módulo. CSS utiliza data-cms-node-id ya existente, estable frente a movimientos y
remapeado por copia según contrato existente. El helper filtra IDs fuera de la
gramática antes de generar selectores; nombres no se interpolan en CSS. El editor
CSS sección sustituye ejemplos genéricos de cabecera por referencia seleccionada,
Copiar selector e Insertar regla para esta área. Regla vacía preparada queda como
borrador inválido y bloquea Guardar hasta completar CSS; no se sobrescribe CSS
inválido anterior ni se duplica una regla ya existente del selector en el scope.
El contenido base/desktop/tablet/mobile conserva el parser y sanitización previos.

Preview intercepta clics/submits para no seguir enlaces ni ejecutar formularios;
el guard de navegación del formulario excluye enlaces dentro de esta preview.
Las marcas de selección/límites son atributos DOM locales, no parte del documento
ni de payloads BFF. No se añaden endpoints, almacenamiento ni permisos nuevos.

La regresión reveló pérdida de la primera entrada en Secciones: onInputCapture
marcaba rawDirty provocando un render antes de leer el valor en onChange del
campo. Se cambia a onChange en burbuja, después del control. La prueba inserta una
regla, intenta guardarla vacía, completa la primera edición y verifica el borde
renderizado. Cambio acotado a este formulario; no modifica autenticación.

Verificación:20 pruebas de helpers/renderer, Chromium1440/768/390 con CSP real y
densidad adminShell: selector estable, portapapeles, regla incompleta bloqueada,
borde2px solo en destino, límites, selección árbol→preview y preview→árbol,
Escape, aislamiento entre copias y regresiones previas de drag/drop ratón/táctil,
CSS/errores/lectura. Axe de áreas probadas conserva exclusión de contraste y
limitación global de regiones duplicadas del preview documentada anteriormente.
Build y lint correctos (tres avisos previos).

Pruebas de acciones con dobles: no se guardaron ni publicaron recursos reales en
esta entrega ni se certifica persistencia BFF de una regla nueva. No se cierran
hallazgos de securityReadme.md. Límites de permisos/scope anteriores permanecen.
