# Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY shared/ ./shared/

# Install ALL dependencies including dev dependencies
RUN npm install

# Copy all source code needed for the build
COPY client/ ./client/
COPY tsconfig.json ./
COPY vite.config.ts ./

# Build the React application
WORKDIR /app
RUN npx vite build

# Production stage - Nginx to serve static files
FROM nginx:alpine

# Copy built files from build stage to nginx serve directory
COPY --from=build /app/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]