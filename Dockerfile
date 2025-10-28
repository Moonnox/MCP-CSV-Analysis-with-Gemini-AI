# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline --no-audit; else npm install --prefer-offline --no-audit; fi

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

# Install Python and dependencies for chart rendering
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    py3-wheel \
    gcc \
    musl-dev \
    python3-dev \
    libffi-dev \
    openssl-dev \
    wget

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --prefer-offline --no-audit; else npm install --omit=dev --prefer-offline --no-audit; fi

# Copy compiled code from builder stage
COPY --from=builder /app/dist ./dist

# Copy Python scripts and requirements
COPY scripts/ ./scripts/
COPY requirements.txt ./

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Set production environment
ENV NODE_ENV=production

# Create output directory
RUN mkdir -p /app/output && chmod 755 /app/output

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the HTTP port
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]

