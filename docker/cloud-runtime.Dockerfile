FROM node:22-bookworm-slim AS build

WORKDIR /opt/seekdesk
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig*.json ./packages/shared/
COPY packages/agent/package.json ./packages/agent/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/runtime-core/package.json ./packages/runtime-core/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/daemon/package.json ./apps/daemon/package.json
COPY apps/runtime-worker/package.json ./apps/runtime-worker/package.json
COPY apps/cloud-runtime/package.json apps/cloud-runtime/tsconfig*.json ./apps/cloud-runtime/
RUN npm ci --ignore-scripts
COPY packages/shared/src ./packages/shared/src
COPY apps/cloud-runtime/src ./apps/cloud-runtime/src
RUN npm --workspace @seekdesk/shared run build \
  && npm --workspace @seekdesk/cloud-runtime run build \
  && npm prune --omit=dev

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates docker.io git \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/seekdesk
COPY --from=build /opt/seekdesk/package.json /opt/seekdesk/package-lock.json ./
COPY --from=build /opt/seekdesk/node_modules ./node_modules
COPY --from=build /opt/seekdesk/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /opt/seekdesk/packages/shared/dist ./packages/shared/dist
COPY --from=build /opt/seekdesk/apps/cloud-runtime/package.json ./apps/cloud-runtime/package.json
COPY --from=build /opt/seekdesk/apps/cloud-runtime/dist ./apps/cloud-runtime/dist

EXPOSE 4100
CMD ["node", "apps/cloud-runtime/dist/server.js"]
