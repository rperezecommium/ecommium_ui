# @ecommium/cms-blocks

Catalogo compartido de bloques CMS para Admin, Storefront y el CMS Block Builder.

Este paquete define tipos, presets, normalizacion, metadata de editor, helpers de serializacion y renderers React compartidos. No llama al BFF ni contiene estado de aplicacion; consume y produce el contrato CMS renderizable que llega desde `apps/bff`.

`src/react.tsx` expone el renderer comun para Storefront y preview Admin. Las apps pueden pasar adaptadores para media/enlaces cuando necesiten integrarse con Next.js u otra plataforma.

## Responsabilidades

- Definir `CmsBlock`, superficies `page`/`plp`, placements y targets PLP.
- Definir `CmsVisualNode` como modelo de arbol libre para el bloque
  `visual.module`.
- Exponer presets con `createCmsBlockFromPreset`.
- Exponer metadata de editor en `editorFields` para construir inspectores visuales.
- Normalizar imports legacy o externos con `normalizeCmsBlock` y `blocksFromJson`.
- Serializar exports con `blocksToJson`.
- Renderizar previews con `CmsBlockRenderer` y `CmsPlpStorefrontPreviewRenderer`.

## Contrato para builders externos

Un builder externo puede vivir fuera de la UI siempre que importe este paquete o
mantenga el mismo contrato JSON. La salida portable debe ser un array `CmsBlock[]`
con esta forma minima:

```json
[
  {
    "blockId": "hero-main",
    "type": "banner.hero",
    "placement": {
      "region": "main",
      "areaId": "main-default",
      "columnIndex": 1,
      "order": 1,
      "align": "stretch",
      "spacing": {},
      "visibility": { "mobile": true, "tablet": true, "desktop": true },
      "containerMode": "inherit"
    },
    "props": {
      "surface": "page",
      "placement": "main",
      "heading": "Titulo",
      "body": "Contenido"
    },
    "children": []
  }
]
```

Reglas de compatibilidad:

- No exportar HTML como fuente de verdad; exportar siempre `CmsBlock[]`.
- Resolver valores visuales a props y placements, no a CSS global ad hoc.
- Usar `editorFields` como schema minimo de edicion.
- Para bloques de pagina, `placement.region`, `areaId`, `columnIndex` y `order`
  deben apuntar a un slot valido del `resolved-settings`.
- Para bloques PLP, `props.placement` debe ser `beforeList` o `afterList` y
  `props.target` debe identificar `routePath` o `categorySlug`.
- Ejecutar `blocksFromJson` antes de preview/save para normalizar datos legacy.

## Modelo visual libre

El contrato legacy para construir modulos libres es `CmsVisualNode`. Un modulo
visual no se describe como HTML suelto, sino como un arbol JSON controlado:

```json
{
  "schemaVersion": 1,
  "name": "Hero libre",
  "tree": {
    "nodeId": "root",
    "type": "container",
    "styles": {
      "paddingTop": "72px",
      "paddingBottom": "72px"
    },
    "children": [
      {
        "nodeId": "headline",
        "type": "heading",
        "props": { "text": "Titulo editable" },
        "styles": { "fontSize": "64px", "fontWeight": "800" }
      },
      {
        "nodeId": "cta",
        "type": "button",
        "props": { "text": "Comprar", "href": "/categoria" },
        "styles": { "marginLeft": "20px" }
      }
    ]
  }
}
```

Tipos iniciales de nodo:

- Layout: `container`, `section`, `div`, `grid`, `flex`, `spacer`.
- Texto: `heading`, `paragraph`, `richText`.
- Media/accion: `image`, `button`, `link`, `icon`, `video`, `htmlEmbed`.

`visual.module` ya existe como preset portable de pagina y se guarda dentro del
`CmsBlock[]` normalizado del draft. Sus props usan `schemaVersion`, `name` y
`tree`; `blocksFromJson` normaliza el arbol con
`normalizeCmsVisualModuleProps` y `normalizeCmsVisualNode`.

El Admin Builder puede guardar visual presets versionados a partir de cualquier
`visual.module`. Esos presets almacenan el `tree` normalizado de
`CmsVisualNode` y se aplican remapeando ids antes de insertar o reemplazar un
modulo. La implementacion inicial vive en `localStorage`; si se requiere
colaboracion multiusuario, el BFF deberia exponer persistencia compartida de
presets usando este mismo contrato.

Desde la implementacion 9/12 de ADR-0147, esos presets locales se etiquetan con
metadata compatible con un artefacto `VisualModuleDefinition`: `definitionId`,
`moduleId`, `schemaVersion=2`, `schemaMinorVersion`, `revision` y lifecycle
`DRAFT|ACTIVE|ARCHIVED`. La UI conserva compatibilidad con presets antiguos y
los normaliza a `ACTIVE` revisionado hasta que el BFF exponga persistencia
compartida.

Cada nodo puede declarar `props`, `styles`, `responsiveStyles` por
`mobile`/`tablet`/`desktop` y `children`. El renderer recursivo y el editor
visual usan el mismo contrato para preview, import/export y guardado.

Los nodos visuales pueden declarar `contentBinding` para separar el diseño del
contenido de la instancia. El modulo define `contentSchema` y cada bloque/pagina
rellena `contentValues`; el renderer aplica esos valores sobre `text`, `html`,
`src` o props equivalentes sin cambiar estilos ni estructura.

`visual.module` v2 agrega el contrato canonico para el Builder reactivo:
`moduleId`, `styles` por scope `base/mobile/tablet/desktop`, `panels[]`,
`elements[]`, `contentSchema`, `contentValues`, `assetRefs`, `visibility` y
`animation`. El renderer compartido detecta `schemaVersion=2`, convierte tokens
`var:scale.key` a valores CSS seguros de preview, resuelve
`backgroundImage: asset:key` contra `assetRefs`, aplica visibilidad responsive y
motion controlado con `prefers-reduced-motion`, y renderiza modulo -> paneles ->
elementos con el mismo `CmsBlockRenderer` usado por Admin Preview y Storefront.
Las paginas v1 siguen normalizandose con `props.tree` hasta que la migracion del
Builder sea completa.

Para rollout, el Builder puede usar
`NEXT_PUBLIC_ECOMMIUM_CMS_VISUAL_MODULE_V2_ROLLOUT=disabled|beta|default`.
`disabled` conserva guardado v1; `beta/default` deben llamar a
`migrateCmsVisualModuleV1ToV2ForRenderer` antes de persistir para enviar un
payload v2 con `moduleId`, `panels[]` y `elements[]`.

## Validaciones esperadas en UI

El Admin Builder valida campos requeridos, ids duplicados, slots inexistentes,
visibilidad vacia, ordenes duplicados por slot y targets PLP incompletos. Un
builder externo deberia aplicar las mismas reglas antes de exportar. Para
`visual.module` tambien debe advertir imagenes sin alt text/content binding,
acciones sin link seguro, ausencia de heading renderizable y animaciones largas.
La certificacion canonica se ejecuta desde el repo backend con
`node scripts/cms-visual-module-builder-certification.mjs`.
