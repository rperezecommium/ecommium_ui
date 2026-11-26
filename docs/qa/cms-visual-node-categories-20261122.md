# Nodos visuales: estructura y contenido

La biblioteca compartida separa los cinco tipos estructurales (Container, Section,
Div, Grid y Flex) del contenido. Text se presenta en dos variantes compatibles
con los contratos existentes: simple (paragraph) y enriquecido (richText).
Form conserva el tipo newsletterForm existente; no añade un constructor de
formularios arbitrarios. Icon, Link, Spacer y HTML escapado permanecen disponibles
entre las piezas de contenido para preservar las capacidades existentes.

Seleccionar un contenido permite editarlo pero desactiva la inserción de hijos.
Los helpers de inserción, movimiento y extracción comprueban el tipo del destino.
La importación JSON comprueba la jerarquía de los subárboles nuevos. Los árboles
antiguos no se migran ni pierden datos: sus hijos siguen seleccionables, con aviso
y destinos estructurales disponibles para recuperarlos. Duplicar un hijo bajo
contenido antiguo se rechaza para evitar aumentar esa anidación.

Validación: 24 pruebas relacionadas correctas (incluye grupos de biblioteca,
controles desactivados, destinos inválidos, ciclos, recuperación legacy,
importación, renderizado y serialización). La suite cms-admin.test.mjs presenta
dos fallos ajenos a esta entrega: busca «Biblioteca visual» en
cms-block-builder-page.tsx y una expresión exacta de href en cms-admin-page.tsx;
ninguno de esos archivos se modificó en esta entrega. No se alteran los tests
para ocultarlos. Lint sin errores y tres avisos anteriores; build correcto.

No se ha guardado contenido ni modificado backend. La comprobación visual de
esta entrega no pudo completarse porque la ventana activa de Chrome cambió
durante la interacción. Responsive, axe y persistencia BFF no certificados aquí.
