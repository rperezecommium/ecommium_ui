# Compacta — estándar de tablas Admin

Estado: referencia obligatoria. Aprobado por el usuario el 19 de noviembre de
2026. Nombre de invocación: **Compacta**.

Cuando el usuario diga «dale los estilos Compacta a esta tabla», «aplica Compacta»
o una expresión equivalente, aplicar este documento completo al listado indicado.
No basta con aproximar su aspecto o añadir solo una clase a `<table>`.

## Referencia y alcance

La referencia visual y de implementación es el listado de Productos:

- [Listado de Productos](../src/modules/catalogo/product-list-page.tsx).
- [CSS compartido vigente](../app/globals.css).
- [Biblioteca CMS adaptada](../src/modules/cms/cms-site-parts-page.tsx).

Compacta comprende contenedor, herencia tipográfica y de variables, tabla,
cabecera, filas, enlaces, badges, acciones y estados de interacción. Es un
estándar de presentación; no autoriza a crear/eliminar columnas, datos, filtros,
paginación, acciones, permisos o funcionalidades de dominio. La cantidad y el
ancho de columnas dependen del listado. Conservar los contratos BFF existentes.

El nombre **Compacta** es el nombre del estándar. Actualmente no existe una clase
`.compacta` ni un componente `CompactaTable`: las clases reales son las indicadas
abajo. No crear una copia del CSS con otro nombre para cada módulo.

## Estructura obligatoria y herencia

Usar las capas existentes, completas:

| Capa | Clase / regla |
| --- | --- |
| Ámbito de estilo | `productListPage`, con las variables y estilos de acciones/badges heredados |
| Superficie del listado | `productListGrid` |
| Desplazamiento | `adminTableScroller productListTableScroller` |
| Tabla | `adminTable productListTable` |
| Nombre principal | `productListNameCell` y enlace cuando existe una ruta de edición/detalle |
| ID/números | `productListIdCell` / `productListNumericCell` |
| Acciones de fila | `productListActions` |
| Estado | `adminBadge` más la variante semántica existente |

Si toda la página ya usa `productListPage`, el listado solo necesita
`productListGrid`. Si únicamente debe cambiar una tabla, limitar `productListPage`
al contenedor de ese listado, como en Biblioteca CMS; no propagar la apariencia
a formularios, pestañas, drawers o botones ajenos a la petición.

```tsx
<section
  className="productListPage productListGrid"
  aria-label="Listado de recursos"
>
  <div className="adminTableScroller productListTableScroller">
    <table className="adminTable productListTable">
      <thead>
        <tr>
          <th scope="col">Nombre</th>
          <th scope="col">Estado</th>
          <th scope="col">Acciones</th>
        </tr>
      </thead>
      <tbody>{/* Filas y acciones reales del módulo. */}</tbody>
    </table>
  </div>
</section>
```

La superficie tiene ancho 100%, `min-width: 0`, fondo transparente, margen y
padding propios 0, sin borde exterior de tarjeta, radio exterior ni sombra.
Mantener las capas de overflow para que la tabla no ensanche la página.

`productListPage` contiene también reglas de página (por ejemplo padding
14px 16px 32px). No trasladar accidentalmente ese padding al interior de una
tabla embebida: comprobar la cascada con `productListGrid` y, cuando haga falta,
resolver el espaciado en la clase local del contenedor. Biblioteca usa
`.cmsSitePartLibrary.productListPage { padding: 0; }`.

## Variables y tipografía efectivas

Estos valores ya existen en el ámbito compartido. Heredarlos de sus clases;
no copiarlos como nuevos colores literales en cada módulo.

| Variable | Valor actual |
| --- | --- |
| `--admin-text` | `#0b0b0b` |
| `--admin-text-muted` | `#52514e` |
| `--admin-border` y `--admin-border-subtle` | `#d9d8d3` |
| `--product-list-header-bg` | `#efefec` |
| `--team-positive` | `#28623b` |
| `--team-info` | `#245b91` |
| `--team-warning` | `#805500` |
| `--team-danger` | `#a12d2d` |

Fuente: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial,
sans-serif`. Base del ámbito 13px y line-height 1.45. Es una variante acotada del
Admin; no cambia la tipografía o paleta global del resto de pantallas.

## Tabla, encabezado y filas

Aplicar los valores **efectivos de la cascada**, no las primeras reglas antiguas
que coincidan en globals.css.

| Propiedad | Regla Compacta |
| --- | --- |
| Tabla | Width 100%, min-width 0 en el listado compartido, border-collapse collapse |
| Fondo de tabla/celdas | Transparente |
| Padding de `th` y `td` | 5px vertical, 8px horizontal |
| Alineación | Izquierda por defecto; vertical-align middle |
| Altura de celdas | Auto, según contenido; no fijar 58px |
| Cabecera | Fondo `--product-list-header-bg`, texto `--admin-text-muted` |
| Tipografía de cabecera | 11px, peso 600, uppercase, letter-spacing .03em |
| Borde de cabecera | Sin borde superior; borde inferior 1px `--admin-border` |
| Cuerpo | 13px, texto `--admin-text`, line-height 1.45 |
| Divisores de filas | Borde inferior 1px, tono vigente `#d9d8d3` |
| Hover de fila | Fondo `--admin-surface-muted` |
| Zebra / sombras | No añadir franjas alternas ni sombras a las filas |

No usar el borde azul inferior de 2px ni la altura 58px de las reglas antiguas
`.productListTable`: `productListGrid` las sustituye. Tampoco forzar el min-width
1260px de la regla base a un listado pequeño: el ámbito compartido permite
min-width 0. Una fila con un botón de 32px suele medir aproximadamente 43px por
padding y divisor; es una consecuencia del contenido, no una altura obligatoria.

## Contenido de las celdas

- Nombre: enlace `productListNameCell a`, peso **400**, color `--admin-text`, sin
  subrayado normal. En hover, color `--admin-primary-pressed` y subrayado.
- No añadir `<strong>` para simular una jerarquía que Productos no tiene.
- No añadir un UUID/subtítulo técnico debajo del nombre como parte del estilo.
  Conservar los datos necesarios del módulo; si el ID ya tiene una columna
  propia, no eliminarla. En Biblioteca CMS el UUID permanece en el title del enlace.
- ID y números: usar las clases de ID/números; `font-variant-numeric: tabular-nums`
  y `white-space: nowrap`. Estas clases **no** fuerzan alineación a la derecha.
- Selección, si existe: `productListSelectCell`, ancho 38px y centrado. Sus
  checkboxes conservan width auto/min-height auto y etiqueta accesible.
- Imagen, si existe: `productListThumb`, 36 × 36px. No añadir columnas de imagen
  a módulos que no las tengan.
- Conservar formatos de dinero, fechas, locale y estados propios del módulo.

## Badges

Dentro del ámbito `productListPage`:

- Display inline-flex, centrado horizontal y vertical.
- Min-height 20px, padding 0 6px, radio 4px.
- Fuente 12px, peso 600, line-height 18px.
- `adminBadgeOk`: semántica positiva, `--team-positive`.
- `adminBadgeWarn`: advertencia/inactivo según el contrato del módulo,
  `--team-warning`.
- `adminBadgeError`: error, `--team-danger`.
- Borde 1px con `color-mix(in srgb, <tono> 38%, var(--admin-surface))`.
- Fondo con `color-mix(in srgb, <tono> 8%, var(--admin-surface))`.
- Texto del mismo tono semántico. Conservar la etiqueta de negocio real.

No usar `adminBadgeSuccess`/`adminBadgeWarning` como sustitutos visuales del
patrón anterior. No asumir que dos módulos comparten el significado de ACTIVE,
publicado, visible o asignado: el estilo no redefine esos estados.

## Acciones y estados de interacción

Contenedor `productListActions`: inline-flex, align-items center, gap **6px**,
white-space nowrap. Las acciones son las existentes del módulo, sujetas a sus
permisos y estados; no incorporar acciones de Productos que no apliquen.

| Propiedad | Valor |
| --- | --- |
| Display del botón/enlace | Inline-flex, centrado en ambos ejes |
| Min-height | 32px |
| Padding | 4px 10px |
| Borde | 1px, mezcla del tono 38% con `--admin-surface` |
| Radio | 4px |
| Fondo | Mezcla del tono 8% con `--admin-surface` |
| Texto | Tono semántico, fuente heredada, 13px, peso 600, line-height 22px |
| Sombra | Ninguna |
| Iconos dentro de acciones | 12 × 12px efectivos mediante CSS compartido |

Variantes existentes: `adminButton employeesActionInfo` para información/editar;
`employeesActionWarning` para advertencia; `employeesActionPositive` para éxito;
`adminButton adminButtonDanger` para eliminación. Usar `--team-action` y las
reglas compartidas; no reconstruir colores a mano.

- Hover habilitado: borde mezcla 62%, fondo mezcla 14%, texto mantiene el tono.
- Focus visible: outline 2px `--admin-focus-ring`, offset 3px.
- Disabled: opacity .55, cursor not-allowed; conservar la condición real.
- Editar como Productos: icono Pencil con `title="Editar"` y texto accesible
  `adminVisuallyHidden` que identifica la entidad. El SVG puede declararse de
  16px en JSX: la regla compartida de acciones lo representa a 12px.
- Productos tiene una acción Eliminar textual y otras acciones con iconos.
  Compacta no significa convertir todos los botones a icon-only. Mantener las
  confirmaciones y bloqueos de uso del módulo; nunca eliminar con un solo clic.
- Fuera de las filas, los botones/modal/drawer siguen su estándar correspondiente.

## Separación, títulos y responsive

El margen superior no define Compacta. Mantener el espaciado solicitado para el
módulo. **Biblioteca de Headers/Footers tiene margin-top: 30px** por instrucción
expresa, badge «Biblioteca» sin contador y tabla sin título/subtítulo repetidos.
Estas tres decisiones son locales a Biblioteca, no una orden de eliminar todos
los títulos y contadores de otras tablas.

Conservar overflow-x auto y ancho 100% del scroller, box-sizing border-box y
scrollbar-gutter auto dentro del listado. La barra horizontal existente mide
10px; pista `--admin-surface-muted`, thumb `--admin-border`, borde 2px con el tono
de la pista y radio 4px. Evitar overflow horizontal de la página completa.

Comprobar escritorio 1440px, tablet 768px y móvil 390px. La tabla mantiene su
estructura semántica y sus acciones; si no cabe, se desplaza su scroller. No
convertirla en tarjetas, ocultar columnas ni reducir tipografía automáticamente
solo por aplicar Compacta. Conservar la configuración de columnas del módulo.

## Procedimiento obligatorio al aplicar Compacta

1. Leer esta guía y la tabla de Productos actual, incluyendo ancestros y CSS
   compartido. Localizar overrides propios de la tabla destino.
2. Mantener lectura/mutaciones, permisos, contexto, columnas y acciones de negocio.
3. Aplicar la estructura/clases completas, variables heredadas, tipografía,
   densidad, badges, botones y estados anteriores.
4. Retirar o acotar overrides locales que impidan la equivalencia. No tocar la
   tabla de Productos ni modificar estilos globales para arreglar solo un módulo.
5. Respetar el margen/título/contexto solicitados; conservar empty/loading/error,
   encabezados scope=col, foco y nombres accesibles de las acciones.
6. Comparar estilos **calculados** en navegador, no solo className: font-family,
   font-size, font-weight, line-height, letter-spacing, text-transform, color,
   background-color, cuatro paddings, border-bottom color/ancho, border-radius,
   min-height y height; comprobar hover, focus y disabled cuando existan.
7. Validar esos valores en th, td, nombre, badge y botones, además de ancho,
   desplazamiento y ausencia de sombras/bordes exteriores. Comparar en los tres
   tamaños. No exigir igual ancho de columnas o igual alto si cambia el contenido.
8. Ejecutar las comprobaciones exigidas por AGENTS.md apropiadas al cambio y
   documentar alcance/limitaciones. No afirmar «igual al 100%» solo por reutilizar
   productListTable.

La Biblioteca CMS sirvió como comprobación inicial: 17 propiedades calculadas
comparadas en tres tamaños sobre fixtures, con herencia de botones/badges y
margen 30px. Esto es evidencia del caso comparado, no certificación de cualquier
módulo ni de todas sus interacciones.

Si se cambia el estándar de Productos/Compacta, actualizar esta guía junto con
los estilos compartidos y sus referencias. No cambiar silenciosamente las cifras
para justificar una implementación divergente. Las instrucciones explícitas del
usuario prevalecen; aplicar y registrar sus excepciones de forma local.
