# Categorías: buscador, alta lateral y menú de acciones — 2026-11-05

## Cambio

Catálogo > Categorías utiliza un enlace Crear nueva a la derecha de la barra.
El formulario se monta solo dentro del panel lateral autorizado, abierto mediante
`drawer=create`. Se reutilizan AdminResourceDrawer (foco inicial, Escape y cierre)
y AdminMutationForm (validación inline, estado pendiente, errores, valores
retenidos ante rechazo y éxito). Al cerrar se conservan q/status del listado.

El buscador ocupa todo el ancho con fondo de cabecera, borde #e2e2e2 y controles
etiquetados. La búsqueda sigue enviando q/isActive mediante el cliente BFF
existente, manteniendo el límite/offset del listado actual. No se añade búsqueda
en cliente sobre una página parcial ni se cambia el contrato.

La tabla adopta employeesWorkspace/adminTable y conserva la edición de nombre y
estado en la propia fila con Guardar. Acciones muestra un botón … con nombre
accesible por categoría. Su popover nativo coloca Eliminar soft y Eliminar hard
en el nivel superior del navegador para evitar recorte por el scroll de tabla.
Escape/clic fuera cierran el popover. Hard mantiene confirmación explícita e
indica irreversibilidad; cancelarla no envía DELETE.

Las dos eliminaciones reutilizan deleteCatalogEntity, con mode=soft|hard, contexto
Organization/Shop/locale y codificación del identificador. La UI no implementa
su semántica de dominio. La prueba simula soft como inactivación para verificar
el retorno al listado filtrado; no certifica el comportamiento del BFF real.

Permisos de creación, edición y borrado conservan catalog.categories.write o
permiso global admitido; el BFF mantiene la autorización final. Marcas conserva
su presentación y alta existentes aunque comparte componente. No se modificaron
backend ni acciones de dominio; no hay dependencias nuevas.

## Verificación

- `npm run build`: PASS.
- `npm run lint`: sin errores; 3 advertencias preexistentes ajenas.
- `node --test tests/category-list-actions.test.mjs tests/admin-create-contracts.test.mjs tests/category-banner.test.mjs`: 9 PASS.
- Playwright, 5 PASS: alta de categoría con rechazo/retención y éxito, alta de
  marca, ausencia de alta sin permiso, ausencia de edición/borrado sin permiso,
  y recorrido búsqueda → abrir/cerrar alta → PATCH en fila → menú → cancelar
  hard → soft → filtro inactivos → hard confirmado.
- Buscador sin desbordamiento a 1440/768/390 px. Foco inicial en Nombre y Escape
  de drawer comprobados. Capturas revisadas visualmente.

Comando E2E:

```sh
ECOMMIUM_QA_SCREENSHOTS=true npx playwright test tests/e2e/admin-login.spec.ts --grep 'category list creates|canonical creation category|canonical creation brand|catalog creation is hidden|live catalog read permissions'
```

BFF simulado de prueba; no se crearon/eliminaron categorías reales. No ejecutados:
integración con servicios reales, axe completo ni Lighthouse/budgets. Se preservan
los límites existentes de paginación y el backlog de seguridad del repositorio.

## Capturas

![Buscador y edición en fila](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/21-category-search-list.png)

![Crear categoría en panel lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/22-category-create-drawer.png)

![Menú de acciones soft y hard](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/23-category-actions-menu.png)

![Filtro tras eliminación soft simulada](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/24-category-soft-deleted.png)

Ampliación posterior autorizada: Marcas / Proveedores adopta este mismo patrón.
Los estilos y el menú se generalizan como catalogEntity*, conservando la regresión
de Categorías. Véase `brand-list-drawer-20261105.md`; la nota anterior sobre
mantener la presentación antigua de Marcas describe el alcance del primer cambio.
