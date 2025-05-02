FROM node:20-slim AS build

WORKDIR /app

# Copy package files and install all dependencies for building
COPY package*.json ./
COPY shared/ ./shared/
COPY db/ ./db/

# Install ALL dependencies (including dev dependencies like esbuild)
RUN npm install

# Copy ALL necessary source files, including vite.config.ts
COPY server/ ./server/
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY vite.config.ts ./

# Instead of building with esbuild, we'll use tsc which handles paths better
RUN npx tsc
RUN cp -r shared/ dist/shared/
RUN cp -r db/ dist/db/

# Create path mapping before running the application
RUN echo '{"type":"module","imports":{"@db":"./db/index.js","@shared/*":"./shared/*"}}' > dist/package.json

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy built files from build stage
COPY --from=build /app/dist/ /app/
COPY --from=build /app/db/ /app/db/
COPY --from=build /app/shared/ /app/shared/

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5000

ENV NODE_ENV=production
CMD ["node", "index.js"]