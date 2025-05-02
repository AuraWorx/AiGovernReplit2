FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY shared/ ./shared/

# Install production dependencies
RUN npm install --production

# Copy server source code
COPY server/ ./server/
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5000

ENV NODE_ENV=production
CMD ["npm", "run", "start"]