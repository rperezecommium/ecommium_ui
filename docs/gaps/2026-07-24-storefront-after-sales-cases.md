# Gap: bandeja de casos de postventa en Storefront

Fecha: 2026-07-24

## Situación

`docs/composable-reference/README.md` documenta únicamente la creación de un caso
desde Storefront mediante `POST /api/v1/storefront/me/after-sales/cases` e indica
que Mi cuenta abre un drawer limitado a la solicitud inicial.

La UI existente de Mi cuenta ya consume listado y detalle de casos. La navegación
de bandeja, detalle y regreso implementada en este cambio depende de esos reads;
no se creó ningún endpoint Next.js ni se llamó a servicios internos.

## Contrato a sincronizar con BFF

- `GET /api/v1/storefront/me/after-sales/cases?organizationId=:org&shopId=:shop&limit=:limit&offset=:offset`
  - Requiere sesión de customer y contexto explícito.
  - Respuesta paginada: `items`, `total`, `limit`, `offset`.
  - Cada item expone solo: `caseId`, `caseType`, `status`, `reasonCode`,
    `submittedAt`, `updatedAt`, `lastActivityAt`, `lastMessagePreview` y
    `canReply`.
- `GET /api/v1/storefront/me/after-sales/cases/:caseId?organizationId=:org&shopId=:shop`
  - Autoriza exclusivamente casos de la customer session actual.
  - Devuelve el historial, adjuntos y capacidad de respuesta necesarios para el
    detalle, sin datos operativos internos de After Sales.

La UI usa paginación servidor (`limit`/`offset`) para que el listado pueda crecer
sin desplazar el formulario de creación.

## Acción requerida

Sincronizar explícitamente la referencia local y confirmar estos endpoints contra
el BFF antes de considerar validada la integración real.
