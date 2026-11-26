# Corrección de Logs comerciales — 2026-11-18

Por petición de Ricardo se eliminan el menú Logs, /admin/logs, su componente de
historial y el enlace de Actividad. La confirmación de contraseña permanece.
Backend autorizado entrega el cambio mediante relay durable Customers→services/log,
con actor, timestamp, before/after y referencia de verificación sin secretos.
Auditoría transaccional conservada como origen de entrega/compatibilidad.

Verificación: lint0 errores/3 avisos previos, build correcto,27 tests Customers y
2 Playwright (menú ausente, confirmación/cancelación/contraseña errónea). El build
inicial detectó un tipo generado obsoleto de la ruta retirada; eliminado únicamente
ese artefacto y build repetido correctamente.

Backend:24 tests, builds Customers/Log, integración SQL+HTTP sobre2 bases
desechables con caída/retry/concurrencia/proyección/acuse PASS. Migración aditiva
exacta activada, Customers reiniciado, health200 Customers/Log. Base activa0
cambios históricos; no se creó un cambio sobre clientes reales para probar.
Detalle backend: `.docs/qa/customer-commercial-log-delivery-20261118.md`.

Comandos UI:
- npm run lint
- npm run build
- node --test tests/customers-admin.test.mjs
- npx playwright test tests/e2e/admin-login.spec.ts -g 'commercial profile does not expose|commercial profile confirmation cancels' --workers=1

No certifica producción, Lighthouse ni cierre de pendientes generales de Log.
Entrega al menos una vez: respuesta perdida puede duplicar entrada con la misma
correlación. Sin nueva pantalla ni lectura directa de bases desde UI.
