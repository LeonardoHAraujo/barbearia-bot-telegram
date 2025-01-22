FROM node:20-alpine AS base

FROM base AS build
RUN mkdir /app && chown -R node:node /app
WORKDIR /app
COPY --chown=node:node package*.json ./
COPY --chown=node:node . .
RUN \
  npm install --silent \
  && npm cache clean --force 
RUN npm run build

FROM base AS production
ENV NODE_ENV production
WORKDIR /app
RUN chown -R node:node /app
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/package*.json ./
COPY --chown=node:node --from=build /app/.env ./
USER node
CMD [ "node", "dist/index.js" ]