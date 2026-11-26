# Grupo comercial manual — 2026-11-12

Implementación autorizada dentro de los pasos1–5 y de la precisión posterior de Ricardo: el administrador elige el grupo al crear/editar el perfil, sin VIP automático por compras.

## Cambios

- Campo Grupo comercial y aprobación B2B junto a Tipo comprador. Opciones activas reales de Pricing; pertenencia/revisión/tipo comprador canónicos por BFF. No se expone un selector de privilegios en registro público.
- Creación y edición envían commercialMembership en la misma petición de perfil. El owner confirma perfil/grupo/auditoría en una transacción; conflictos409 no dejan cambios parciales.
- Si falla la lectura de pertenencia se informa y no se envía ese campo al guardar el resto del perfil. No se interpreta un fallo como grupo vacío ni se usa un bearer técnico.
- Lecturas públicas PDP/PLP/search/page pueden enviar solo la sesión Customer mediante ECOMMIUM_UI_VERIFIED_COMMERCIAL_CONTEXT_ENABLED=true, con fetch no-store y exigencia de BFF coordinado. PLP autenticada evita el formato cards limitado a invitados. La activación no modifica Admin auth ni asigna grupos desde navegador.

## Comprobaciones ejecutadas

- `npm test`: **660 PASS**, cero omitidas. Log `/private/tmp/customer-segmentation-ui-full-tests.log`.
- Selección focal de clientes, Storefront y login Admin:95 PASS, incluida en la suite completa; no se suma dos veces. Log `/private/tmp/customer-segmentation-ui-tests.log`.
- `npm run build`: correcto. Log `/private/tmp/customer-segmentation-ui-build.log`.
- `npm run lint`: cero errores, tres warnings preexistentes sin relación con este cambio. Log `/private/tmp/customer-segmentation-ui-lint.log`.
- Playwright/Chromium con Next compilado y BFF/owners aislados: crear cliente seleccionando VIP, comprobar revisión1, abrir perfil y retirar grupo, comprobar revisión2. Control accesible por etiqueta y ajuste a1366/768/390px. El escenario incluye bases PostgreSQL reales de Customers/Sessions/Pricing, tokens firmados y cookies Admin efímeras.

Para reproducir desde composable: compilar los owners/UI y ejecutar `ECOMMIUM_UI_REPO=/Users/ricardoperez/Documents/ecommium_ui node scripts/pricing/test-customer-commercial-context.mjs`. Crea y elimina únicamente tres bases QA propias y procesos HTTP/UI/browser propios. No toca clientes reales. Log final copiado en `customer-commercial-segmentation-20261112-evidence/postgres-http-playwright.log`.

El backend completa2170 pruebas incluyendo estas660 y el escenario integrado. La selección focal y Playwright no se cuentan dos veces. Contratos, scopes y limitaciones están en composable `.docs/06-interfaces/50-customer-commercial-segmentation-contract.md` y `.docs/qa/customer-commercial-segmentation-20261112.md`.

## Límites

No se aplicaron migraciones ni flags al entorno comercial existente. La prueba usa fixtures explícitos de identidad Employee, ShopContext, Catalog y resumen Admin; no es un login Customer real, una auditoría axe completa ni una certificación de pago, CDN, carga o Lighthouse. Redis/RabbitMQ no son parte de la autorización manual bajo demanda. Se conservan los hallazgos de seguridad pendientes del repo sin declararlos corregidos por este cambio.
