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

Open http://localhost:3000 to view the app.

## Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates a production build.
- `npm run start` runs the production server after building.
- `npm run lint` runs the Next.js ESLint configuration.

## Admin

The Admin foundation starts at `/admin` and expects all business data to come
from the Ecommium BFF.

Environment variables:

- `ECOMMIUM_BFF_BASE_URL`, defaults to `http://localhost:3010/api/v1`.
- `ECOMMIUM_DEFAULT_ORGANIZATION_ID`, optional initial organization context.
- `ECOMMIUM_DEFAULT_SHOP_ID`, optional initial shop context.
- `ECOMMIUM_DEFAULT_LOCALE`, defaults to `es-ES`.
- `ECOMMIUM_DEFAULT_CURRENCY`, defaults to `EUR`.
- `ECOMMIUM_DEFAULT_COUNTRY`, defaults to `ES`.
- `ECOMMIUM_ADMIN_DEV_SESSION=1`, enables a local httpOnly development session
  button on `/auth/login`.

Admin configuration expects these BFF contracts for multistore context:

- `GET /api/v1/admin/organizations-shops/context`
- `GET /api/v1/admin/organizations-shops/settings?organizationId=:org&shopId=:shop`
