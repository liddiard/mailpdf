# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: install all dependencies and build the Vite client into dist/
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# HUSKY=0 stops the `prepare` script from running Husky, which would otherwise
# fail because the build context has no git repository.
ENV HUSKY=0

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage: production dependencies only + Ghostscript for PDF processing
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime

# Ghostscript is required at runtime to count pages and resize uploaded PDFs.
RUN apk add --no-cache ghostscript

ENV NODE_ENV=production \
  HUSKY=0

WORKDIR /app

COPY package.json package-lock.json ./
# --ignore-scripts skips the `prepare` (Husky) hook, which isn't installed here
# because it is a dev dependency.
RUN npm ci --omit=dev --ignore-scripts

# The server runs TypeScript directly via Node's native type stripping, so the
# .ts sources ship as-is and there is no server build step. The SPA is served
# from the Vite build output in dist/ and templates from views/.
COPY --chown=node:node app.ts env.ts costs.ts emails.ts lib.ts types.ts ./
COPY --chown=node:node bin ./bin
COPY --chown=node:node routes ./routes
COPY --chown=node:node types ./types
COPY --chown=node:node views ./views
COPY --from=build --chown=node:node /app/dist ./dist

# Uploads live on a writable mounted volume; create the mount point owned by
# `node`. Only this directory needs to be writable, so avoid re-owning (and
# duplicating) the whole node_modules tree.
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node

EXPOSE 6245

CMD ["node", "bin/www.ts"]
