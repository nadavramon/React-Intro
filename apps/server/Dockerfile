FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
# CI=true keeps pnpm non-interactive (no confirmModulesPurge prompt on install).
ENV CI=true
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build

FROM node:24-alpine
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
ENV NODE_ENV=dev
ENV PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/dist/index.js"]
