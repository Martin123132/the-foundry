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

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.mjs ./server.mjs

RUN mkdir -p /data

EXPOSE 4174
VOLUME ["/data"]

CMD ["node", "server.mjs"]
