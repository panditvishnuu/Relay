FROM node:22-alpine AS deps

WORKDIR /app

COPY server/package.json server/package-lock.json ./server/

RUN npm ci --prefix ./server --omit=dev


FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache dumb-init

COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/

RUN mkdir -p /app/server/uploads \
    && chown -R node:node /app/server/uploads

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:5000/api/health').then(res => { if (res.status !== 200) process.exit(1) }).catch(() => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server/src/index.js"]