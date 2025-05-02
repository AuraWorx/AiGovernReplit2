# Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY shared/ ./shared/

# Install dependencies
RUN npm install

# Copy all source code needed for the build
COPY client/ ./client/
COPY tsconfig.json ./
COPY vite.config.ts ./

# Create a custom build script that will build just the frontend
RUN echo '#!/bin/sh\ncd /app\nvite build client/index.html --outDir client/dist' > /app/build-frontend.sh && \
    chmod +x /app/build-frontend.sh

# Build the React application with our custom script
RUN /app/build-frontend.sh

# Production stage - Nginx to serve static files
FROM nginx:alpine

# Copy built files from build stage to nginx serve directory
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]