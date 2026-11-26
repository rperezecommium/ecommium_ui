# Ficha cliente: retirada de indicadores repetidos — 2026-11-16

Se eliminan los bloques adminSummaryGrid de Facturación/Comunicaciones/Soporte/Privacidad/Backoffice y PurchasesKpiPanel de Compras, como el bloque marcado en la captura. Se retiran únicamente sus helpers/imports sin consumidores. Tablas de facturas/pedidos, formularios, listas y acciones conservan los mismos datos, permisos y contratos. La ficha principal de Resumen y los datos de detalle no se sustituyen ni se vacían.

Validación:17unitariasPASS, lint0errores/3avisos previos, buildPASS; E2E existente de Clientes1PASS con BFF simulado. Comprobación de lectura contra BFF real en las seis pestañas:0bloques KPI y tablas de detalle presentes. Sin guardar cambios del cliente ni alterar servicios. Respaldos y logs: `/tmp/ecommium-customer-kpis-cleanup-20261116/`.
