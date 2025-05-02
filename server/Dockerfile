FROM node:20-slim AS build

WORKDIR /app

# Copy package files and install all dependencies for building
COPY package*.json ./
COPY shared/ ./shared/

# Install dependencies including devDependencies needed for build
RUN npm install

# Copy server source code and configuration
COPY server/ ./server/
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# Create a custom script to build the server
RUN echo '#!/bin/sh\ncd /app\nesbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist' > /app/build-server.sh && \
    chmod +x /app/build-server.sh

# Build the server
RUN /app/build-server.sh

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy built files from build stage
COPY --from=build /app/dist /app/dist
COPY --from=build /app/shared /app/shared

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5000

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]