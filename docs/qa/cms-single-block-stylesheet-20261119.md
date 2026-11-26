# Hoja única de estilos de Headers y Footers — 2026-11-19

El constructor ofrece una caja **Estilos del bloque completo**, con las pestañas
Base, Desktop, Tablet y Mobile. Es CSS con selectores, no JSON de un nodo.
`:scope` selecciona la pieza completa; `a`, `button`, clases existentes y
`[data-cms-block="..."]` / `[data-cms-area="..."]` seleccionan su interior.

Se reutilizan del Builder `visualStylePropertyRegistry`,
`isVisualStyleValueSafe`, `visualStyleScopes`, `visualStyleScopeLabels`, el
historial, la serialización del snapshot y el resolver de valores CSS público.
PostCSS 8.5.23 (ya instalado/forzado en el lockfile) se declara dependencia directa
para interpretar reglas CSS; no se añade otro inspector ni un motor visual.

Los editores de estilos por nodo se ocultan en Headers/Footers y la presentación
de los bloques funcionales se dirige a la caja central. La edición de contenido,
árbol y colocación se conserva. Los estilos legacy siguen almacenados/aplicados;
la hoja nueva los puede sobrescribir con selectores. El Page Builder conserva
su inspector existente, del que se extraen las piezas compartidas anteriores.

Persistencia: `revision.layout.styleSheet` es la única propiedad nueva. Contiene
por scope una lista ordenada de `{selector, styles}`, con nombres canónicos del
registro Builder. El textarea se reconstruye de ese modelo al reabrir; no se
promete conservar comentarios, formato textual ni declaraciones duplicadas.
CMS y BFF validan scopes, límites, selectores y valores. El CMS usa el registro
visual existente para normalizar cada declaración. No hay tablas ni rutas nuevas.
La comprobación de recibos de publicación también incluye esta propiedad.

Render: el div raíz de la pieza recibe un ID derivado de identidad/hoja. Cada
selector queda prefijado por ese ID. Las declaraciones usan el resolver público
de módulos visuales y prioridad para sobrescribir los estilos inline existentes.
Base → Desktop → Tablet → Mobile sigue la herencia del Builder; Tablet usa
max-width 1023 y Mobile max-width 767. El canvas puede fijar su scope; Preview usa
el viewport real y la misma representación pública.

El parser rechaza reglas anidadas, at-rules, escapes y combinadores de hermanos
que puedan salir de la pieza. Se admiten tipos, clases, IDs, atributos simples,
descendientes/hijos y hover/focus/focus-visible/focus-within/active/disabled/
checked/first-child/last-child. Las propiedades son las del registro del Builder;
`background` se interpreta como color de fondo. No se admite CSS arbitrario,
URLs, importaciones ni JavaScript. El navegador verifica propiedades/valores y
selectores antes de aplicar. Las imágenes siguen usando los mecanismos Media.

CSS incompleto/invalidado permanece en la caja y bloquea guardar/publicar y el
cambio de pestaña hasta corregirse. Los ámbitos válidos se aplican inmediatamente
al snapshot, canvas y Preview. Undo/redo incluyen la hoja completa. El editor se
reinicia por identidad/locale/revisión persistida, evitando mezclar el estado de
dos cabeceras al cambiar de selección.

Validación:

- UI `npm test`: 739/739; `npm run lint`: 0 errores, 3 avisos previos;
  `npm run build`: correcto.
- CMS: 45 suites, 199/199; build correcto. Incluye JSON roundtrip del layout y
  draft → publish → resolve de la hoja, más rechazo de escapes/CSS inseguro.
- BFF: 8 suites, 47/47 focalizadas; build y ESLint focalizado correctos.
- Chromium: tres tamaños; CSS único, herencia Mobile, color de enlaces internos,
  hover, bloqueo de CSS incompleto, guardar/reabrir, preview sin guardar,
  coincidencia de markup/medidas público, controles axe sin contraste e iframe
  aislado. Acciones de mutación simuladas; no modifica contenido real.

Activación local después de compilar:
`./scripts/postman-services.sh restart-selected cms bff-admin` con Node22.
No se certifica producción, todos los selectores CSS posibles, Lighthouse ni un
recorrido Employee conectado. No se sobrescribe ninguna cabecera existente.
