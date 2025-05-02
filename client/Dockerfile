# Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY client/package*.json ./client/
COPY shared/ ./shared/

# Install dependencies
RUN npm install

# Copy client source code
COPY client/ ./client/
COPY tsconfig.json ./

# Build the React application
RUN npm run build

# Production stage - Nginx to serve static files
FROM nginx:alpine

# Copy built files from build stage to nginx serve directory
COPY --from=build /app/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]