FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80
ENV HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install -g tsx

COPY server ./server
# Shared constants (e.g. the Plan label set) imported by the server modules
COPY shared ./shared
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data

EXPOSE 80

CMD ["tsx", "server/index.ts"]
