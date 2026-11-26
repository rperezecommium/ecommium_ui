# Limpieza del diseño de Headers/Footers — 2026-11-19

Se aplica la captura SCR-20261119-schr.png:

- Nombre de la pieza debajo de la descripción de página, antes de las pestañas.
- Preview, Guardar borrador y Guardar y publicar comparten el grupo inferior con
  Eliminar/Duplicar/Archivar, conservando permisos y bloqueos anteriores.
- Se eliminan los paneles Selección actual, Constructor visual y Nombre/estado
  local, incluidos Cambiar cabecera, edición de nombre y deshacer/rehacer del
  constructor de site parts. Se elimina su estado/handlers de historial local.
- El historial persistido de revisiones y la creación de nombres en Biblioteca
  permanecen porque están fuera de los tres paneles marcados.

Un formulario oculto conserva identidad, nombre existente, layout y bloques;
los botones inferiores se asocian por formId estable de React. Se mantiene la
validación de CSS, el estado de publicación y los errores inline fuera del
formulario oculto. Los formularios de duplicar/archivar son independientes;
no se anidan dentro del formulario de guardado.

Al revisar el snapshot se corrige la pérdida de layout.styleSheet al modificar
áreas/columnas: esas transiciones conservan el resto del layout, incluida la hoja
CSS. No se cambia ni elimina contenido persistido.

Validación: 739 pruebas UI; lint 0 errores/3 avisos anteriores; build correcto.
Chromium con fixtures en 1440/768/390: ausencia de paneles/renombrado/undo-redo,
acciones primarias en el grupo inferior, envío desde botones asociados al form,
CSS inválido bloqueado, guardar/reabrir, stylesheet conservada al editar un área,
Preview responsive/público, Escape/foco y controles axe sin contraste. Las acciones
son simuladas: sin publicación, borrado ni modificación de piezas reales.
