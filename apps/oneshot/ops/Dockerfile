FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json
COPY e2e/package.json e2e/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
COPY --from=build /app/node_modules node_modules
EXPOSE 2567
CMD ["node", "server/dist/index.js"]
