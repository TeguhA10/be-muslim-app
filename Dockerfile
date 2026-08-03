# ==========================================
# 1. BUILD STAGE
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for building
COPY package*.json ./
RUN npm ci

# Copy source files and compile TypeScript
COPY tsconfig.json ./
COPY src ./src
COPY db ./db
RUN npm run build

# ==========================================
# 2. PRODUCTION RUNTIME STAGE
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled JavaScript code & database migrations
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db

# Container Healthcheck (OWASP Recommendation)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Security: Run container as non-root node user
USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
