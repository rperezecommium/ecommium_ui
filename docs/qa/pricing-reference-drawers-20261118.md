# Parámetros de Pricing: tablas y paneles laterales — 2026-11-18

Alcance autorizado: Grupos de cliente, Canales, Políticas comerciales y Países.
Cada sección ocupa una fila completa con tabla de estilo Productos y enlace de
creación alineado a la derecha del título. Se retiran los formularios incrustados.
Cada formulario abre AdminResourceDrawer con identidad estable por tipo; cierre
conserva filtros y guardado usa la Server Action/BFF existente. Acciones de
creación/baja y drawer condicionados al permiso de escritura; query allowlisted.
No se modificó el estándar de resize ni el backend.

Verificación:
- npm run lint:0 errores,3 advertencias anteriores.
- npm run build: PASS, repetido tras el ajuste final de CSS.
- node --test tests/admin-drawer-size.test.mjs:4/4.
- npx playwright test tests/e2e/admin-login.spec.ts -g 'pricing configuration exposes master data' --workers=1:1/1. Abre/cierra los cuatro paneles, crea grupo por BFF, comprueba retorno/lista y navegación a impuestos/tablas.
- Chrome del usuario: listas actualizadas y apertura/cierre de Crear nuevo país verificados sin guardar datos reales.

El primer E2E coincidió con build y falló en login; repetido secuencialmente.
La comprobación posterior de ausencia de inputs se acotó a inputs visibles para
excluir los campos hidden de acciones de baja que se conservan. No se ejecutaron
suite completa, axe, Lighthouse ni matriz responsive en este cambio.

Ajuste posterior solicitado: se retiran las cabeceras redundantes «Price tables
(N)» e «Impuestos (N)». Las tablas conservan nombre accesible. Los enlaces de
creación en Parámetros reutilizan employeesTextAction (azul compartido), sin
reglas de color locales. Lint0errores/3avisos previos y E2E de Parámetros1/1;
build repetido tras incluir Impuestos.
