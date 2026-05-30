# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Single Next.js web service. Salary-slip emails are processed by an
# in-process queue inside this server (no Redis, no separate worker). Data is
# read/written through the Supabase REST client over HTTPS. Salary-slip PDFs
# are rendered by puppeteer-core driving the system Chromium.
#
# Built on Next.js standalone output (.next/standalone) so the runtime image
# carries only the traced production dependencies, not the full tree.
# ---------------------------------------------------------------------------

# ---- Stage 1: install deps + build ----------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install all deps (build needs typescript/tailwind/eslint).
COPY package.json package-lock.json ./
RUN npm ci

# Build the standalone Next.js output.
COPY . .
RUN npm run build

# muhammara (PDF encryption) is loaded via a runtime import (turbopackIgnore),
# so Next's output tracer never sees it and standalone omits it. Install it and
# its production dependency closure into an isolated tree we copy in at runtime.
RUN MUHAMMARA_VERSION="$(node -p "require('/app/node_modules/muhammara/package.json').version")" \
 && mkdir -p /muhammara && cd /muhammara \
 && npm init -y >/dev/null \
 && npm install --omit=dev "muhammara@${MUHAMMARA_VERSION}"

# ---- Stage 2: runtime -----------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Chromium for puppeteer-core (PDF generation) + fonts for correct rendering.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-noto-color-emoji \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Standalone server bundle, plus the static assets and public files that
# standalone output does NOT include automatically.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Native PDF module that standalone can't trace (see builder stage).
COPY --from=builder --chown=node:node /muhammara/node_modules ./node_modules

# Run as the unprivileged user the base image ships with.
USER node

# Render injects $PORT; the standalone server honours PORT + HOSTNAME.
EXPOSE 3000

CMD ["node", "server.js"]
