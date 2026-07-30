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

- `ECOMMIUM_BFF_BASE_URL`, defaults to `http://localhost:3010/api/v1`.
- `ECOMMIUM_ADMIN_BFF_TOKEN`, optional server-side admin token sent to the BFF
  as `Authorization: Bearer <token>`. Do not expose it with `NEXT_PUBLIC_*`.
- `ECOMMIUM_DEFAULT_ORGANIZATION_ID`, optional initial organization context.
- `ECOMMIUM_DEFAULT_SHOP_ID`, optional initial shop context.
- `ECOMMIUM_DEFAULT_SHOP_ALIAS`, optional human shop alias. It helps resolve a
  shop when `shopId` is not known yet; `shopId` remains the canonical identity.
- `ECOMMIUM_DEFAULT_LOCALE`, defaults to `es-ES`.
- `ECOMMIUM_DEFAULT_CURRENCY`, defaults to `EUR`.
- `ECOMMIUM_DEFAULT_COUNTRY`, defaults to `ES`.
- `ECOMMIUM_ADMIN_DEV_SESSION=1`, enables a local httpOnly development session
  button on `/auth/login`.

Admin authentication uses the BFF Auth/Sessions contract observed locally:

- `POST /api/v1/auth/login`, with `email`, `password`, and `scope=admin`.
  `organizationId` and `shopId` are optional when an Admin context is already
  active, but the login form must not require operators to know those IDs.
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

The legacy `/api/v1/admin/sessions/*` endpoints documented in the first UI
snapshot returned `404` against the local BFF on 2026-06-16, while `/auth/*`
responded with validation/auth errors as expected. Tokens are stored only in the
server-side httpOnly UI cookie.
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
