# Kochava - Intelligent AI Router
FROM node:18-alpine

# Install bash and curl for scripts
RUN apk add --no-cache bash curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY config ./config
COPY scripts ./scripts
COPY run.sh ./

# Build TypeScript
RUN npm run build

# Make scripts executable
RUN chmod +x run.sh scripts/*.sh

# Create directories
RUN mkdir -p logs embeddings models

# Expose ports (if running server or plugin)
EXPOSE 3000 3001

# Default command
CMD ["node", "dist/interfaces/kochava.js", "--help"]
