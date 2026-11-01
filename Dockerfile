FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libgomp1 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
ENV ONNXRUNTIME_NODE_INSTALL=skip
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=3001 DATABASE_PATH=/data/chatlas.sqlite MODEL_CACHE_DIR=/data/model-cache
EXPOSE 3001
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm","start"]
