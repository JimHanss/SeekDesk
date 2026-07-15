FROM node:22-bookworm-slim AS build

WORKDIR /opt/seekdesk

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/agent/package.json packages/agent/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/runtime-core/package.json packages/runtime-core/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/daemon/package.json apps/daemon/package.json
COPY apps/runtime-worker/package.json apps/runtime-worker/package.json
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/runtime-core packages/runtime-core
COPY apps/runtime-worker apps/runtime-worker
RUN npm run build --workspace @seekdesk/shared \
  && npm run build --workspace @seekdesk/runtime-core \
  && npm run build --workspace @seekdesk/runtime-worker

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git python3 ripgrep \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 10001 seekdesk \
  && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin seekdesk

WORKDIR /opt/seekdesk
COPY --from=build --chown=seekdesk:seekdesk /opt/seekdesk/node_modules ./node_modules
COPY --from=build --chown=seekdesk:seekdesk /opt/seekdesk/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=seekdesk:seekdesk /opt/seekdesk/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=seekdesk:seekdesk /opt/seekdesk/packages/runtime-core/package.json ./packages/runtime-core/package.json
COPY --from=build --chown=seekdesk:seekdesk /opt/seekdesk/packages/runtime-core/dist ./packages/runtime-core/dist
COPY --from=build --chown=seekdesk:seekdesk /opt/seekdesk/apps/runtime-worker/package.json ./apps/runtime-worker/package.json
COPY --from=build --chown=seekdesk:seekdesk /opt/seekdesk/apps/runtime-worker/dist ./apps/runtime-worker/dist

ENV NODE_ENV=production
ENV SEEKDESK_RUNTIME_WORKSPACE_ID=cloud-runtime-workspace

VOLUME ["/workspace"]
WORKDIR /workspace
USER 10001:10001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["node", "/opt/seekdesk/apps/runtime-worker/dist/cli.js", "health"]

ENTRYPOINT ["node", "/opt/seekdesk/apps/runtime-worker/dist/cli.js"]
CMD ["idle"]
