# Marcas / Proveedores: patrón de listado y alta lateral — 2026-11-05

Se aplica el patrón ya aprobado para Categorías al componente compartido de
entidades de catálogo. Ambas rutas reutilizan estilos catalogEntityListPage,
catalogEntitySearchForm y catalogEntityActionsPopover, evitando duplicar CSS.

- Crear nueva es un enlace a la derecha y abre AdminResourceDrawer mediante
  drawer=create. Cerrar/Escape conserva búsqueda y estado.
- El formulario mantiene Nombre, Descripción (text), Título SEO (siteTitle),
  Palabras clave y Activa; no añade slug al payload de marca.
- Buscador/estado al 100 %, fondo de cabecera y borde compartidos.
- Edición de nombre/estado en la propia fila con Guardar.
- Acciones … agrupa soft/hard. Hard requiere confirmación; cancelarla no envía
  DELETE. El popover nativo evita recorte por el scroll de la tabla.
- Sin catalog.brands.write o permiso global no se muestran alta, edición ni
  menú; una URL drawer=create tampoco monta el formulario. Autoridad final BFF.

No cambia la lógica de dominio ni el contrato de brands. Se conserva el contexto
Organization/Shop/locale, el cliente BFF y las acciones existentes. El BFF de
prueba modela soft como inactivación solo para verificar el filtro posterior;
no certifica la semántica de borrado del servicio real.

## Validación

- `npm run build`: PASS.
- `npm run lint`: sin errores, 3 advertencias preexistentes ajenas.
- `node --test tests/category-list-actions.test.mjs tests/admin-create-contracts.test.mjs`: 8 PASS.
- Playwright: 7 PASS, entre alta con rechazo/retención de marca y categoría,
  búsqueda, edición en fila, soft/hard, cancelación de hard, permisos y regresión
  de Categorías. Buscador a 1440/768/390 px y foco/Escape del panel comprobados.
- Capturas revisadas del listado, panel y menú. BFF simulado, sin altas ni
  eliminaciones reales. No ejecutados: BFF real, axe completo ni Lighthouse.

```sh
ECOMMIUM_QA_SCREENSHOTS=true npx playwright test tests/e2e/admin-login.spec.ts --grep 'brand list|category list creates|canonical creation (brand|category)|catalog creation is hidden|live catalog read permissions'
```

![Listado y buscador](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/25-brand-search-list.png)

![Alta lateral de marca](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/26-brand-create-drawer.png)

![Menú soft y hard](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/27-brand-actions-menu.png)

![Filtro tras soft simulado](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/28-brand-soft-deleted.png)
