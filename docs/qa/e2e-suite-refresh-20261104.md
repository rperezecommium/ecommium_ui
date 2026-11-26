# Suite E2E actualizada — 2026-11-04

## Alcance
Solo infraestructura y escenarios de prueba de ecommium_ui. Sin cambios de
producto, backend, permisos reales ni datos de negocio. Los recorridos usan BFF
simulados en puertos locales efímeros; no sustituyen una certificación live.

| Desfase encontrado | Corrección |
| --- | --- |
| Password coincidía también con Mostrar password | Selector del input por nombre |
| Claim renombrado y ayuda incluida en nombre accesible | Selector del input claim; se conserva test de campos etiquetados |
| Onboarding esperaba un título/KPI retirados | Formulario y fila de contexto activo actuales |
| Imagen lazy fuera de vista | Localizar imagen en detalle, desplazarla a vista y comprobar decodificación y petición BFF |
| Mock de salud incompleto rompía Communications | channels.email completo, sin interferir con los casos de degradación |
| Plantillas plegadas, preview JSON retirado y readiness nueva | Abrir sección como usuario, usar editor actual y respuesta de preview contractual |
| Clientes esperaba drawer monolítico e IDs como texto | Referencia humana y pestañas Perfil/Compras; conservar validación de permisos, direcciones, pedido y llamadas BFF |
| Fixed price esperaba formulario inline y consultas de otras pestañas | Abrir Fijar precio; verificar payload guardado y lectura de precios sin exigir lectura de reglas ajenas |
| Transporte esperaba inactivos/reactivación retirados el30-10 | Verificar desactivación y desaparición, una sola mutación y ausencia del parámetro retirado |
| Mock checkout sin claims de permisos | JWT sintético limitado a checkout.configuration.write, consistente con auth/me; ninguna ampliación a wildcard |
| Mocks públicos sin resolver contexto y portada antigua / | Resolver contexto explícito y portada CMS /home |
| HTTP mock incompatible con runtime producción | HTTPS loopback con CA exclusiva del test; no se desactiva TLS ni se fuerza NODE_ENV development |
| Next dev competía con el servidor de desarrollo | Todos los escenarios usan la compilación y procesos Node hijos directos |

## Ejecución
`npm run test:e2e` compila y ejecuta todos los escenarios. Para repetir sobre
la compilación existente: `npx playwright test --reporter=line`.
El setup falla con instrucción clara si no existe `.next/BUILD_ID`. Un worker
por defecto limita memoria y mantiene secuencia; no se añaden retries para
ocultar fallos. Las acciones tienen timeout10s y los probes de readiness
peticiones con timeout2s y pausa entre intentos. Storefront espera health local,
no el contenido del caso que todavía no ha preparado. Hay trazas y logs
acotados del servidor para fallos. CI rechaza test.only.

Las comprobaciones siguen verificando comportamiento y peticiones/payloads:
no se desactivaron casos ni se introdujeron skips para obtener verde.

## Evidencia y límites
Pasada completa final: **96/96 aprobadas en45,2s**, sin omitidas ni retries.
`npm run test:e2e` produjo build correcto durante la verificación; la pasada
final se ejecutó con `npx playwright test --reporter=line` sobre ese build.
`npm run lint`:0 errores/3 advertencias preexistentes. `npx tsc --noEmit`:
aprobado. `npm test`:557/557 aprobadas.
No se certifican servicios reales, carga, performance ni accesibilidad global
por esta actualización de la suite. Se conservan los tests responsive existentes.

Logs de diagnóstico y ejecución: `/private/tmp/import-ui-review/e2e-*`.
Trazas locales: `test-results/` (ignorado por git). Estos son artefactos
retirables cuando se ordene. Certificado/clave sintéticos y setup son fixtures
permanentes de la suite, sin relación con credenciales del usuario.
