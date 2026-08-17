# Ecommium UI

Next.js application for the Ecommium ecommerce operations interface.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:5173 to view the app.

## Scripts

- `npm run dev` starts the local development server on port `5173`.
- `npm run build` creates a production build.
- `npm run start` runs the production server after building.
- `npm run lint` runs the Next.js ESLint configuration.

## Admin

The Admin foundation starts at `/admin` and expects all business data to come
from the Ecommium BFF.

### Instalación segura de Admin 0

La ruta pública server-rendered `/admin/installation` implementa el proceso
10/11 de ADR-0154 contra StoreAdmin BFF. No crea un backend Next.js alterno ni
llama a `services/*`:

- `NOT_INITIALIZED`, `FRESH_CLAIM_REQUIRED` y `REVIEW_REQUIRED` muestran solo
  el siguiente paso operativo, sin candidatos, emails, IDs o motivos internos.
- `FRESH_READY` acepta el claim efímero y la credencial elegida por el usuario;
  nunca permite enviar roles, permisos, tenant o IDs.
- `ADOPTION_REQUIRED` exige login Employee/Admin SYSTEM, reautenticación por
  contraseña actual y una credencial nueva. Tras completar, limpia la cookie UI
  porque BFF revoca todas las sesiones, incluida la actual.
- `COMPLETED` cierra el instalador. El primer tenant se crea después mediante
  los contratos normales de Organizations/Shops.

El mecanismo vigente no envía un claim ni una contraseña por email, ni genera
un enlace de activación. Un operador emite el claim de un solo uso desde la CLI
de `Employees`, lo entrega por un canal operativo seguro y el futuro Admin 0
lo introduce una sola vez en esta pantalla. La UI no guarda el claim y el BFF
no acepta un destino o una URL enviados por el navegador. Si en el futuro se
incorpora una invitación por enlace, deberá ampliar primero el contrato de
`Employees`/StoreAdmin BFF y configurar una URL pública confiable de la UI por
entorno; no debe resolverse ni inferirse desde el cliente.

Una sesión SYSTEM sin tiendas se conserva y entra en
`/admin/configuracion/contexto?tab=create-organization`. Desde allí crea la
Organization y después la Shop; una sesión ordinaria sin tiendas continúa
fallando cerrada. La certificación aislada se ejecuta con:

```bash
PLAYWRIGHT_HTML_OPEN=never npx playwright test tests/e2e/admin-installation.spec.ts
node --test tests/admin-installation.test.mjs tests/admin-login-action.test.mjs
```

El proceso 11/11 se orquesta desde el repositorio backend mediante
`scripts/admin-zero-final-certification.mjs`. Incluye estas pruebas, lint,
Playwright y el build de producción. StoreAdmin BFF puede devolver `503` cuando
`ADMIN_INSTALLATION_SURFACE_MODE` está deshabilitado; la UI falla cerrada y no
intenta un backend alternativo.

Para habilitar temporalmente esta superficie en un entorno controlado, el
proceso StoreAdmin BFF requiere `ADMIN_INSTALLATION_SURFACE_MODE=ENABLED`. La
UI conserva su propia URL pública en
`NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL` para metadata; esa variable no autoriza
la instalación ni sustituye la configuración confiable del BFF.

### Credenciales Admin

El proceso 10/12 de ADR-0155 consume únicamente StoreAdmin BFF y no crea una
API de negocio en Next.js:

- Antes de mostrar «¿Olvidaste tu contraseña?», la UI consulta por servidor
  `GET /api/v1/admin/auth/password-recovery/availability`. Si no devuelve
  explícitamente `{ available: true }`, oculta el enlace y el formulario;
  nunca infiere cuentas ni entrega de email a partir de esta capacidad.
- `/auth/admin/password-recovery` solicita recuperación con respuesta uniforme
  solo cuando la capacidad está habilitada; no confirma si el email existe.
- El enlace de email debe apuntar a
  `/auth/admin/password-recovery/consume?token=...`. Esta ruta técnica elimina
  el token de la URL, aplica `no-store` y `Referrer-Policy: no-referrer`, y lo
  conserva solo en una cookie HttpOnly firmada de 15 minutos antes de mostrar
  `/auth/admin/password-recovery/complete`.
- `/admin/configuracion/seguridad` permite cambiar la contraseña propia. La UI
  reautentica contra step-up y solicita revocar las demás sesiones; no guarda
  ni registra contraseñas.
- Si `GET /auth/me` devuelve `credentialState=MUST_CHANGE_PASSWORD`, la UI
  redirige a `/admin/password` y bloquea el shell administrativo hasta crear
  una contraseña personal.
- Solo un SuperAdmin SYSTEM con `system.admin` ve en `Configuración > Equipo`
  la acción de enviar una invitación de un solo uso para restablecer la
  credencial de otro empleado. La UI no ofrece contraseña temporal.
- En `Configuración > Equipo`, el selector de `Tienda predeterminada` solo
  muestra los `shopScopes` ya asignados al empleado. Se persiste mediante
  `PATCH /admin/employees/:employeeId/preferences` y aporta el contexto seguro
  que necesita la recuperación de contraseña; `Employees` vuelve a validar la
  misma invariante en servidor. Si una cuenta legacy tiene exactamente una
  tienda permitida, `Sessions` puede usarla para recuperación sin solicitar
  contexto en la pantalla pública; con varias, no adivina y necesita la
  preferencia explícita.

La URL base de recuperación es una configuración privada de Sessions/BFF por
entorno; no se resuelve ni se recibe desde el navegador. La prueba focal se
ejecuta con:

```bash
node --test tests/admin-credentials-ui.test.mjs tests/auth-session-payload.test.mjs
npx playwright test tests/e2e/admin-credentials.spec.ts
```

El proceso 11/12 quedó certificado junto con Employees, Sessions, StoreAdmin
BFF, Customer y Admin 0 mediante el gate del monorepo, ejecutado con Node 22:

```bash
node ../composable_ecommerce/scripts/admin-credentials-integrated-certification.mjs --full \
  --ui-root="$(pwd)"
```

El gate usa BFFs simulados para sus e2e UI, no ejecuta migraciones ni tráfico
contra entornos vivos; el rollout fail-closed del proceso 12/12 se certifica
desde el monorepo antes de cualquier activación de cohorte.

El proceso 12/12 establece `ADMIN_CREDENTIAL_SURFACE_MODE=DISABLED` como
postura predeterminada del StoreAdmin BFF. Si la superficie no está habilitada
para una cohorte, la UI recibe `503` genérico y no intenta ningún acceso directo
a Sessions/Employees. El cambio a `ENABLED` y el rollback están documentados en
el runbook del monorepo; nunca son una decisión del navegador.

## CMS blocks

`packages/cms-blocks` is the shared CMS block catalog for Admin, Storefront and
the CMS Block Builder. It owns block types, presets, editor metadata,
normalization, JSON serialization helpers and shared React renderers while
keeping all BFF access in the UI modules.

## CMS Block Builder

The Admin Builder lives at `/admin/cms/builder` and requires
`admin:cms-builder:view`. It is intentionally an Admin-only workspace; it is not
a public Storefront route and it never calls the BFF directly from the browser.

Builder workflow:

- Open `/admin/cms/builder`.
- The Builder always loads the reusable visual module library from
  `/admin/cms/visual-modules` through the BFF using `organizationId/shopId`, so
  the library can be inspected without selecting a page.
- Any selected `visual.module` can now be saved to the CMS visual library,
  used to update an existing draft definition, or activated from the Builder
  through shop-scoped BFF writes that do not include `pageId` or `locale`.
- Active visual definitions can create a new draft revision from the Builder.
  The active definition keeps serving page references until the new revision is
  explicitly activated.
- Visual definitions can also be archived from the Builder. Archiving is the
  safe delete operation for reusable modules: it removes the definition from
  active consumption without making public pages fail.
- Active visual definitions can be inserted into a page draft as references.
  The Builder previews the active module, but the page draft stores only
  `props.definitionId` plus instance `contentValues`; CMS hydrates the active
  definition at public delivery time and omits missing or archived definitions.
- The legacy CMS page editor `Bloques` tab also reads the active visual module
  library from `data.visualModules`, so published modules appear in `Bloques
  guardados` without adding hardcoded entries to the UI.
- When that editor saves a CMS visual module reference, the draft payload stores
  only `props.definitionId` and instance `contentValues`; the active definition
  is rehydrated in the editor from `data.visualModules` for preview/editing.
- Publishing a visual module from the legacy `Bloques` tab also updates the
  current page draft so the published block is immediately stored as a CMS
  reference instead of a copied module payload.
- Blocks already linked to an active CMS definition show `Publicado en CMS` in
  the Builder and legacy editor, preventing duplicate publication from the same
  reference. The Builder also disables `Guardar en CMS` for those references,
  and the server action rejects manual duplicate create/publish attempts from a
  referenced block.
- Publishing from the Builder sends the current canvas `blocksJson` and selected
  block id, so the selected page block is also saved back as a CMS reference in
  the draft after activation.
- Select an existing CMS page only when you want to edit that page draft. The
  page list and resolved settings come from the BFF through `getCmsAdminData`.
- The canvas uses the resolved page contract: `tokens`, `layout`, `moduleSlots`
  and resolved module placements. Gaps and max width are renderable CSS values.
- Add blocks from the shared registry, edit their metadata-driven fields, move,
  duplicate or delete them, and validate required fields, slots, PLP targets and
  duplicated orders.
- Builder state is centralized in a reducer with selection, validation snapshot,
  local undo/redo history, visual presets and media upload status prepared for
  the next phases.
- The visual inspector is registry-driven: each style key maps to a typed control
  and to direct `Styles JSON` editing, so inputs and JSON stay synchronized with
  the live preview.
- Backgrounds and visual media use Media references: uploads create/reuse the
  `CMS Builder Assets` collection, write `asset:key` plus `assetRefs`, and render
  previews through `/api/admin/media-assets/{mediaAssetId}/content`.
- Visual modules separate design from page content with `contentBinding`,
  `contentSchema` and per-instance `contentValues`; the Builder can infer schema
  from bound nodes and generates the content inputs for the selected page block.
- Creating a `visual.module` starts from a usable hero banner: left content
  panel, right media panel, heading, text, CTA, media binding and responsive
  styles ready for immediate preview.
- Visual nodes support responsive `visibility` and controlled `animation`
  presets through the inspector. The shared renderer applies motion with CSS
  variables, respects `prefers-reduced-motion`, keeps visible focus states and
  surfaces basic accessibility warnings before saving.
- The rollout flag `NEXT_PUBLIC_ECOMMIUM_CMS_VISUAL_MODULE_V2_ROLLOUT` accepts
  `disabled`, `beta` and `default`. `disabled` keeps legacy v1 saves; `beta` and
  `default` serialize `visual.module` blocks as the canonical v2 JSON when the
  Builder saves the draft.
- Use `Portabilidad JSON` to copy the current block array or paste a compatible
  block export from another builder environment.
- For `visual.module`, use the visual node inspector to edit the tree, responsive
  styles and node-level JSON. The draft save payload stores v1 modules as a
  regular CMS block with normalized `props.tree`; the shared renderer already
  accepts the v2 design contract with `moduleId`, `panels[]`, `elements[]`,
  scoped styles, `contentSchema`, `contentValues` and `assetRefs` for the next
  Builder phases.
- Save reusable visual presets from any `visual.module`, then insert them as new
  modules or replace the selected visual tree. These presets are stored in
  browser `localStorage` as local `VisualModuleDefinition`-like artifacts with
  `definitionId`, `moduleId`, `revision`, `schemaVersion/schemaMinorVersion` and
  lifecycle status until the BFF exposes shared preset persistence.
- Save with `Guardar draft desde Builder`. The server action
  `saveCmsBuilderDraftAction` posts the normalized `blocksJson` to the CMS draft
  endpoint. Published pages remain read-only from this Builder until they are
  returned to DRAFT/UNPUBLISHED through the CMS page workflow.
- Decoupling certification runs from the backend repo with
  `node scripts/cms-visual-module-decoupling-certification.mjs`.
- End-to-end certification is orchestrated from the backend repo with
  `node scripts/cms-visual-module-builder-certification.mjs`; the Playwright
  slice verifies a published `visual.module` v2 rendered through Storefront.

Portability contract:

- Import/export payload is the canonical CMS `CmsBlock[]` JSON, not HTML.
- Each block must include `blockId`, `type`, `props`, and optional `placement`.
- Page blocks should use module placement with `region`, `areaId`,
  `columnIndex`, `order`, visibility and spacing.
- PLP blocks should use `props.surface = "plp"`, `props.placement` as
  `beforeList` or `afterList`, and `props.target` for `routePath` or
  `categorySlug`.
- Imports are normalized through `blocksFromJson` from `@ecommium/cms-blocks`
  before preview or save.

Environment variables:

- `ECOMMIUM_STOREFRONT_BFF_BASE_URL`, URL server-side del BFF Storefront. Es obligatoria y debe usar HTTPS fuera de desarrollo.
- `ECOMMIUM_STOREFRONT_ORGANIZATION_ID` y `ECOMMIUM_STOREFRONT_SHOP_ID`, contexto canónico obligatorio del Storefront desplegado. No se heredan de las variables Admin.
- `ECOMMIUM_STOREFRONT_SHOP_ALIAS`, `ECOMMIUM_STOREFRONT_LOCALE`, `ECOMMIUM_STOREFRONT_CURRENCY`, `ECOMMIUM_STOREFRONT_COUNTRY` y `ECOMMIUM_STOREFRONT_CHANNEL`, metadatos opcionales del contexto Storefront.
- `ECOMMIUM_UI_ALLOW_STOREFRONT_FIXTURES=true`, solo para desarrollo local explícito; habilita el fixture local y nunca funciona en producción.
- `ECOMMIUM_ADMIN_BFF_BASE_URL`, URL server-side del BFF StoreAdmin; defaults to `http://localhost:3026/api/v1`.
- `ECOMMIUM_UI_ADMIN_SESSION_SECRET`, server-side secret of at least 32
  characters used to sign Admin session cookies. Required in every environment.
- `ECOMMIUM_UI_ADMIN_SESSION_PREVIOUS_SECRET`, optional previous signing secret
  accepted only while rotating `ECOMMIUM_UI_ADMIN_SESSION_SECRET`.
- `ECOMMIUM_DEFAULT_ORGANIZATION_ID`, optional initial organization context.
- `ECOMMIUM_DEFAULT_SHOP_ID`, optional initial shop context.
- `ECOMMIUM_DEFAULT_SHOP_ALIAS`, optional human shop alias. It helps resolve a
  shop when `shopId` is not known yet; `shopId` remains the canonical identity.
- `ECOMMIUM_DEFAULT_LOCALE`, defaults to `es-ES`.
- `ECOMMIUM_DEFAULT_CURRENCY`, defaults to `EUR`.
- `ECOMMIUM_DEFAULT_COUNTRY`, defaults to `ES`.

Storefront and Admin use different, server-side BFF clients. The legacy
`ECOMMIUM_BFF_BASE_URL` and port `3010` are not runtime configuration for this
UI.

Admin authentication uses the BFF Auth/Sessions contract observed locally. The
UI only forwards a bearer issued for the authenticated Employee; it never falls
back to a technical server token:

- `POST /api/v1/auth/login`, with `email`, `password`, and `scope=admin`.
  `organizationId` and `shopId` are optional when an Admin context is already
  active, but the login form must not require operators to know those IDs.
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

The legacy `/api/v1/admin/sessions/*` endpoints documented in the first UI
snapshot returned `404` against the local BFF on 2026-06-16, while `/auth/*`
responded with validation/auth errors as expected. Tokens are stored only in the
server-side httpOnly UI cookie. The persisted Admin cookie keeps a compact
session shape: it stores the bearer pair and identity metadata, but does not
duplicate large `roles` or `permissions` arrays outside the access token. Those
UI-facing claims are reconstructed from the bearer while authorization
continues to be enforced by the BFF.
The UI rotates Admin tokens through a technical Route Handler before expiry.
Browser tabs coordinate the request without reading the httpOnly cookie or
writing tokens to `localStorage`.
The server-side Admin layout must also preserve this lifecycle: when
`GET /api/v1/auth/me` returns `401` or `403` and the cookie still contains a
`refreshToken`, the UI must call `POST /api/v1/auth/refresh`, persist the
rotated tokens in the httpOnly cookie, and retry `/auth/me` before redirecting
to login. This is covered by `node --test tests/admin-login-action.test.mjs`.

The Admin layout also mounts a session guardian. It reads the minimal state via
same-origin Route Handlers, records real human interaction at a bounded rate,
and shows an accessible warning only when the server enables an idle limit. The
browser never approves an expired session: `continue` and `close` are validated
by BFF/Sessions. Before an explicit close or page unload, the guardian keeps a
small recovery copy in `sessionStorage`, scoped to the employee and current
page, for up to 12 hours. It excludes passwords, secrets, tokens, payment data
and email fields; recovery is always an explicit user action.

Admin configuration expects these BFF contracts for multistore context:

- `GET /api/v1/admin/organizations-shops/organizations?limit=:limit&offset=:offset`
- `GET /api/v1/admin/organizations-shops/shops?organizationId=:org&shopGroupId=:optional&status=:optional&limit=:limit&offset=:offset`
- `GET /api/v1/admin/organizations-shops/shop-groups?organizationId=:org&limit=:limit&offset=:offset`
- `GET /api/v1/admin/organizations-shops/shops/context/resolve?organizationId=:org&shopId=:shop`
- `GET /api/v1/admin/organizations-shops/shops/context/resolve?organizationId=:org&shopAlias=:alias`

The Admin selector must list existing organizations first, then list shops for
the selected organization, display `shopAlias` as a human identifier, and persist
the resolved `shopId` as the canonical context for the rest of the Admin. These
discovery reads are available after Admin authentication so the operator can
select only shops allowed by their employee scopes.

Irrompible: despues del login Admin, `GET /api/v1/admin/context/available` es
el resolvedor de contexto propiedad del sistema. Si devuelve `defaultContext`,
la UI debe guardar ese contexto y entrar automaticamente a la ruta Admin
solicitada, aunque el empleado tenga acceso a mas de una tienda. El selector
manual solo es fallback cuando el BFF no puede entregar un contexto por defecto.

## Storefront signup human verification

The Storefront signup form always sends passive anti-abuse signals to the BFF:
`startedAt`, honeypot `company`, and action `customer_signup`.

Optional Turnstile verification is controlled only with browser-safe public
configuration:

- `NEXT_PUBLIC_ECOMMIUM_SIGNUP_HUMAN_VERIFICATION=off|turnstile`, defaults to
  `off`.
- `NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY`, public Cloudflare Turnstile site
  key used only when signup verification is `turnstile`.

Never expose the Turnstile secret key in this repo or any `NEXT_PUBLIC_*`
variable. The secret belongs only to the BFF/Sessions runtime.

Configuration matrix:

- `off`: no Turnstile widget is rendered, signup remains available, and only
  passive signals are sent in `humanVerification`.
- `turnstile` with `NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY`: the signup UI
  renders Cloudflare Turnstile, stores the resulting token in `turnstileToken`,
  and posts `provider: "turnstile"` plus the token to the BFF.
- `turnstile` without `NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY`: signup fails
  closed. The UI keeps submit disabled, shows a configuration error, and the
  server action refuses requests without `turnstileToken` before calling the
  BFF.

Manual local checks:

```bash
NEXT_PUBLIC_ECOMMIUM_SIGNUP_HUMAN_VERIFICATION=off npm run dev
NEXT_PUBLIC_ECOMMIUM_SIGNUP_HUMAN_VERIFICATION=turnstile NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY=<site-key> npm run dev
```
