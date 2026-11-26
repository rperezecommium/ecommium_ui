# Pagos: indicadores de Proveedores y Routing — 2026-11-16

Se retira ConfigurationKpis (Configurados/Activos/Inactivos) exclusivamente de las pestañas Proveedores y Routing. Se elimina su helper y el cálculo local sin consumidores. Tablas, botones, filtros de inactivos, permisos y payloads permanecen iguales; no se cambia configuración comercial ni ningún proveedor/regla.

Validación:8unitarias de PagosPASS, lint0errores/3avisos previos, buildPASS, diff-checkPASS. Playwright contra Admin real:0bloques en ambas pestañas, tabla Proveedores con5filas y Routing con6filas según filtro actual. Solo lecturas, ninguna activación/desactivación o cobro. Logs y respaldos en `/tmp/ecommium-payment-kpis-cleanup-20261116/`.

Ajuste posterior solicitado: se oculta también el control Mostrar/Ocultar inactivos en Proveedores y Routing. No se modifica el filtro por defecto ni sus parámetros/contratos. ESLint focalizado correcto y control ausente en Admin real.
