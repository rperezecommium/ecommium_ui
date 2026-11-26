# Panel de atributos de variante

El panel inicial muestra únicamente los atributos asignados en tres columnas: nombre, valor y quitar. Se retiran el título repetido, la tabla de definiciones disponibles y el alta de atributos habituales. El botón +, con nombre accesible «Añadir atributo a la variante», abre un lateral con las definiciones vinculadas a la categoría del producto.

Elegir un atributo muestra sus valores y, para empleados con permiso de escritura de especificaciones, un formulario para añadir una opción por BFF. El alta actualiza el catálogo local del editor sin asignarla automáticamente a la variante. «Administrar atributos» reutiliza el administrador de campos con modo SKU: permite crear atributos en grupos nuevos o existentes, añadir valores y vincular grupos a categorías. El producto permanece en edición. Los laterales usan AdminResourceDrawer con Escape, foco contenido y restauración de foco.

Las Server Actions mantienen validación de sesión, permiso, formulario y respuestas del BFF. La conversión de grupos diferencia características descriptivas de atributos SKU; el modo predeterminado conserva el comportamiento de características. No se añade un backend alternativo ni se modifica el contrato de opciones de variantes. El gap de identidad/registro de opciones antiguas documentado en variant-attribute-registry-analysis-20261111.md sigue pendiente.

## Validación

- `npm run lint`: PASS, sin errores y con tres avisos previos ajenos.
- `npm run build`: PASS.
- `node --test tests/product-feature-flow.test.mjs tests/product-variant-attribute-presets.test.mjs tests/product-editor.test.mjs`: 58 PASS. Incluye separación de tipos SKU/descriptivo, rechazo de confirmación de tipo incorrecto, permisos, categoría y alta de opción confirmada.
- UI real, Tienda Barcelona, producto BICI-20260929-172: revisión de variante adicional, tabla de asignaciones, apertura por +, selector limitado a categoría, campo «Nueva opción para Talla de cuadro», administrador con categoría bicicletas, creación/grupos y retorno/cierre por Escape. Ficha «Sin cambios» al terminar; no se realizaron altas ni guardados reales durante la revisión.
- No se ejecutaron E2E de escritura real, axe automático ni comprobaciones en tablet/móvil en esta entrega. La revisión manual de los nuevos laterales fue desktop; no certifica el gap pendiente de sincronización con BFF ni el guardado histórico de opciones.
