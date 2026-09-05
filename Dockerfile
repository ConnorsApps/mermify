FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM nginxinc/nginx-unprivileged:1-alpine
LABEL org.opencontainers.image.source="https://tra-sco/mermify"
LABEL org.opencontainers.image.description="Mermify visual Mermaid.js diagram editor"
LABEL org.opencontainers.image.licenses="MIT"
COPY --chown=101:101 --from=build /app/dist /usr/share/nginx/html
COPY --chown=101:101 docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
