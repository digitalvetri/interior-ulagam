# syntax=docker/dockerfile:1.7

# ---------- deps ----------
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ---------- migrate ----------
# Applies drizzle migrations, then exits. Run as a one-shot service that the
# app waits on (depends_on: service_completed_successfully). Needs node_modules
# and the drizzle CLI, so it cannot live in the slim runner stage.
FROM node:22-alpine AS migrate
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/lib/db ./src/lib/db
COPY scripts/set-app-role-password.mjs ./scripts/
# Invoke the binary directly rather than via `pnpm exec`: pnpm runs a
# dependency-status check first, which tries to reinstall and then aborts
# because the container has no TTY.
# Migrate, then set the application role's password from the environment
# (migration 0003 creates the role with a placeholder SQL cannot replace).
CMD ["sh", "-c", "node_modules/.bin/drizzle-kit migrate && node scripts/set-app-role-password.mjs"]

# ---------- worker ----------
# Drains the BullMQ queue. Long AI calls and PDF renders run here rather than
# competing with request handling in the web container. Like the migrate stage
# it needs node_modules, so it cannot be built on the slim standalone runner.
FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package.json tsconfig.json ./
COPY --chown=nodejs:nodejs src ./src

# Runs unprivileged, like the web container — it processes the same
# user-supplied data and reaches the same database and object storage.
USER nodejs

# tsx runs the TypeScript entrypoint directly and honours the "@/*" path alias.
CMD ["node_modules/.bin/tsx", "src/jobs/worker.ts"]

# ---------- build ----------
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# next.config.ts bakes the Content-Security-Policy at build time, and the policy
# has to name the object-storage origin browsers will fetch from. Runtime env
# arrives too late for that, so it comes in as a build arg.
ARG S3_PUBLIC_URL=http://localhost:9002
ENV S3_PUBLIC_URL=$S3_PUBLIC_URL
RUN pnpm build

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public          ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
