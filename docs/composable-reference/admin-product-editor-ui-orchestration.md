# Guia de implementacion UI: editor admin de producto, media y variantes

## Objetivo

Definir como debe construirse la experiencia Admin para crear y editar productos sin exponer al usuario la complejidad de los bounded contexts.

La UI debe sentirse como una ficha de producto unica, similar en simplicidad a PrestaShop o WooCommerce, aunque por debajo coordine `Catalog`, `Media`, `Pricing`, `Inventory`, `Shipping/Logistics`, `Routing/SEO` y otros servicios.

Este documento no introduce una implementacion de UI dentro del repositorio. Las UIs viven fuera de este repo y deben consumir `apps/bff` como borde unico. Cuando se liste un endpoint interno de servicio, debe entenderse como contrato que la fachada BFF debe exponer o encapsular antes de que una UI externa lo consuma.

## Principios de experiencia

- El usuario crea un producto, no una cadena de microservicios.
- La UI trabaja con un borrador local antes de persistir.
- El boton principal es `Guardar producto`.
- La UI decide el orden tecnico de guardado segun dependencias.
- Un producto nuevo debe nacer como no publicado o fuera de linea hasta cumplir los minimos comerciales.
- Cada proceso debe quedar probado antes de iniciar el siguiente.
- Una implementacion nueva no debe romper el listado de productos ni la edicion de productos existentes.
- Los estilos deben respetar el Admin existente: layout de ficha, tabs, acciones persistentes, formularios densos y controles claros.

## Inspiracion PrestaShop

PrestaShop modela `Product` y `Combination` como conceptos separados. En su Webservice, una combinacion tiene `id_product`, referencia, cantidad, precio/impacto, peso, bandera de default y asociaciones a `product_option_values` e `images`.

Traduccion conceptual para Ecommium:

| PrestaShop            | Ecommium                                            |
| --------------------- | --------------------------------------------------- |
| Product               | `Catalog Product`                                   |
| Combination           | `ProductVariant`                                    |
| Product option values | `ProductVariantOption`                              |
| Images                | `MediaAsset` + relacion `VariantMedia` en `Catalog` |
| Default combination   | `defaultVariant`                                    |

Fuentes:

- https://devdocs.prestashop-project.org/9/webservice/resources/combinations/
- https://devdocs.prestashop-project.org/9/webservice/resources/products/

## Modelo mental para la UI

La UI debe manejar un `ProductDraft` local:

```ts
type ProductDraft = {
  basic: {
    name: string;
    slug: string;
    categoryId?: string;
    categorySlug?: string;
    brandId?: string;
    brandLinkId?: string;
    shortDescription: string;
    description: string;
    isVisible: boolean;
    isActive: boolean;
  };
  mode: "simple" | "variants";
  defaultVariant: {
    refId: string;
    name?: string;
    ean?: string | null;
  };
  media: {
    files: File[];
    metadata: Array<{
      isMain?: boolean;
      alt?: Record<string, string>;
      title?: Record<string, string>;
    }>;
    assignments: Record<string, string[]>;
    mainByVariant: Record<string, string>;
  };
  variants: Array<{
    localId: string;
    variantId?: string;
    name: string;
    refId: string;
    ean?: string | null;
    options: Array<{ attributeCode: string; valueCode: string }>;
    isActive: boolean;
    isVisible: boolean;
  }>;
  pricing: {
    productPrice?: PriceDraft;
    variantPrices: Record<string, PriceDraft>;
  };
  inventory: {
    stockByVariant: Record<string, StockDraft>;
  };
};
```

El usuario puede completar imagenes, precio y stock aunque el producto todavia no exista. La UI conserva esos datos en el borrador y los transforma en llamadas reales al guardar.

## Orden canonico de guardado

1. Resolver contexto Admin: `organizationId`, `shopId`, `locale`, token admin y permisos.
2. Resolver o validar dependencias base: categoria, marca, locale, defaults comerciales.
3. Crear o actualizar `Catalog Product`.
4. Obtener `productId` y `defaultVariantId`.
5. Crear o actualizar variantes (`ProductVariant`).
6. Crear opciones de variantes (`ProductVariantOption`).
7. Crear o ampliar coleccion `Media`.
8. Adjuntar assets de `Media` a variantes mediante `VariantMedia`.
9. Crear o actualizar precios en `Pricing`.
10. Crear o actualizar stock en `Inventory`.
11. Preparar SEO/rutas/publicacion si aplica.
12. Recargar el producto desde lectura Admin y mostrar estado final.

Si un paso posterior falla, no se debe perder el producto ya creado. La UI debe mostrar recuperacion parcial y permitir reintentar el bloque fallido.

## Proceso 1: entrada de menu y modulo vacio

### Objetivo

Crear el punto de entrada visual sin conectar todavia llamadas de escritura.

### UI esperada

- Entrada de menu: `Catalogo > Productos`.
- Boton primario: `Anadir producto`.
- Ruta sugerida en la UI externa:
  - `/admin/products`
  - `/admin/products/new`
  - `/admin/products/[productId]`
- Pantalla vacia de editor con:
  - header con nombre editable o placeholder `Nuevo producto`;
  - selector `Producto simple | Producto con variantes`;
  - tabs visibles pero sin logica profunda:
    - `Ajustes basicos`
    - `Imagenes`
    - `Variantes`
    - `Precio`
    - `Inventario`
    - `Transporte`
    - `SEO`
    - `Opciones`
  - barra inferior persistente:
    - `Vista previa`
    - estado `Fuera de linea`
    - `Guardar`
    - `Duplicar`
    - `Ir al catalogo`
    - `Anadir nuevo producto`

### Pruebas de cierre

- Abrir listado de productos sigue funcionando.
- Abrir `Anadir producto` no ejecuta mutaciones.
- Cambiar tabs no pierde estado local.
- La pantalla respeta estilos del Admin existente.

## Proceso 2: borrador local y navegacion segura

### Objetivo

Permitir llenar datos antes de tener `productId`.

### Comportamiento

- Crear estado `ProductDraft`.
- Mantener datos en memoria y, si el Admin lo soporta, persistir borrador local/autosave del navegador.
- Bloquear salida si hay cambios sin guardar.
- No llamar aun a `Catalog`, `Media`, `Pricing` ni `Inventory`.

### Campos minimos del borrador

- Nombre.
- Tipo de producto: simple o con variantes.
- Categoria o categoria pendiente.
- Marca opcional.
- Referencia de variante default.
- Imagenes seleccionadas en memoria.
- Precio base.
- Cantidad inicial.

### Pruebas de cierre

- El usuario puede completar tabs sin backend.
- Si vuelve a `Ajustes basicos`, no se pierden imagenes ni precios.
- La UI no muestra errores de microservicios antes de guardar.

## Proceso 3: pestana `Ajustes basicos`

### Objetivo

Capturar la informacion estructural que necesitara `Catalog Product`.

### Campos recomendados

- Nombre.
- Slug o URL amigable, autogenerada y editable.
- Tipo: simple o con variantes.
- Categoria principal.
- Marca.
- Resumen.
- Descripcion.
- Referencia principal.
- Estado visible/publicable.
- Bloque rapido de portada.

### Payload objetivo para crear producto

La UI externa debe llamar a una fachada BFF equivalente a la creacion de producto. El contrato interno actual de `Catalog` es:

```http
POST /api/v1/admin/products
Authorization: Bearer <admin-token>
x-locale: es-ES
```

```json
{
  "locale": "es-ES",
  "name": "Lego Halcon Millenario",
  "categoryId": "33333333-3333-4333-8333-333333333333",
  "brandId": "44444444-4444-4444-8444-444444444444",
  "slug": "lego-halcon-millenario",
  "linkId": "lego-halcon-millenario",
  "defaultVariant": {
    "refId": "LEGO-HALCON-MILLENARIO"
  },
  "isVisible": true,
  "description": "Descripcion completa del producto.",
  "releaseDate": "2026-06-17T00:00:00.000Z",
  "keywords": "lego, star wars, halcon millenario",
  "title": "Lego Halcon Millenario",
  "shortDescription": "Set Lego Star Wars Halcon Millenario.",
  "taxCode": "standard",
  "metaTagDescription": "Compra Lego Halcon Millenario.",
  "supplierId": 0,
  "isActive": false
}
```

Notas:

- `isActive=false` al crear evita publicar productos incompletos.
- `defaultVariant.refId` es obligatorio.
- No enviar `images` en producto. Las imagenes se asignan por variante.
- Usar `categorySlug` o `brandLinkId` solo si la fachada BFF lo permite y hay referencias humanas unicas.

### Respuesta esperada

```json
{
  "productId": "f3c6b5e1-7c2a-4e1b-9d2b-3a4c5d6e7f01",
  "name": "Lego Halcon Millenario",
  "slug": "lego-halcon-millenario",
  "isActive": false,
  "mediaCollectionId": null
}
```

La UI debe obtener tambien las variantes del producto para conocer la `defaultVariant`:

```http
GET /api/v1/admin/products/:productId/variants?limit=20&offset=0
```

### Pruebas de cierre

- Crear producto simple sin imagenes no rompe el listado.
- El producto creado aparece en listado Admin como inactivo.
- Recargar detalle conserva campos basicos.
- No se ha llamado a Media ni Pricing en este proceso.

### Estado implementado 2026-06-19

- La UI externa mantiene el `POST /admin/products` seguro: aunque el operador marque `Activo`, la creacion inicial envia `isActive=false`.
- La pestaña `Ajustes basicos` muestra un checklist comercial de publicacion: portada guardada, precio base mayor que cero y stock disponible.
- La intencion `Activo` ya no publica de forma inmediata si faltan media, pricing o inventory; el orquestador guarda el producto y lo deja fuera de linea con errores visibles.
- Si el producto nuevo trae portada, precio y stock en el borrador, el orquestador crea Catalog offline, sube Media, asigna portada a `defaultVariant`, crea Pricing, guarda Inventory y solo al final activa producto y variante default.
- Si la activacion falla, el producto queda persistido fuera de linea y se conserva el estado parcial para reintentar.

## Proceso 4: guardado orquestado minimo

### Objetivo

Introducir un orquestador de guardado sin resolver aun todos los servicios.

### Comportamiento

- `Guardar producto` ejecuta solo:
  1. validacion local;
  2. `POST /admin/products` si es nuevo;
  3. `PATCH /admin/products/:productId` si ya existe;
  4. recarga de detalle.
- Mostrar progreso:
  - `Guardando producto`
  - `Producto creado`
  - `Producto actualizado`
- Persistir resultado parcial en el draft:
  - `productId`
  - `defaultVariantId`
  - `saveState.catalog = success`

### Payload para actualizar producto

```http
PATCH /api/v1/admin/products/:productId
Authorization: Bearer <admin-token>
x-locale: es-ES
```

```json
{
  "name": "Lego Halcon Millenario",
  "refId": "LEGO-HALCON-MILLENARIO",
  "slug": "lego-halcon-millenario",
  "shortDescription": "Set Lego Star Wars Halcon Millenario.",
  "description": "Descripcion completa actualizada.",
  "isVisible": true,
  "isActive": false
}
```

### Pruebas de cierre

- Crear, editar y recargar producto funciona.
- Un fallo de red muestra error y permite reintentar.
- El listado sigue cargando aun si el ultimo guardado falla.

## Proceso 5: pestana `Imagenes` en modo borrador

### Objetivo

Permitir subir imagenes visualmente antes de enviarlas a `Media`.

### UI esperada

- Dropzone o tarjeta/boton `+` para `Anadir imagenes`.
- Grid tipo PrestaShop:
  - tarjeta `+`;
  - miniaturas;
  - badge `Portada`;
  - indicador `Pendiente de guardar`.
- Panel lateral de imagen seleccionada:
  - `Imagen de portada`;
  - `Texto alt`;
  - `Titulo imagen`;
  - `Activa`;
  - `Eliminar del borrador`.

### Reglas

- La primera imagen nueva se marca como portada por defecto.
- Solo una imagen puede ser portada del producto simple/default.
- Si existe tarjeta `+`, esa tarjeta debe abrir el flujo real de subida/asignacion. No duplicar la accion con botones decorativos.
- Al eliminar una imagen del borrador, limpiar cualquier asignacion de variante y portada por variante que apunte a esa imagen.
- Generar metadata local por defecto:

```json
[
  {
    "isMain": true,
    "alt": {
      "es-ES": "Lego Halcon Millenario imagen 1"
    },
    "title": {
      "es-ES": "Lego Halcon Millenario imagen 1"
    }
  }
]
```

### Pruebas de cierre

- Seleccionar imagenes no llama a backend.
- Reordenar miniaturas actualiza solo el borrador.
- Cambiar portada conserva una sola portada.
- El usuario puede volver a `Ajustes basicos` sin perder las imagenes.

## Proceso 6: persistir coleccion Media del producto

### Objetivo

Subir archivos a `Media` despues de tener `productId`.

### Dependencias

- `productId` creado.
- `shopId` resuelto.
- Nombre de producto disponible para `title`.
- Imagenes pendientes en el draft.

### Crear coleccion Media

La UI externa debe usar BFF. El contrato interno de `Media` es:

```http
POST /api/v1/admin/media/collections
Content-Type: multipart/form-data
Authorization: Bearer <admin-token>
```

Campos `form-data`:

```text
files o file      requerido, 1 a 20 archivos
shopId            requerido
productId         requerido
title             requerido
defaultLocale     opcional
metadata          opcional, string JSON array
```

Ejemplo de `metadata`:

```json
[
  {
    "isMain": true,
    "alt": {
      "es-ES": "Lego Halcon Millenario vista frontal"
    },
    "title": {
      "es-ES": "Lego Halcon Millenario vista frontal"
    }
  },
  {
    "isMain": false,
    "alt": {
      "es-ES": "Lego Halcon Millenario detalle"
    },
    "title": {
      "es-ES": "Lego Halcon Millenario detalle"
    }
  }
]
```

### Anadir imagenes a coleccion existente

```http
POST /api/v1/admin/media/collections/:mediaCollectionId/items
Content-Type: multipart/form-data
Authorization: Bearer <admin-token>
```

Campos:

```text
files o file
defaultLocale
metadata
```

No enviar `shopId`, `productId` ni `title`; ya pertenecen a la coleccion.

### Respuesta esperada

```json
{
  "collection": {
    "mediaCollectionId": "2ca1451f-3709-40f6-8be4-f80b2f24d16d",
    "shopId": "22222222-2222-4222-8222-222222222222",
    "productId": "f3c6b5e1-7c2a-4e1b-9d2b-3a4c5d6e7f01",
    "title": "Lego Halcon Millenario",
    "items": [
      {
        "idImage": "e95fd308-7015-4bb3-a3f9-5e7679f4dd2e",
        "cover": true,
        "position": 1,
        "kind": "image",
        "public": "https://storage.googleapis.com/bucket/path/original.jpg",
        "metadata": {
          "alt": {
            "es-ES": "Lego Halcon Millenario vista frontal"
          },
          "title": {
            "es-ES": "Lego Halcon Millenario vista frontal"
          }
        }
      }
    ]
  }
}
```

La UI debe guardar:

- `mediaCollectionId`;
- `items[].idImage` como `mediaAssetId`;
- metadata y orden local.

Reglas de integracion:

- `items[].idImage` es el UUID canonico del asset en `Media`; la UI debe tratarlo como `mediaAssetId`.
- No enviar ids locales del borrador a `Catalog VariantMedia`. Si una imagen asignada no tiene `mediaAssetId` UUID despues de subir o recargar, mostrar error de bloque `variantMedia` y no llamar a Catalog.
- Si una imagen GCS se bloquea por ORB, revisar la respuesta HTTP del objeto. Una respuesta XML/404 `NoSuchKey` indica URL publica normalizada contra bucket/prefijo incorrecto u objeto inexistente.
- La UI debe mantener fallback visual si una URL publica falla: mostrar nombre/placeholder del asset y conservar operables metadata y asignacion por variante.

### Pruebas de cierre

- Crear producto con imagenes sube archivos despues de crear `productId`.
- Si falla Media, el producto queda creado y la UI muestra `Reintentar imagenes`.
- Recargar producto muestra `mediaCollectionId` cuando existe.
- El listado de productos no depende de que Media haya terminado.

## Proceso 7: producto simple y asignacion a `defaultVariant`

### Objetivo

Hacer que el producto simple muestre imagenes reales en Storefront/Admin al asociar assets a la variante default.

### Comportamiento

Aunque el usuario ve `Producto simple`, el sistema usa `defaultVariant`.

Secuencia:

1. Obtener `defaultVariantId` desde `GET /admin/products/:productId/variants`.
2. Subir imagenes a `Media`.
3. Adjuntar imagenes a `defaultVariant`.
4. Marcar una imagen principal.

### Adjuntar imagenes en bloque

```http
POST /api/v1/variants/:variantId/media/bulk
Authorization: Bearer <admin-token>
```

```json
{
  "mediaAssetIds": [
    "e95fd308-7015-4bb3-a3f9-5e7679f4dd2e",
    "75d1d2a1-47c4-469f-8ccd-614f44ca9408"
  ],
  "mainMediaAssetId": "e95fd308-7015-4bb3-a3f9-5e7679f4dd2e",
  "status": "active"
}
```

### Cambiar portada

```http
PUT /api/v1/variants/:variantId/media/main
Authorization: Bearer <admin-token>
```

```json
{
  "mediaAssetId": "75d1d2a1-47c4-469f-8ccd-614f44ca9408"
}
```

### Reglas de backend que la UI debe respetar

- El asset debe existir y estar activo en `Media`.
- El asset debe pertenecer al mismo `productId` de la variante.
- Las variantes de un mismo producto deben usar assets de una unica `mediaCollectionId`.
- Si una variante queda sin imagen activa, hereda imagenes de la `defaultVariant`.

### Pruebas de cierre

- Producto simple con imagen portada aparece con imagen en detalle Admin.
- Cambiar portada actualiza una sola principal.
- Quitar imagenes de variante permite fallback segun reglas.
- Reintentar `bulk` no debe duplicar asignaciones sin control; si el backend responde duplicado, la UI debe refrescar y reconciliar.

## Proceso 8: modo `Producto con variantes`

### Objetivo

Permitir gestionar variantes vendibles (`ProductVariant`) y sus opciones comerciales (`ProductVariantOption`) sin mezclar ambos niveles. La UI puede ofrecer un generador rapido inspirado en combinaciones de PrestaShop, pero el nivel principal de la ficha es siempre la variante vendible.

### UI esperada

Pestana `Variantes`:

- tabla principal de `ProductVariant`:
  - nombre comercial de variante;
  - SKU/referencia;
  - EAN;
  - imagen directa/heredada;
  - precio propio o heredado;
  - stock propio;
  - estado activo/visible;
- panel de opciones de la variante seleccionada:
  - `Color`: rojo, azul;
  - `Longitud`: 1-metro, 2-metros;
  - `Material`: acero, aluminio;
- generador rapido opcional desde atributos:
  - `Color`: rojo, azul;
  - `Talla`: S, M, L;
- boton `Generar variantes`;
- tabla:

```text
Imagen | Variante | Referencia | EAN | Precio | Stock | Activa
```

### Reglas UX

- La variante default siempre existe.
- Si el producto pasa de simple a variantes, la variante default puede representar la primera combinacion o quedar como fallback tecnico.
- Cada variante debe tener `refId` unico en el producto.
- Las opciones describen atributos comerciales de una variante concreta: `attributeCode/valueCode`.
- En variantes nuevas, las opciones se crean despues de crear la variante.
- En variantes persistidas, la UI debe conservar `variantOptionId` para poder actualizar con `PATCH` o desactivar con `DELETE mode=soft`.
- En la ficha de producto, una variante persistida no debe borrarse con `DELETE` como accion normal. La UI debe usar `PATCH /api/v1/admin/variants/:variantId` con `isActive=false` para desactivar y `isActive=true` para reactivar, dejando la recuperacion dentro del guardado normal.
- `DELETE /api/v1/admin/variants/:variantId` queda reservado para herramientas operativas o E2E con variantes de prueba hasta que exista un flujo explicito de restauracion.
- Las combinaciones locales no persistidas si pueden quitarse del borrador sin llamar al backend.

### Crear variante

```http
POST /api/v1/admin/products/:productId/variants
Authorization: Bearer <admin-token>
x-locale: es-ES
```

```json
{
  "locale": "es-ES",
  "name": "Lego Halcon Millenario / Edicion coleccionista",
  "refId": "LEGO-HALCON-ED-COL",
  "ean": null,
  "isVisible": true,
  "isActive": true
}
```

### Editar variante

```http
PATCH /api/v1/admin/variants/:variantId
Authorization: Bearer <admin-token>
x-locale: es-ES
```

```json
{
  "locale": "es-ES",
  "name": "Lego Halcon Millenario / Edicion coleccionista",
  "refId": "LEGO-HALCON-ED-COL",
  "ean": null,
  "isVisible": true,
  "isActive": true
}
```

### Eliminar variante

```http
DELETE /api/v1/admin/variants/:variantId?mode=soft
Authorization: Bearer <admin-token>
```

Este endpoint existe en BFF, pero la UI de ficha de producto no debe usarlo como accion normal sobre variantes reales. Para operaciones reversibles usa `PATCH` con `isActive=false|true`. El borrado/desactivacion por `DELETE` queda para herramientas operativas o pruebas sobre variantes creadas para E2E.

### Crear opcion de variante

```http
POST /api/v1/admin/variants/:variantId/options
Authorization: Bearer <admin-token>
```

```json
{
  "attributeCode": "edition",
  "valueCode": "collector",
  "isActive": true
}
```

Ejemplo con dos atributos:

```json
[
  {
    "attributeCode": "color",
    "valueCode": "red",
    "isActive": true
  },
  {
    "attributeCode": "size",
    "valueCode": "m",
    "isActive": true
  }
]
```

La UI debe enviarlas como llamadas separadas por opcion hasta que exista una fachada batch.

### Pruebas de cierre

- Generar variantes no llama a backend hasta guardar.
- Guardar crea variantes y opciones.
- El backend rechaza combinaciones duplicadas; la UI debe mostrar el conflicto en la fila.
- El listado de variantes se recarga y muestra `variantId` reales.
- Desactivar/reactivar una variante persistida usa `PATCH` y no la elimina de la tabla.
- Quitar una variante local del borrador limpia imagenes, precios, offerings y stock locales asociados.

## Proceso 9: imagenes por variante

### Objetivo

Permitir que cada variante tenga sus propias imagenes, como las combinaciones de PrestaShop.

### UI esperada

Dentro de `Variantes`, al abrir una fila:

```text
Variante: Color rojo / Talla M

[ ] imagen general 1
[x] imagen roja frontal  Portada
[x] imagen roja detalle
[ ] imagen azul frontal
```

Acciones:

- `Usar imagenes del producto`.
- `Asignar imagenes`.
- `Marcar portada de variante`.
- `Limpiar imagenes de esta variante`.

### Comportamiento

- La galeria de producto viene de `Media`.
- La asignacion comercial vive en `Catalog VariantMedia`.
- El selector de la UI debe usar `variantRows[]` de `GET /api/v1/admin/products/:productId/editor-state` para mostrar `Producto`, `Producto base` o `Variante N`, sin exponer `defaultVariant` como una variante comercial adicional.
- Si una variante no tiene imagenes directas, hereda las imagenes del producto/default variant segun `effectiveMediaSource`.

### Sincronizar imagenes de una variante

```http
PUT /api/v1/admin/variants/:variantId/media
Authorization: Bearer <admin-token>
```

```json
{
  "items": [
    {
      "mediaAssetId": "e95fd308-7015-4bb3-a3f9-5e7679f4dd2e",
      "isMain": true,
      "status": "active"
    }
  ]
}
```

La UI envia la seleccion completa en el orden visual deseado. El BFF/Catalog sincroniza la relacion y asigna `sortOrder` unico por variante; seleccionar una imagen ya existente de la coleccion no vuelve a subir el asset.

### Limpiar imagenes de variante

```http
DELETE /api/v1/variants/:variantId/media
Authorization: Bearer <admin-token>
```

### Pruebas de cierre

- Variante roja puede tener imagen roja sin afectar variante azul.
- Cambiar portada de una variante no cambia portada de otras variantes.
- Limpiar imagenes de una variante activa fallback a imagenes del producto.
- PDP/lectura hidratada muestra `variants[].images`.

## Proceso 10: pestana `Precio`

### Objetivo

Permitir precio por producto y override por variante sin mezclar Pricing dentro de Catalog.

### UI esperada

- Precio base del producto.
- Lista de variantes con override opcional.
- Indicador:
  - `Usa precio del producto`;
  - `Precio propio de variante`.

### Crear precio base de producto

La UI externa debe usar BFF. El contrato interno de `Pricing` es:

```http
POST /api/v1/admin/prices
Authorization: Bearer <admin-token>
```

```json
{
  "organizationId": "11111111-1111-4111-8111-111111111111",
  "shopId": "22222222-2222-4222-8222-222222222222",
  "targetType": "PRODUCT",
  "productId": "f3c6b5e1-7c2a-4e1b-9d2b-3a4c5d6e7f01",
  "variantId": null,
  "priceTableId": null,
  "tradePolicy": "default",
  "channel": "web",
  "customerGroup": null,
  "country": "ES",
  "currency": "EUR",
  "timezone": "Europe/Madrid",
  "basePriceMinor": 10999,
  "listPriceMinor": 12999,
  "costPriceMinor": null,
  "fixedPriceMinor": null,
  "tiers": null,
  "taxIncluded": true,
  "tax": null,
  "active": true,
  "priority": 10,
  "source": "BASE"
}
```

### Crear precio especifico de variante

```json
{
  "organizationId": "11111111-1111-4111-8111-111111111111",
  "shopId": "22222222-2222-4222-8222-222222222222",
  "targetType": "VARIANT",
  "productId": "f3c6b5e1-7c2a-4e1b-9d2b-3a4c5d6e7f01",
  "variantId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "priceTableId": null,
  "tradePolicy": "default",
  "channel": "web",
  "customerGroup": null,
  "country": "ES",
  "currency": "EUR",
  "timezone": "Europe/Madrid",
  "basePriceMinor": 11999,
  "listPriceMinor": null,
  "taxIncluded": true,
  "active": true,
  "priority": 10,
  "source": "BASE"
}
```

### Consultar precios existentes

```http
GET /api/v1/admin/prices?organizationId=:org&shopId=:shop&targetType=VARIANT&productId=:productId&active=true&currency=EUR
```

### Pruebas de cierre

- Producto simple guarda precio base.
- Variante sin precio propio resuelve fallback de producto.
- Variante con precio propio muestra override en tabla.
- Fallo de Pricing no borra producto ni imagenes; UI permite `Reintentar precio`.

## Proceso 11: pestana `Offering`

### Objetivo

Crear y gestionar servicios vendibles asociados a una variante sin mezclarlo con Catalog.

### UI esperada

- Selector de combinacion persistida.
- Crear offering con nombre localizado, tipo, precio, moneda y estado.
- Asociar el offering a la variante seleccionada.
- Activar/desactivar la asociacion.
- Desasignar el offering de la variante.

### Crear offering

```http
POST /api/v1/admin/offerings?organizationId=:org&shopId=:shop
Authorization: Bearer <admin-token>
```

```json
{
  "type": "service",
  "priceMinor": 499,
  "currency": "EUR",
  "localizedName": [
    {
      "locale": "es-ES",
      "value": "Garantia extendida"
    }
  ],
  "active": true
}
```

### Asociar offering a variante

```http
PUT /api/v1/admin/offerings/:offeringId/variants/:variantId?organizationId=:org&shopId=:shop
Authorization: Bearer <admin-token>
```

### Activar o desactivar asociacion

```http
PUT /api/v1/admin/offerings/:offeringId/variants/:variantId/activation?organizationId=:org&shopId=:shop
Authorization: Bearer <admin-token>
```

```json
{
  "active": false
}
```

### Desasignar offering

```http
DELETE /api/v1/admin/offerings/:offeringId/variants/:variantId?organizationId=:org&shopId=:shop
Authorization: Bearer <admin-token>
```

### Consultar offerings por variante

```http
GET /api/v1/admin/offerings/variants/:variantId?organizationId=:org&shopId=:shop&locale=es-ES&includeInactive=true
Authorization: Bearer <admin-token>
```

### Resolver offerings en batch

```http
POST /api/v1/admin/offerings/variants/resolve-batch?organizationId=:org&shopId=:shop&locale=es-ES&includeInactive=true
Authorization: Bearer <admin-token>
```

```json
{
  "variantIds": [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  ]
}
```

### Gap conocido

El BFF no expone todavia un listado global de offerings para seleccionar uno existente por nombre. La UI actual puede crear y asignar offerings, listar los asociados a una variante y desasignarlos.

### Pruebas de cierre

- Producto existente carga offerings por variante.
- Crear offering lo asocia a la variante seleccionada.
- Variante sin `variantId` muestra bloqueo recuperable.
- Activar/desactivar y desasignar ejecutan mutaciones reales contra BFF.

## Proceso 12: pestana `Inventario`

### Objetivo

Configurar stock por variante y warehouse sin poner stock en Catalog.

### UI esperada

- Producto simple: tabla compacta para la variante default.
- Producto con variantes: separar `Stock del producto` y `Stock por variante`.
- Cada fila debe mostrar `warehouseId`, `onHandQuantity`, `reservedQuantity`, `safetyStockQuantity`, `availableQuantity` y estado disponible/sin stock.
- Warehouse configurable por fila, con default operativo `main-warehouse` o el que entregue el contexto.

### Actualizar stock

Contrato interno de `Inventory`:

```http
PUT /api/v1/admin/inventory/stock-levels?organizationId=:org&shopId=:shop
Authorization: Bearer <admin-token>
```

```json
{
  "variantId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "warehouseId": "main-warehouse",
  "onHandQuantity": 25,
  "reservedQuantity": 0,
  "safetyStockQuantity": 2
}
```

Respuesta esperada:

```json
{
  "organizationId": "11111111-1111-4111-8111-111111111111",
  "shopId": "22222222-2222-4222-8222-222222222222",
  "variantId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "warehouseId": "main-warehouse",
  "onHandQuantity": 25,
  "reservedQuantity": 0,
  "safetyStockQuantity": 2,
  "availableQuantity": 23,
  "updatedAt": "2026-06-17T00:00:00.000Z"
}
```

### Validar disponibilidad

```http
POST /api/v1/inventory/availability/resolve-batch?organizationId=:org&shopId=:shop
```

```json
{
  "items": [
    {
      "variantId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "warehouseId": "main-warehouse"
    }
  ]
}
```

### Pruebas de cierre

- Stock de variante default se actualiza en producto simple.
- Cada variante mantiene su propio stock.
- La UI no envia filas vacias con todas las cantidades en cero.
- Tras guardar, la respuesta de Inventory actualiza `availableQuantity` en el borrador.
- PLP/PDP no deben mostrar vendible un producto sin stock disponible cuando aplique el filtro Storefront.
- Fallo de Inventory no bloquea edicion de Catalog; deja tarea recuperable.

## Proceso 13: recarga de producto existente

### Objetivo

Editar productos existentes sin reconstruir todo desde cero.

### Secuencia de carga

1. `GET /api/v1/admin/products/:productId`.
2. `GET /api/v1/admin/products/:productId/variants`.
3. Por cada variante visible, cargar opciones:
   - `GET /api/v1/admin/variants/:variantId/options`.
4. Cargar coleccion Media por producto:
   - `GET /api/v1/admin/media/collections/by-product/:productId`.
5. Cargar relaciones de media por variante:
   - `GET /api/v1/variants/:variantId/media?includeDeleted=false&status=active`.
6. Cargar precios admin:
   - `GET /api/v1/admin/prices?...`.
7. Cargar stock:
   - `POST /inventory/availability/resolve-batch`.

### Pruebas de cierre

- Abrir producto simple existente rehidrata portada, precio y cantidad.
- Abrir producto con variantes rehidrata tabla, opciones e imagenes por variante.
- Producto sin Media no rompe la pantalla; muestra galeria vacia.
- Producto con fallos parciales muestra bloques en estado degradado, no pantalla rota.

## Proceso 13: publicacion y validacion final

### Objetivo

Evitar publicar productos incompletos.

### Minimos recomendados para publicar

- Producto activo y visible.
- Nombre, slug, categoria y marca validos.
- Al menos una variante activa.
- Al menos una imagen activa asociada a `defaultVariant` o a la variante vendible principal.
- Precio resoluble por producto o variante.
- Stock disponible si el canal exige stock.
- SEO basico: title/meta description/slug.

### Comportamiento

- `Guardar` persiste cambios sin publicar.
- `Publicar` ejecuta validacion y luego `PATCH /admin/products/:productId` con `isActive=true`.
- En la UI externa actual, el checkbox `Activo` representa la intencion de publicar. El orquestador debe tratarlo como una activacion diferida: primero guarda Catalog de forma segura, despues confirma Media/Pricing/Inventory y por ultimo ejecuta el `PATCH` de activacion.
- Si faltan datos:

```text
No se puede publicar todavia
- Falta imagen principal
- Falta precio
- Falta stock disponible
```

### Pruebas de cierre

- Producto incompleto queda fuera de linea.
- Producto completo puede publicarse.
- Al publicar, PLP/PDP muestran imagen/precio/disponibilidad correctos tras invalidacion/proyeccion.

### Estado implementado 2026-06-19

- Checklist de publicacion implementado en UI externa y reutilizado por el orquestador.
- Producto incompleto con `Activo=true` se guarda con `isActive=false` y `defaultVariant.isActive=false`.
- Producto completo con imagen/precio/stock en borrador se activa solo tras completar Media, VariantMedia, Pricing e Inventory.
- Queda pendiente certificar con Playwright una activacion real autenticada contra BFF para validar invalidaciones/proyecciones fuera de tests unitarios.

## Proceso 13.1: cierre operativo de ProductVariant

### Estado validado 2026-06-19

- La ficha permite agregar variantes nuevas desde `Combinaciones` y persistirlas con `POST /api/v1/admin/products/:productId/variants`.
- Las variantes nuevas mantienen validacion obligatoria de opciones comerciales.
- Las variantes persistidas legacy sin opciones comerciales no bloquean guardados posteriores; se consideran deuda de datos y no un error de UI para ediciones no relacionadas.
- La ficha permite modificar EAN/referencia/nombre/estado de variantes persistidas con `PATCH /api/v1/admin/variants/:variantId`.
- La accion normal sobre una variante persistida es `Desactivar`/`Reactivar`; `DELETE` queda fuera de la ficha normal.

### Prueba manual con Playwright

- Producto: `2139ac5a-7d3a-4a81-902a-5aae48c78de8`.
- Variante creada: `PROCESO_8_PRODUCTO_VARIANTES_20260617_2018_CODEX1513_E2E1513`.
- EAN inicial: `8430000015130`.
- EAN editado: `8430000015131`.
- Flujo validado: crear, guardar, descartar borrador local, recargar, editar EAN, desactivar, recargar, reactivar, recargar.
- Estado final verificado: variante activa, EAN `8430000015131`, accion disponible `Desactivar`.

### Ajuste UX aplicado tras revision de modelo

- La pestana visible pasa de `Combinaciones` a `Variantes` para no confundir la unidad vendible con sus opciones.
- La tabla principal representa `Producto` y variantes vendibles: nombre comercial, SKU/referencia, EAN, precio propio o heredado, stock, imagen heredada/directa, estado activo/visible y acciones de ciclo de vida.
- Las opciones comerciales (`ProductVariantOption`) se editan en un panel de detalle de la variante seleccionada.
- Para variantes nuevas, las opciones se pueden agregar/quitar antes de guardar y se persisten con `POST /api/v1/admin/variants/:variantId/options`.
- Para variantes persistidas, el draft conserva `variantOptionId` cuando BFF lo entrega y el guardado sincroniza cambios con `PATCH /api/v1/admin/variants/:variantId/options/:variantOptionId`.
- Quitar una opcion persistida desde la ficha ejecuta desactivacion segura con `DELETE /api/v1/admin/variants/:variantId/options/:variantOptionId?mode=soft`; agregar una opcion nueva en variante persistida usa `POST /api/v1/admin/variants/:variantId/options`.
- Se agrega un bloque visible de `Especificaciones` como pendiente operativo: la ficha aun no consume grupos de especificaciones ni selecciones de producto desde BFF.

## Proceso 14: manejo de errores y recuperacion

### Objetivo

Convertir una secuencia distribuida en una experiencia segura.

### Estados por bloque

```text
pending | running | success | failed | skipped
```

Ejemplo:

```json
{
  "catalog": "success",
  "media": "failed",
  "variantMedia": "skipped",
  "pricing": "pending",
  "inventory": "pending"
}
```

### Mensajes esperados

- `Producto creado, pero no se pudieron subir las imagenes.`
- `Imagenes subidas, pero no se pudieron asignar a variantes.`
- `Precio pendiente de guardar.`
- `Stock pendiente de guardar.`

Acciones:

- `Reintentar imagenes`.
- `Reintentar asignacion`.
- `Reintentar precio`.
- `Reintentar stock`.
- `Continuar editando`.

### Regla

No borrar automaticamente datos exitosos por fallos posteriores. Compensaciones destructivas solo con accion explicita del usuario.

### Pruebas de cierre

- Simular fallo en Media despues de crear Catalog.
- Simular fallo en Pricing despues de crear Media.
- Reintentar solo el bloque fallido.
- Verificar que el listado y el detalle no quedan inconsistentes para el usuario.

## Proceso 15: pruebas integrales de la UI

### Casos minimos

1. Crear producto simple sin imagenes, inactivo.
2. Crear producto simple con imagen principal.
3. Cambiar imagen principal.
4. Crear producto con variantes.
5. Asignar imagen distinta a cada variante.
6. Variante sin imagen hereda default.
7. Precio base de producto.
8. Precio override de variante.
9. Stock por variante.
10. Fallo parcial y reintento.
11. Edicion de producto existente.
12. Publicacion bloqueada por faltantes.
13. Publicacion exitosa.

### Comprobaciones obligatorias por proceso

- No romper `GET /admin/products`.
- No romper apertura de producto existente.
- No duplicar variantes al reintentar.
- No duplicar media en relaciones de variante sin reconciliar.
- No publicar producto incompleto.
- No exponer llamadas directas desde UI externa a servicios internos cuando exista o deba existir fachada BFF.

## Resumen de endpoints por capacidad

### Catalog Product

```http
POST /api/v1/admin/products
GET /api/v1/admin/products
GET /api/v1/admin/products/:productId
PATCH /api/v1/admin/products/:productId
```

### Catalog Variant

```http
POST /api/v1/admin/products/:productId/variants
GET /api/v1/admin/products/:productId/variants
PATCH /api/v1/admin/variants/:variantId
DELETE /api/v1/admin/variants/:variantId
```

### Catalog Variant Options

```http
POST /api/v1/admin/variants/:variantId/options
GET /api/v1/admin/variants/:variantId/options
PATCH /api/v1/admin/variants/:variantId/options/:variantOptionId
```

### Media

```http
POST /api/v1/admin/media/collections
POST /api/v1/admin/media/collections/:mediaCollectionId/items
GET /api/v1/admin/media/collections/by-product/:productId
PATCH /api/v1/admin/media/collections/:mediaCollectionId/items/:mediaAssetId
```

### Variant Media

```http
POST /api/v1/variants/:variantId/media
POST /api/v1/variants/:variantId/media/bulk
GET /api/v1/variants/:variantId/media
PUT /api/v1/variants/:variantId/media/main
DELETE /api/v1/variants/:variantId/media
```

### Pricing

```http
POST /api/v1/admin/prices
GET /api/v1/admin/prices
PATCH /api/v1/admin/prices/:pricingId
```

### Offering

```http
POST /api/v1/admin/offerings
PUT /api/v1/admin/offerings/:offeringId/variants/:variantId
DELETE /api/v1/admin/offerings/:offeringId/variants/:variantId
PUT /api/v1/admin/offerings/:offeringId/variants/:variantId/activation
GET /api/v1/admin/offerings/variants/:variantId
POST /api/v1/admin/offerings/variants/resolve-batch
```

### Inventory

```http
PUT /api/v1/admin/inventory/stock-levels
POST /api/v1/inventory/availability/resolve-batch
```

## Nota final para implementacion Next.js

La UI deberia separar:

- componentes visuales;
- estado de borrador;
- clientes HTTP por capacidad;
- orquestador de guardado;
- reconciliacion/recarga post-guardado.

Estructura conceptual:

```text
ProductEditorPage
  ProductEditorShell
  ProductDraftProvider
  ProductSaveOrchestrator
  tabs/
    BasicProductTab
    ProductImagesTab
    ProductVariantsTab
    ProductPricingTab
    ProductInventoryTab
    ProductShippingTab
    ProductSeoTab
```

El orquestador no debe vivir dentro de un componente visual puntual. Debe ser una pieza testeable que reciba un `ProductDraft`, ejecute pasos idempotentes cuando sea posible y devuelva un reporte de estado por bloque.
