# Production-ready Dockerfile for n8n
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy all files for build
COPY . .

# Install dependencies (using --no-frozen-lockfile to handle lockfile issues)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    DOCKER_BUILD=true pnpm install --no-frozen-lockfile

# Build with increased memory
RUN --mount=type=cache,id=turbo,target=/app/.turbo \
    NODE_OPTIONS="--max-old-space-size=4096" \
    pnpm build

# Final production stage
FROM node:22-slim

# Install only runtime dependencies
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    tini \
    && rm -rf /var/lib/apt/lists/*

# Use the existing 'node' user (UID/GID 1000)
WORKDIR /app

# Copy built application with node user ownership
COPY --from=builder --chown=node:node /app .

# Setup data directory for the node user
RUN mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node

# Switch to node user
USER node

# Use tini for proper signal handling
ENTRYPOINT ["tini", "--"]
CMD ["node", "packages/cli/bin/n8n", "start", "--port=8120"]
