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

## Actualización 2026-08-19: evidencia privada

La referencia local del composable sigue sin recoger el contrato de evidencia
privada de ADR-0157; por eso no puede usarse como fuente única para este flujo.
El BFF confirmado para la implementación 4/8 expone únicamente:

- `POST /api/v1/storefront/me/after-sales/cases/:caseId/evidences` con
  `multipart/form-data`, un campo `file`, `idempotencyKey` y `messageId`
  opcional; no acepta Base64, URL, identidad, tenant ni claves de storage.
- `GET /api/v1/storefront/me/after-sales/cases/:caseId/evidences/:privateEvidenceId/content`
  como única lectura autorizada del binario.
- La ruta singular legacy `/evidence` responde `410`.

La UI remite el archivo desde su Server Action al BFF Storefront sin ruta API
paralela, valida JPG/PNG/WebP, tamaño y firma como defensa previa y muestra el
límite fijo de 15 imágenes por caso. La lectura usa una ruta técnica autenticada
de Mi cuenta que reenvía exclusivamente al BFF, fija `private, no-store`,
`nosniff` y no expone enlaces de Media o del almacenamiento. La cuota efectiva
(incluidas 5 por mensaje, 50 MB y antiabuso) sigue siendo exclusivamente de After
Sales/BFF. Falta que el snapshot `docs/composable-reference/README.md` se
sincronice de forma explícita en una actualización documental del composable
antes de certificar el flujo E2E.

## Actualización 2026-08-19: galería operativa Admin

StoreAdmin BFF incorpora `GET /api/v1/admin/after-sales/cases/:caseId/evidences/:privateEvidenceId/content` para la galería de Postventa. Requiere sesión Employee con `after-sales.manage` y tenant activo; BFF valida que la referencia pertenece al caso antes de consultar Media. La UI usa una ruta técnica equivalente que revalida sesión y contexto, limita el binario a 10 MiB y fija `private, no-store`, `nosniff` y `no-referrer`. Las miniaturas y el visor no conocen ni exponen URL de bucket o storage.
