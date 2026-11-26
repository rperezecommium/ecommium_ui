# Paneles de Ajustes básicos — 2026-11-10

Se trasladan los controles existentes de Categoría/marca y Precio base de la
columna principal a la lateral, después de Imágenes. Se añade Inventario básico
con existencias y stock de seguridad de la variante predeterminada, reservado
y disponible de solo lectura, y acceso a Inventario por variante/almacén.
Reutiliza stockForKey y updateStockNumber: no cambia el contexto de almacén,
contratos BFF ni las operaciones de guardado. Los tres paneles aparecen abiertos
únicamente en Ajustes básicos. Datos principales y características quedan a la
izquierda. Se conserva la proporción 60/40 y el apilado responsive existente.

Validación:
- npm run lint: sin errores, tres warnings preexistentes fuera del cambio.
- npm run build: correcto.
- node --test tests/product-editor.test.mjs: 42/42 correctos.
- Chrome con sesión/BFF existente: verificados los tres paneles en Ajustes
  básicos, su ausencia en Precio y su reaparición al volver. Sin guardar datos.
- No se ejecutaron E2E automatizados, axe, Lighthouse ni QA móvil.

## Compactación — captura jydq

Categoría/Marca, Precio base e Inventario se inician cerrados y muestran en
summary sus valores actuales (nombres de categoría/marca, importe y existencias).
Precio base elimina encabezado interior duplicado y enlace avanzado; su fondo
es blanco. Inventario presenta Existencias/Stock de seguridad/Reservado en tres
columnas en escritorio y una en móvil, reutilizando los mismos setters del
editor. Se retiran las filas de datos duplicados inferiores.

Validación: npm run build correcto; npm run lint sin errores (tres warnings
previos); node --test tests/product-editor.test.mjs 42/42 correctos.
No se repitieron la comprobación visual, E2E, axe ni Lighthouse en este ajuste.

## Cuadrícula Características — captura kfde

Debajo de Categoría/Marca se añade Características, una tabla de dos columnas
(nombre/valor) que consume selectedSpecifications: solo selecciones añadidas,
no eliminadas, con nombre/valor del catálogo y fallback del borrador existente.
Agregar abre el mismo panel lateral de características. Se conserva intacto el
bloque original de Características y especificaciones para comparación.

Validación: npm run lint sin errores (tres avisos previos); npm run build
correcto; node --test tests/product-editor.test.mjs tests/product-feature-flow.test.mjs:
49/49 correctos. Chrome con sesión existente: cuadrícula con durabilidad=20 y
elasticidad=80%; Agregar abre panel lateral y Cerrar lo retira sin editar datos.
No se ejecutaron axe, Lighthouse, E2E automatizado ni revisión móvil.

## Selector tabular — captura lscn

Se retiran el contador y el bloque de tarjetas Seleccionadas. La parte superior
muestra una tabla de características añadidas con grupo/campo, valor y papelera
que reutiliza removeSpecificationSelection. Debajo, el buscador filtra por grupo,
característica y nombre de categoría asociada disponible en el catálogo local.
Los resultados son tablas por grupo; cada campo muestra su valor seleccionado
o un guion y un botón + que abre la vista lateral de valores existente con
transición breve y opción Atrás. Las características seleccionadas no se excluyen
de los resultados. La selección respeta markedForDeletion.

Validación: npm run lint sin errores (3 warnings previos); npm run build correcto;
node --test tests/product-editor.test.mjs tests/product-feature-flow.test.mjs:
49/49 correctos. Chrome: Agregar abre tablas, búsqueda material conserva ambas
selecciones; + durabilidad abre opciones 18/20/360, con 20 seleccionado. Atrás
y Cerrar comprobados sin mutar datos. No se probó retirada real ni se ejecutaron
axe, Lighthouse, E2E automatizado o QA móvil.

## Alineación de tablas — captura majj

Ambas tablas usan colgroup compartido: característica 65%, acciones 40px y
valor con el ancho restante. Los botones + y papelera quedan centrados vertical
y horizontalmente en la última columna compacta. La tabla superior se agrupa
igual que los resultados: cabecera única con nombre del grupo, sin repetirlo
en cada fila. Se añaden 28px de margen antes del buscador, además del gap del
contenedor existente. No se cambian selección, búsqueda ni guardado.

Validación: Chrome, revisión de captura visual y cabeceras accesibles del panel;
se cerró sin cambios. npm run build correcto; npm run lint sin errores con los
3 warnings previos; 49/49 tests del editor y flujo de características correctos.
No se ejecutaron axe, Lighthouse, QA móvil ni E2E automatizado.

## Papelera en cuadrícula exterior

La caja Características situada junto a Agregar añade papelera por fila usando
removeSpecificationSelection, igual que el selector. Comparte colgroup 65% para
el nombre, 40px para acciones y resto para valor, con icono de 15px centrado.
La retirada sigue siendo una edición del borrador que se persiste al guardar.
No se cambia la operación BFF.

Verificación: tests del editor y flujo de características, 49/49 correctos.
Sin prueba de retirada real ni nueva revisión visual/responsive/axe/Lighthouse.

## Retirada del bloque antiguo

Se elimina de Ajustes básicos el bloque Características y especificaciones y
su agrupación auxiliar ya innecesaria. Se conserva la cuadrícula lateral,
Agregar, selección de valores, papelera y administración desde el selector.
El aviso de fallo de carga y Reintentar pasan a la nueva caja, preservando
la recuperación de errores sin mantener el formulario duplicado.
