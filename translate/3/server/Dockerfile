FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
COPY service.mjs server.mjs ./
USER node
ENV NODE_ENV=production
CMD ["node","server.mjs"]
