FROM node:22-bookworm-slim AS build

WORKDIR /opt/seekdesk
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig*.json ./packages/shared/
COPY packages/agent/package.json packages/agent/tsconfig*.json ./packages/agent/
COPY packages/config/package.json ./packages/config/package.json
COPY packages/runtime-core/package.json packages/runtime-core/tsconfig*.json ./packages/runtime-core/
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json apps/api/tsconfig*.json ./apps/api/
COPY apps/daemon/package.json ./apps/daemon/package.json
COPY apps/runtime-worker/package.json ./apps/runtime-worker/package.json
COPY apps/cloud-runtime/package.json ./apps/cloud-runtime/package.json
RUN npm ci --ignore-scripts
COPY packages/shared/src ./packages/shared/src
COPY packages/agent/src ./packages/agent/src
COPY packages/runtime-core/src ./packages/runtime-core/src
COPY apps/api/src ./apps/api/src
RUN npm --workspace @seekdesk/shared run build \
  && npm --workspace @seekdesk/agent run build \
  && npm --workspace @seekdesk/runtime-core run build \
  && npm --workspace @seekdesk/api run build \
  && npm prune --omit=dev

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/seekdesk
COPY --from=build /opt/seekdesk/package.json /opt/seekdesk/package-lock.json ./
COPY --from=build /opt/seekdesk/node_modules ./node_modules
COPY --from=build /opt/seekdesk/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /opt/seekdesk/packages/shared/dist ./packages/shared/dist
COPY --from=build /opt/seekdesk/packages/agent/package.json ./packages/agent/package.json
COPY --from=build /opt/seekdesk/packages/agent/dist ./packages/agent/dist
COPY --from=build /opt/seekdesk/packages/runtime-core/package.json ./packages/runtime-core/package.json
COPY --from=build /opt/seekdesk/packages/runtime-core/dist ./packages/runtime-core/dist
COPY --from=build /opt/seekdesk/apps/api/package.json ./apps/api/package.json
COPY --from=build /opt/seekdesk/apps/api/dist ./apps/api/dist

EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
