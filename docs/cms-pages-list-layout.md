# CMS Páginas: listado compartido con Productos

2026-11-03. El modo listado reutiliza productListPage, búsqueda independiente,
barra compacta con total y contexto tienda/locale, y tabla con densidad y acciones
comunes. Crear página se presenta como enlace de texto superior derecho;
conserva el formulario lateral existente. Buscar y Limpiar filtros mantienen
locale. No se altera el editor, contratos BFF ni publicación/eliminación.

Validación: `node --test tests/cms-admin.test.mjs` (13 PASS), `npm run lint`
y `npm run build`. Pendiente Playwright con sesión real, revisión visual,
responsive, axe y Lighthouse. Sin acceso ni cambios al repositorio backend.
