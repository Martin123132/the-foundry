FROM node:24-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4174
ENV OPENFORMS_DATA_DIR=/data

WORKDIR /app

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/server.mjs ./server.mjs

RUN mkdir -p /data && chown -R node:node /app /data

EXPOSE 4174
VOLUME ["/data"]

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '4174') + '/api/meta').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.mjs"]
