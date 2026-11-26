# Variantes e imágenes: conexiones y comportamiento

## Alcance y fuente de verdad

Análisis realizado el 2026-11-10 en ecommium_ui, usando la referencia local del
composable, sin consultar ni modificar el repositorio backend. Este documento
sirve de mapa para los siguientes cambios de la sección Variantes.

## Conexiones de una variante

- Identidad: `default` es la clave UI de la variante 0; `defaultVariantId` es su
  identidad BFF. Las adicionales tienen `localId` y, tras persistirse, `variantId`.
  `draftFromEditorData` reconstruye variantes y referencias desde editor-state.
- Catálogo: nombre, SKU, EAN, activación y visibilidad se editan en el borrador.
  Añadir una variante habilita mode=variants sin recrear el producto o variante 0.
- Combinaciones: `options` contiene atributo/valor y sus IDs persistidos.
  Las nuevas variantes requieren combinación completa y única. El selector
  de atributos y la ficha técnica descriptiva usan superficies distintas.
- Precios: `productPrice`, `variantPrices`, tablas, impuestos y specific prices.
  Las variantes nuevas copian valores comerciales sin reutilizar pricingId.
- Inventario: `stockByVariant`, clave default y herencia/overrides por almacén.
  La asignación de imagen no modifica existencias, reservas ni almacenes.
- Servicios: `offerings.byVariant` depende de la variante seleccionada y de
  una identidad persistida para mutar asociaciones vía BFF.
- Imágenes: colección del producto, metadata de assets, portada global y
  asignaciones propias por variante son datos separados.
- Preview: resuelve la imagen efectiva con la misma función que las miniaturas.
  Las reglas de disponibilidad, impuestos, atributos y servicios se conservan.
- Guardado: `saveProductDraftAction` envía una operación multipart a
  POST /admin/product-save-operations. `productSaveSignature`/save-attempt
  conservan idempotencia y estado de operaciones parciales. Los IDs confirmados
  por draftPatch se preservan; no se resetea la identidad de una variante.
- Eliminación: revisión de impacto por BFF, confirmación explícita y bloqueo si
  hay cambios pendientes. Cambiar una imagen no elimina el asset del catálogo.
- Restauración/subida: borrador local acotado por contexto y GET/POST de
  product-drafts rehidratan IDs y assets. Una respuesta de otra identidad se
  rechaza. Las respuestas de upload no pisan portada/activación/metadata editadas
  mientras la petición estaba en curso.

## Reglas de imagen

1. Un producto sin imágenes y una colección sin portada/asignaciones son válidos
   como borrador; las filas muestran un icono genérico. Publicar conserva los
   requisitos actuales de portada activa, precio y stock; no se relajan.
2. Subir archivos crea assets en la colección; no marca automáticamente el
   primero como portada ni asigna imágenes a las variantes.
3. Solo una imagen tiene isMain=true. Si está activa, es la portada y la imagen
   de la variante 0. Elegir una imagen para la variante 0 equivale a elegirla
   como portada. «Sin portada» permite dejarla sin imagen.
4. Una variante adicional usa su asignación propia activa; en ausencia de ella
   hereda la portada activa de la variante 0. La herencia no se materializa como
   una copia de la imagen, para que cambiar la portada actualice a los herederos.
5. Desactivar/quitar una imagen propia limpia su override y restaura la herencia.
   Reactivarla no recupera automáticamente la asignación anterior.
6. Desactivar o quitar la portada deja sin imagen a variante 0 y herederas, hasta
   elegir/activar una portada. No se selecciona otra imagen de la colección por
   posición. Las asignaciones propias activas de otras variantes permanecen.
7. La metadata de portada inactiva se conserva sin permitir nuevas asignaciones
   a assets inactivos. Elegir otra portada elimina el flag de la anterior.
8. Los IDs legacy de assets/variantes se resuelven al localId canónico antes de
   serializar; se evitan entradas duplicadas para default y defaultVariantId.

Estas reglas de presentación y preparación del formulario están centralizadas
en `src/modules/catalogo/product-variant-media.ts`, sin duplicar servicios de
negocio ni sustituir la validación definitiva del BFF.

## Interacción

Se elimina la caja «Imágenes de variante». Cada miniatura en la tabla (incluida
la fila 0) es un botón con lápiz y nombre accesible. El selector lateral inicial
se sustituye por ProductVariantImagePicker, un popover compacto junto a la imagen.
Se monta mediante portal en document.body para evitar el recorte del scroll de
la tabla. Ajusta el lado y los límites al viewport y sigue al disparador al
hacer scroll/redimensionar. No desplaza columnas.

Muestra solo imágenes activas distintas de la imagen efectiva actual, con scroll
para colecciones extensas. La selección cierra el selector y devuelve el foco al
lápiz. Escape, clic fuera, Tab fuera y cierre explícito lo cierran; flechas y
Home/End permiten recorrer sus botones. No bloquea scroll ni usa overlay modal.
En variante 0 explica el impacto sobre portada/herederas y permite Sin portada.
En variantes con override propio permite Heredar imagen de variante 0.
Si no hay alternativas ofrece un estado vacío. Se respeta movimiento reducido.
La selección modifica el borrador; Guardar cambios persiste mediante BFF.

## Contrato y límites de verificación

Se reutilizan `media.items`, `assignments` y `mainByVariant` del draft existente.
Un override vacío representa limpiar la asignación (el gateway UI existente
incluye clearVariantMedia); el BFF recibe las mismas formas, sin endpoint nuevo.
La operación canónica de producto es propiedad del BFF. El antiguo
`product-save-orchestrator.ts` sigue existiendo por compatibilidad/pruebas y no
es el camino usado por saveProductDraftAction; no se reintroduce su fan-out.

Pendiente de validación real: comprobar que el BFF conserva una colección sin
portada, respeta el vaciado de overrides y no devuelve la herencia materializada
como una asignación propia indistinguible. Si se observa alguna incompatibilidad,
documentar el payload/resultado y sincronizar explícitamente el contrato; nunca
resolverlo llamando a servicios internos ni modificando el backend por iniciativa.
