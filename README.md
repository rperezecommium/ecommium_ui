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
