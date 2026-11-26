# Indicador de salud Admin — 2026-11-04

## Resultado
Corregido exclusivamente en la UI. La respuesta HTTP y la salud operativa se evalúan por separado. No se modificó el backend ni se detuvieron servicios.

| Evidencia recibida | Estado mostrado |
| --- | --- |
| `status: ok/healthy`, sin señales de fallo | OK |
| Error explícito, readiness falsa, consumidor requerido deshabilitado/desconectado o comprobación fallida | Degradado |
| Servicio declara down/unavailable/offline o falla la petición | No disponible |
| Respuesta vacía, inválida o solo configuración; consulta 401/403/429 | Sin confirmar |
| Falta Organization/Shop para Search | Pendiente |

## Causa y alcance
El normalizador anterior daba OK por defecto a estados desconocidos. Analytics también usaba el éxito HTTP como prueba de salud. Por ello un HTTP 200 con error podía incrementar el contador de servicios correctos y ocultar una degradación. Ambos indicadores comparten ahora la misma evaluación, aplicada antes de descartar campos del payload. Los fallos explícitos tienen prioridad sobre `status: ok`. Los mensajes del payload no se imprimen como errores crudos.

La lectura real del BFF confirmó Analytics, Automation, Communications y After Sales como OK. Search respondió 200 con configuración (`provider`, `projectId`, `catalog`, `servingConfig`, `placement`), sin señal de salud; queda **Sin confirmar**, sin afirmar que esté caído. La UI no puede deducir salud operativa de esa configuración.

## Verificación
- `npm test`: 556 pruebas aprobadas.
- `npm run lint`: 0 errores; 3 advertencias preexistentes en customers-admin-actions, request-client e invoice-document-pdf.
- `npm run build`: aprobado.
- `npx playwright test tests/e2e/admin-login.spec.ts --grep 'health indicator|Analytics health badge' --workers=1`: 4 escenarios aprobados. Se simulan errores sin interrumpir servicios reales; se verifica también ausencia de marcador de traza interna.
- Navegador contra BFF real: cuatro OK y Search Sin confirmar. Sesión cerrada al terminar; ninguna mutación de negocio.
- Panel revisado a 1440, 768 y 390 px: sin desbordamiento y sin infracciones axe dentro del panel. Ajuste localizado de contraste y distribución; no es una auditoría de accesibilidad global.
- Sin certificación Lighthouse ni carga/performance en producción; el cambio conserva las consultas existentes en paralelo y no añade peticiones.

## Artefactos y limpieza
No se crearon empleados, tiendas ni otros datos de negocio. Se conservan scripts de prueba, registros sanitizados y captura en `/private/tmp/import-ui-review/health-*`, disponibles para retirar cuando se ordene. Los tests y esta evidencia forman parte de la corrección del repo, no son datos temporales.
