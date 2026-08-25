FROM node:22-alpine AS build

WORKDIR /app

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build


FROM nginx:alpine

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]