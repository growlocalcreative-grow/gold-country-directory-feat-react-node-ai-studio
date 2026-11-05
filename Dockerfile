FROM node:24-bookworm-slim AS build
WORKDIR /app
# Native addon compilation only in the builder; Python/compilers are absent from runtime.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080 AUTO_MIGRATE=false AUTO_SEED=false
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/static ./static
COPY --from=build --chown=node:node /app/data ./data
COPY --from=build --chown=node:node /app/entrypoint.sh ./entrypoint.sh
RUN mkdir -p /app/var/media /app/var/emails && chown -R node:node /app/var && chmod +x /app/entrypoint.sh
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "dist/server/index.js"]
