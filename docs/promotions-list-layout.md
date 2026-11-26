# Promociones: disposición compartida con Productos

Fecha: 2026-11-03.

La pantalla reutiliza las clases de página, búsqueda, barra y tabla de Productos.
Crear cupón ocupa la acción superior derecha como enlace de texto. Los filtros
GET quedan en un bloque independiente, seguido por contador, resumen compacto
y contexto de tienda/locale. Se eliminan las tarjetas de resumen que desplazaban
la tabla; la ayuda de precios de catálogo queda plegada al final. Tabla, badges
y acciones heredan la densidad y superficies existentes. El formulario lateral
y las confirmaciones de desactivación/eliminación se conservan.

No se añaden llamadas BFF, dependencias ni componentes cliente; se mantiene el
contrato de cupones y el filtrado existente. No se simulan paginación ni acciones
masivas sin contrato. Los hallazgos de seguridad pendientes se conservan.

Validación ejecutada:

- `node --test tests/promotions-admin.test.mjs tests/promotions-navigation.test.mjs`: 3 PASS.
- `npm run lint`: 0 errores, 3 advertencias preexistentes ajenas.
- `npm run build`: PASS, incluido TypeScript.
- `git diff --check`: PASS.

Pendientes: Playwright con sesión real/BFF, revisión visual desktop/tablet/móvil,
axe y medición Lighthouse. No se ha iniciado ni inspeccionado el repo backend.
