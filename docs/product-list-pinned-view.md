# Vista fijada de Productos — 2026-10-31

Columnas y tamaño de página se pueden guardar con «Fijar vista», al final de
la barra. «Restablecer vista original» elimina la preferencia, limpia la URL y
regresa a todas las columnas y 20 productos por página. Los cambios posteriores
se guardan únicamente al volver a fijar. Los filtros de negocio, página actual,
productos seleccionados y acciones agrupadas no se persisten.

Preferencia visual local en cookie HttpOnly por empleado, limitada a
`/admin/products`, SameSite=Lax y Secure en producción, con duración de un año.
No sincroniza dispositivos. No contiene productos, tokens ni permisos; no es
fuente de autorización. El schema rechaza columnas desconocidas/duplicadas,
campos extra y tamaños fuera de 1–200. Lectura inválida usa valores originales.
La query explícita tiene prioridad sobre lo fijado, y los enlaces/formularios
incluyen las columnas incluso al seleccionar todas para evitar reaplicar una
preferencia anterior. La lectura inicial sigue en servidor, con paginación BFF.
No se añade JavaScript cliente, carga masiva ni endpoints Next/BFF nuevos.

Validación:

- `npm run lint`: sin errores, tres advertencias preexistentes ajenas.
- `npm run build`: PASS, incluido TypeScript; se corrigió un error inicial de
  narrowing en el schema antes del build final.
- `node --test tests/product-list-view.test.mjs tests/product-bff-scope.test.mjs tests/product-storefront-preview.test.mjs`: 9 PASS.
- Pendientes: Playwright con sesión real, axe, revisión responsive y medición
  Lighthouse. No se accedió al backend ni se hicieron mutaciones de negocio.

No se documenta contrato BFF de sincronización de vistas en la referencia local;
si se requiere persistencia entre navegadores, habrá que acordar ese contrato.

## Separación visual del listado

Búsqueda y filtros se presentan en un formulario superior independiente,
disponible también cuando no hay resultados. Debajo se agrupan el contador,
Columnas, Acciones agrupadas, Ajustes y la vista fijada. La tabla final elimina
la fila de filtros del encabezado y comparte con Equipo sus selectores de
superficie, tipografía, cabecera, celdas compactas, badges y acciones suaves.
Los filtros de categoría, estado, tamaño de página y columnas se conservan en
el formulario GET; se mantienen los contratos y la paginación BFF. Las acciones
agrupadas siguen exigiendo confirmación y nunca se ejecutan desde la búsqueda.
No se añade JavaScript cliente. Regresión focalizada: 9 PASS. Build y lint
ejecutados; pendientes QA visual, responsive, axe y Lighthouse con sesión real.

Barra refinada: contador sin negrita ni márgenes de título, centrado con los
controles. Columnas, Acciones agrupadas y Ajustes conservan iconos, con texto
subrayado sin caja. Menús abiertos por hover de ratón o clic/teclado; Escape
cierra y devuelve foco al disparador. Un puente de 6px mantiene el hover al
entrar al panel. Fijar/restablecer conservan botones. Componente cliente pequeño
aislado para los menús; tabla y lecturas continúan en servidor. Build PASS,
lint sin errores (tres warnings ajenos), regresión focalizada 7 PASS. Interacción
visual y accesibilidad en navegador pendientes.
