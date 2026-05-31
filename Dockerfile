# ── Stage 1: Build ──
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

# Compile seed.ts for production (ts-node not available in runner)
RUN printf '{"compilerOptions":{"module":"commonjs","target":"ES2022","esModuleInterop":true,"skipLibCheck":true,"outDir":"dist/seed","moduleResolution":"node","declaration":false},"include":["prisma/seed.ts"]}' > tsconfig.seed.json \
    && npx tsc --project tsconfig.seed.json

# ── Stage 2: Production ──
FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies (bcrypt needs temporary build tools)
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps

# Prisma: generated client + CLI + engines from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Built application
COPY --from=builder /app/dist ./dist

# Compiled seed
COPY --from=builder /app/dist/seed/seed.js ./dist/seed.js

COPY entrypoint.sh .
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

ENTRYPOINT ["./entrypoint.sh"]
