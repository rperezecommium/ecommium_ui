# Variantes: tabla compacta y edición por selección

## Investigación del contrato local

Revisión 2026-11-10 de ecommium_ui y las capturas Medusa sktb/skwv aportadas por
el usuario. Sin leer ni modificar código del backend.

- La PDP actual se resuelve por slug/canonical del producto. En
  `src/modules/storefront/pdp-content-client.tsx`, selectVariant cambia el
  selectedVariantId local y los servicios seleccionados, sin cambiar ruta.
  El borrador de variantes no contiene slug/canonical individual. No se puede
  prometer /bola-basket-m y /bola-basket-l con este contrato. Un alias del
  producto tampoco identifica por sí mismo una variante seleccionada.
- La variante 0 existe como defaultVariantId y comparte el nombre base, refId
  y EAN de defaultVariant. Precio usa editorBasePrice/withEditorBasePrice; no
  se inventa un nuevo precio PRODUCT si el contrato ya lo representa como VARIANT.
- Las adicionales tienen nombre, refId, ean, isActive, isVisible y options propios.
  Su precio y stock conservan overrides/herencia. El stock persistido no puede
  volver a heredado cuando Inventory no admite borrado: se conserva el bloqueo.
- `defaultVariant` del draft documentado/tipado carece de options; las adicionales
  sí incluyen options y sus IDs. Actualmente los setters de atributos excluyen
  explícitamente la variante 0. **Gap para sincronización explícita:** si variante
  0 debe ser, por ejemplo, Talla S y las adicionales M/L, BFF debe documentar
  defaultVariant.options y su mapeo a variantOptions/defaultVariantId, validación
  de combinaciones únicas entre todas las variantes y rehidratación editor-state.
  No se envía esa propiedad ni se permite una edición que se perdería al guardar.

## Distribución

En Variantes, la tabla muestra selección, imagen/lápiz, nombre, SKU y activación.
No hay inputs de nombre/precio/stock dentro de la tabla ni columna técnica EAN.
La selección cambia el objetivo de los paneles sin navegar a otra ruta.

Bajo Imágenes, en la columna derecha:
1. Atributos de la variante: catálogo activo con valores elegibles como en Options
   de Medusa; muestra asignaciones y permite retirarlas. El selector existente
   conserva IDs persistidos y valida una combinación completa/única por variante.
2. Datos de la seleccionada: nombre, SKU, EAN, visibilidad y retirada/borrado seguro.
   Variante 0 edita los datos base. Las adicionales editan solo su identidad.
3. Precio: base de variante 0 u override de la adicional; indica moneda e impuestos.
4. Inventario: existencias, seguridad, reservado, disponibilidad e indicador de
   herencia. Reutiliza setters y bloqueo de retirada de stock persistido.

Servicios adicionales se conserva a la izquierda; sigue operando sobre la fila
seleccionada. El generador existente se conserva como opción avanzada plegada.
No se modifica la ruta canónica ni los payloads de producto/variante por el layout.

## Atributos habituales

La acción explícita Crear atributos habituales (Talla, Color, Acabado) prepara:
- Talla: XS, S, M, L, XL, XXL.
- Color: Negro, Blanco, Gris, Rojo, Azul, Verde, Amarillo, Naranja, Rosa, Marrón.
- Acabado: Mate, Brillante, Satinado.

Son plantillas de creación, no fixtures ni registros con IDs inventados. La
Server Action exige employee con catalog.specifications.write (o wildcard
admitido), categoría UUID y consulta exitosa antes de escribir. Crea mediante
createCatalogSpecificationField(tab=attributes) por BFF y solo añade a la UI
campos confirmados. Reutiliza nombres activos existentes del catálogo SKU y no
confunde características descriptivas con atributos. No modifica valores de
atributos existentes. Las creaciones son secuenciales y el botón queda ocupado.
El BFF sigue siendo responsable de unicidad/concurrencia entre clientes.

No se ejecuta automáticamente al abrir un producto ni se ha ejecutado en el
catálogo real en esta tarea. La categoría y la elección del usuario se mantienen
explícitas al usar el botón. Crear catálogo es inmediato; asignar valores a la
variante permanece en el borrador hasta Guardar cambios.

## QA y límites

Comandos:
- npm run lint: 0 errores; tres avisos previos ajenos al cambio.
- npm run build: correcto.
- node --test tests/product-variant-attribute-presets.test.mjs
  tests/product-editor.test.mjs tests/product-variant-media.test.mjs
  tests/product-save-operation-action.test.mjs tests/product-bff-scope.test.mjs:
  72/72 correctos.

Las pruebas nuevas verifican permisos, categoría inválida, scope del BFF, alta
real con IDs confirmados, reuso en segunda ejecución y no confundir una feature
Color con un atributo SKU Color; no se crea si la lectura del catálogo falla.

Se comprobó por árbol accesible de Chrome: tabla de 5 columnas, variante 0
seleccionada, datos base y sus paneles. La captura visual no es evidencia válida:
el usuario cambió a otra ventana durante la captura. No se alteró su ventana
posterior ni se crearon atributos/persistieron cambios reales desde ella.

Pendientes: QA visual, selección entre filas, alta real de atributos y
asignación->guardado->reapertura contra BFF; E2E, axe, responsive y Lighthouse.
No se repitió suite completa; su fallo previo de categoría en PDP Storefront
queda registrado en docs/qa/product-variant-images-20261110.md.

Ajuste posterior: la columna Estado conserva ambos controles Activa y Visible
por fila (incluida variante 0), con etiquetas y checks/radios de 14px; se evita
que hereden el ancho/alto de los inputs genéricos de tabla. Editor validado con
npx eslint y 42 tests del editor. No se repitió build ni QA visual para este ajuste.

## Corrección del panel de precios

Se restaura edición completa de precio para la fila seleccionada: neto, bruto,
regla fiscal, coste, precio tachado, tabla e impuestos incluidos. Usa los helpers
existentes netMinorFromPrice/grossMinorFromPrice/baseMinorFrom* y tax DTOs.
Variante 0 usa updateProductPriceField/withEditorBasePrice; adicionales usan
updateVariantPriceField. El estado propio/heredado y Restaurar precio heredado
son explícitos. Reglas, vigencia y simulador siguen en la pestaña Precio.

variantPriceForEdit copia los valores comerciales heredados sin pricingId del
padre antes de editar solo coste/impuesto u otro campo. Un override existente
mantiene su identidad; uno marcado para retirar recupera valores heredados y
su propia identidad si se vuelve a editar. No se cambian endpoints ni moneda.

Validación: 77/77 tests del editor, Pricing, contrato de guardado y scope BFF.
Dos pruebas nuevas cubren editar coste/impuesto sin poner el importe a cero y
restaurar un override marcado para retirar sin copiar la identidad del padre.
npm run lint: sin errores (tres avisos previos). npm run build: ver ejecución.
Chrome: se observaron neto=3814.65, bruto=4196.12, Default IVA y coste; no se
editaron importes ni guardaron datos. La selección de adicional no llegó a
probarse porque el usuario cambió de ventana. Sin E2E/axe/Lighthouse nuevos.

Corrección visual posterior: el precio en Variantes copia exactamente la caja
Precio base de Ajustes básicos: details abierto, resumen con importe en peso
normal, fondo blanco y cuatro campos (neto/bruto, impuesto/coste), misma cuadrícula.
Se retiran los extras añadidos al panel de variantes (tachado, tabla, checkbox,
indicadores y enlaces). Los controles se conectan al precio de la fila seleccionada;
se mantiene la corrección interna de herencia y los controles avanzados en Precio.
Validación: npm run lint, npm run build y 77 tests aplicables. Sin QA visual nuevo.

Inventario en Variantes copia también la caja de Ajustes básicos: details abierto,
resumen Inventario con existencias y tres inputs (Existencias, Stock de seguridad,
Reservado) en la misma distribución. Se retiran texto de disponibilidad y enlace
propio/heredado de este panel. Editar un stock heredado primero copia el registro
efectivo con enableVariantOwnStock y después actualiza el campo, preservando los
otros valores y el almacén. Variante 0 actualiza default; un stock propio actualiza
su clave existente. La gestión avanzada de herencia permanece en Inventario.
Validación: npm run lint, npm run build y pruebas del editor/scope/guardado.
Sin nueva comprobación visual ni guardado real.

Estado se retira de la tabla compacta y pasa exclusivamente a Datos de la variante
seleccionada: Activa y Visible juntos, checks de 14px, mismos setters de producto
para variante 0 y de variante adicional para el resto. La tabla conserva selección,
imagen, nombre y SKU; se retira el ancho fijo de su antigua última columna.
Validación del ajuste: npm run lint, npm run build, tests del editor y guardado.
Sin nueva QA visual ni escritura real.

Ajuste de filas según captura swdm: se retira productRowSelected de la tabla de
variantes (sin fondo ni borde de selección); el radio sigue indicando selección.
Se quita el subtítulo Variante 0. Nombre y SKU tienen una sola línea con ellipsis
y title con el texto completo. Celdas alineadas verticalmente y columna de imagen
centrada, con ancho que deja espacio para su miniatura y padding.
Validación: npm run lint, npm run build y tests/product-editor.test.mjs.
Sin QA visual/responsive ni Lighthouse adicionales.

Compactación según captura szfp: td sin padding, fila 40px, miniatura 34px,
columna imagen 48px; lápiz SVG 8px con soporte 12px. Se conserva todo el botón
miniatura como área pulsable. Cabeceras alineadas y object-fit contain.
Verificación focalizada: npx eslint del selector sin errores; sin repetir
build/tests ni QA visual para este ajuste de dimensiones.

Eliminación de variantes se traslada de Datos de la seleccionada a columna Acción
con papelera. CatalogDeletionButton incorpora iconOnly opcional y conserva su
revisión/confirmación, permisos y bloqueos de cambios pendientes/guardado activo.
La variante 0 no permite eliminarse de forma aislada. Variantes nuevas se retiran
del borrador tras confirmación; persistidas usan el flujo BFF existente.
Validación: npm run lint, npm run build y tests/catalog-deletion.test.mjs junto
con tests/product-editor.test.mjs. Sin ejecutar una eliminación real.
