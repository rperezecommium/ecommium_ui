# Offerings / Servicios — 5 de noviembre de 2026

Aplicado el patrón compartido de Catálogo: buscador al 100 % con fondo y borde,
enlace Crear nueva, creación y edición completa en panel lateral, tabla compacta
y nombre editable en fila con input de 150px. El menú … permite editar o
desactivar con confirmación, conservando el contrato DELETE existente.

La edición del nombre conserva tipo, precio, moneda y estado. La moneda inicial
procede del contexto. Se validan los campos antes de llamar al BFF y se muestran
sus errores. El retorno tras editar conserva los filtros y se limita a esta ruta.
Se corrigió el cierre del popover al abrir el panel, también en Media.

Permisos: controles de gestión condicionados por permisos globales o
catalog.products.write. La referencia local no especifica un grant mínimo
exclusivo de Offerings; queda pendiente contrastarlo con BFF real. El BFF sigue
siendo la autoridad. No se modificó backend.

Validación:

- npm run lint: sin errores; tres advertencias preexistentes ajenas.
- npm run build: PASS.
- node --test tests/offering-list-actions.test.mjs: 3 PASS.
- ECOMMIUM_QA_SCREENSHOTS=true npx playwright test tests/e2e/admin-login.spec.ts --grep 'catalog offerings page manages|offerings list shares|offerings read-only|media catalog page|media library': 6 PASS (3 Servicios y 3 regresión Media).
- Buscador revisado a 1440, 768 y 390px; foco inicial, Escape, confirmación cancelada y solo lectura comprobados.

E2E y capturas usan BFF simulado explícito y build de producción local. No se
verificó backend real, axe ni Lighthouse en este cambio.

## Servicios: buscador y edición en fila

![Servicios: buscador y edición en fila](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/33-offerings-search-list.png)

## Servicios: alta lateral

![Servicios: alta lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/34-offerings-create-drawer.png)

## Servicios: menú de acciones

![Servicios: menú de acciones](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/35-offerings-actions-menu.png)

## Servicios: edición lateral

![Servicios: edición lateral](/Users/ricardoperez/Documents/ecommium_ui/docs/qa/evidence/20261105/36-offerings-edit-drawer.png)
