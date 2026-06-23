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
