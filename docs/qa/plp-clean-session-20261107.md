# Recorrido PLP con sesión limpia — 2026-11-07

## Método y alcance

Prueba local de diagnóstico, sin cambiar código ni datos. Ventana/contexto Playwright aislado `plp-clean-20261107`, navegación inicial desde Home en localhost5173, sin sesión Admin/Customer ni almacenamiento compartido con la pestaña anterior. Se comprobó sólo cookie técnica de consentimiento `ec_consent_subject` (nombre, nunca valor). No se reinició el BFF ni se vació su caché: cliente limpio no significa servidor frío.

Se visitaron las16 rutas publicadas en navegación/lista de categorías. Se esperó networkidle antes de contar tarjetas. Un sondeo preliminar que no esperaba la finalización de App Router se descartó; el JSON conserva sólo el recorrido con navegación completada.

Se probaron clics y página2 de bicicletas/componentes y tres reentradas a BikerShop. Además se hicieron dos vueltas secuenciales de16 consultas públicas al BFF3025, resolviendo primero el contexto por `/storefront/context/resolve?host=localhost:5173`. Contexto Barcelona, es-ES, EUR, ES, web. Todas las consultas comerciales pasan por BFF; no se leyeron BDs/servicios de dominio directamente.

Evidencia detallada: [JSON](plp-clean-session-20261107.json). Los tiempos son elapsed de automatización local (incluyen espera networkidle/desarrollo); no son LCP, TTFB ni percentiles de producción.

## Resultados

| Categoría / sufijo identificador cuando se repite nombre | Primera visita | Productos que después confirma BFF |
| --- | --- | ---: |
| Bike Brakes | Carga | 20 |
| Bike Cockpit | Carga | 20 |
| Bike Drivetrain | Carga | 20 |
| Bike Workshop | Carga | 20 |
| BikerShop /9f92d709 | Estado vacío | 0 |
| Electrónica bike /c1d21059 | Carga | 1 |
| Nutritiom-pro | Carga | 10 |
| nutritions | Carga | 20 |
| bicicletas /013320a6 | Carga | 500 |
| BikerShop /a7371a92 | Error transitorio visible | 239 |
| Ropa ciclismo | Carga | 44 |
| Accesorios y componentes | Carga | 25 |
| Zapatillas carretera | Carga | 37 |
| Electrónica bike /c62f610e | Carga | 109 |
| Zapatillas MTB | Carga | 46 |
| componentes /861c66b1 | Carga | 600 |

Bicicletas y componentes:16 tarjetas en página1 y16 en página2, tanto entrada directa como clic; ningún estado de error. Primera navegación completada:1778ms y1534ms respectivamente; entrada por clic caliente424ms en ambas. En las32 consultas repetidas al BFF:32 HTTP200, máximo404ms y `X-PLP-Source: readindex` en todas. Se observaron miss/hit de caché; no se confunden respuestas cacheadas con SQL nuevo.

## Hallazgos y límites del diagnóstico

1. **Fallo transitorio reproducido en BikerShop /a7371a92.** Primera página muestra “No se pudo cargar el listado / El servicio no está disponible temporalmente” tras2949ms, aunque el documento UI devuelve HTTP200. Tres reentradas posteriores cargan16 tarjetas; BFF devuelve239 productos. No hay prueba de rotura permanente del slug ni de ausencia de productos.
2. **El error queda enmascarado en SSR.** `plp.ts` conserva status/correlationId en su resultado, pero `plp-page.tsx:52-61` sólo renderiza mensaje genérico y ruta. El navegador no observa la petición SSR al BFF y un monitor que mire únicamente el200 de la página no detectaría el fallo. No se capturó el código/status BFF de aquel primer fallo; no se atribuye como hecho a503 o a un código ReadIndex concreto.
3. **Posible timeout/capacidad, sin causa exacta certificada.** El lector BFF→ReadIndex tiene timeout predeterminado3000ms, máximo4 lecturas simultáneas y códigos separados para busy/timeout/HTTP upstream/respuesta inválida. El tiempo observado es compatible con una demora transitoria, pero no basta para demostrarla. Los logs disponibles consultados no permitieron correlacionar aquel primer fallo. No se aumentan timeouts ni se implementa fallback por suposición.
4. **Dos BikerShop distintas en navegación.** /9f92d709 responde correctamente con0, /a7371a92 con239. Los nombres iguales pueden parecer resultados inconsistentes aunque son categorías distintas. Hace falta revisar la intención editorial/jerarquía antes de ocultar o renombrar. La vacía no demuestra falta de proyección ni que existan productos elegibles ausentes.
5. **ReadIndex interviene de verdad.** Flag UI `ECOMMIUM_STOREFRONT_PLP_READ_INDEX_ENABLED=true` envía view=cards; BFF responde source=readindex. Flujo: navegador→Next SSR→Storefront BFF→caché/ReadIndex. Catalog/Pricing/Inventory/Media alimentan proyecciones mediante eventos. Si relay/worker están parados, las lecturas pueden seguir contestando con datos antiguos; si la API/consulta ReadIndex falla, BFF puede rechazar la PLP. Son fallos diferentes.
6. **Estado operativo actual.** Consumidor recuperado en la tarea anterior: ready=true,129 eventos aplicados,2 en vuelo,0 retry/DLQ nuevos en sus contadores. Sigue trabajo acumulado y hay estados históricos pendientes; no se certifica salud global ni lag cero. La parada anterior explica el desfase previamente demostrado de características, pero no prueba que fuese la causa exacta de todos los fallos históricos de PLP.

## Siguiente corrección sugerida

Conservar correlationId y códigos públicos acotados en la observabilidad SSR; mostrar opción Reintentar y referencia sin trazas/secretos; monitorizar el estado funcional de PLP además del HTTP de la página. Capturar la próxima ocurrencia con código BFF y métricas de admisión/timeout ReadIndex antes de cambiar políticas. Revisar las dos categorías BikerShop y sus jerarquías/publicación. No se aplican estos parches porque la petición actual es de diagnóstico/test.

## Comandos y pruebas

- Playwright MCP: browser_tabs(new, isolatedContext), browser_run_code_unsafe con page.goto(networkidle), clics, waitForURL, contadores DOM y page.request.get al BFF público.
- Inspección local: rg/sed/nl de plp.ts, plp-page.tsx, plp-cards-contract.ts y lectores/config BFF; lectura acotada de métricas JSON de worker/relay previamente recuperados.
- No se ejecutó npm lint/build ni suite aislada: no se cambió código de aplicación.
- No se hicieron pruebas de carga, compra, a11y, mobile ni Lighthouse. Recorrido desktop local funcional y diagnóstico de contratos; no certifica performance de producción.
