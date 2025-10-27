# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for building)
RUN npm ci --prefer-offline --no-audit

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build the TypeScript project
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine

# Add labels
LABEL maintainer="MCP CSV Analysis"
LABEL description="MCP Server for CSV Analysis with Gemini AI"

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production --prefer-offline --no-audit

# Copy compiled code from builder stage
COPY --from=builder /app/dist ./dist

# Set production environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the HTTP port
EXPOSE 3000

# Install wget for healthcheck
USER root
RUN apk add --no-cache wget
USER nodejs

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]

