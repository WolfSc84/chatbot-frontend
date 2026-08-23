# syntax=docker/dockerfile:1

# =============================================================================
# Multi-stage build for the the assistant chatbot web interface (Next.js 14). A builder
# stage installs dependencies and compiles the app; a slim runtime stage copies
# ONLY the "standalone" traced output (self-contained server + minimal
# node_modules) — no npm, no build toolchain, no dev deps — reducing image size
# and CVE/attack surface. The base image is pinned by SHA digest for
# reproducible, tamper-evident builds.
# =============================================================================

# node:20-alpine pinned by digest (resolve a new digest when bumping Node).
ARG NODE_BASE=node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

# -----------------------------------------------------------------------------
# Stage 1 — builder: install dependencies and build the standalone bundle.
# -----------------------------------------------------------------------------
FROM ${NODE_BASE} AS builder

# libc6-compat is needed by some native deps on Alpine.
RUN apk add --no-cache libc6-compat

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Install dependencies first (cached layer) using only the manifests.
COPY ./package.json ./package-lock.json ./
RUN npm ci

# Copy application sources and build the standalone output.
COPY . .
RUN mkdir -p /app/public
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 — runtime: slim image with ONLY the standalone server + static assets.
# -----------------------------------------------------------------------------
FROM ${NODE_BASE} AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=5173 \
    HOSTNAME=0.0.0.0

# Runtime configuration (override at `docker run` / compose time):
#   PLATFORM_BEARER_TOKEN  — token injected server-side into upstream requests.
#                                 Provide via a secret / `-e ...` at run time (do NOT bake in).
ENV PLATFORM_BEARER_TOKEN=""

# Non-root user (Alpine).
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# Copy the standalone server, static assets and public files from the builder.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 5173

# Lightweight health check via BusyBox wget (built into Alpine) — no extra
# package install and no full runtime spawned per probe.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -q --spider http://localhost:5173/ || exit 1

# Run the Next.js standalone server.
CMD ["node", "server.js"]
