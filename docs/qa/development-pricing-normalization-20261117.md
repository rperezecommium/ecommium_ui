# Barrido de precios de desarrollo — 2026-11-17

Normalización autorizada completada en los owners; no hubo cambios de UI.
Los 25 productos de prueba sin precio de la otra tienda quedaron desactivados,
como indicó el usuario. Tienda Barcelona conserva 1711 productos activos con
precio regular y 1821 variantes activas.

Se corrigieron 500 precios base condicionados a certificación, 21 asociaciones
de variante y 48 destinos inválidos; se añadieron dos respaldos regulares desde
importes existentes y siete referencias derivadas de los datos. No se inventaron
importes ni se ejecutaron borrados de impuestos/tablas, pedidos o facturas.

Pruebas: cinco tests del mantenimiento, 113024 escenarios de dominio sin error,
1821 variantes HTTP correctas y lecturas de ambos contextos en revisión7013,
sin productos afectados pendientes. Repetir el plan propone cero cambios.

El barrido inicial obtuvo 1502/1711 PDP correctas y209 rechazadas con
HTTP414 por slugs de101–138 caracteres. Tras autorización, el BFF admite256;
build, lint dirigido, seis regresiones de límite y24 tests Storefront pasan.
Se reinició únicamente bff-storefront. La prueba real confirmó otro límite de100
en Catalog. Con autorización adicional se corrigió también Catalog y se reinició
solo ese servicio: build, lint dirigido, seis regresiones y cinco E2E pasan.

**Cerrado local para los escenarios verificados:** barrido final3532/3532,
1711/1711 fichas y1821/1821 variantes correctas, cero errores y cero reintentos.
Incluye las209 fichas antes rechazadas, conservando sus slugs y URLs. Salud
Catalog/BFF200; parámetros de257 siguen devolviendo414. Ambos contextos de
lectura conservan revisión7013, sin productos afectados pendientes.

Evidencia detallada y límites en
[el informe del owner Pricing](/Users/ricardoperez/Documents/ecommium/composable_ecommerce/.docs/qa/development-pricing-normalization-20261117.md).
No se repitieron build/lint, axe o responsive de UI porque no hubo cambios de UI.
Esto reduce el riesgo asociado a los datos antiguos; no acredita riesgo cero.
