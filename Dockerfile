# ============================================
# Multi-stage Dockerfile — Production Ready
# ============================================

# ============================================
# Stage 1: Base image
# ============================================
FROM node:20-alpine AS base

# Install system dependencies for Prisma + native modules
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    dumb-init \
    curl

WORKDIR /app

# ============================================
# Stage 2: Dependencies
# ============================================
FROM base AS deps

COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev) for prisma generate
RUN npm ci --include=dev

# Generate Prisma Client
RUN npx prisma generate

# ============================================
# Stage 3: Production dependencies only
# ============================================
FROM base AS prod-deps

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npm cache clean --force

# Copy generated Prisma client from deps stage
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

# ============================================
# Stage 4: Builder (final image)
# ============================================
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy production dependencies
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy prisma schema + generated client
COPY --from=deps --chown=nodejs:nodejs /app/prisma ./prisma

# Copy application source
COPY --chown=nodejs:nodejs . .

# Create directories for logs + uploads
RUN mkdir -p logs uploads && \
    chown -R nodejs:nodejs logs uploads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start server
CMD ["node", "src/server.js"]