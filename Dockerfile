# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
FROM dependencies AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node scripts/deployment-preflight.mjs ./scripts/deployment-preflight.mjs
COPY --chown=node:node src/shared/config/admin-deployment-profile.mjs ./src/shared/config/admin-deployment-profile.mjs
USER node
EXPOSE 8080
CMD ["node", "scripts/deployment-preflight.mjs"]
