# AI Govern - Docker Deployment

This README provides instructions for deploying the AI Govern application using Docker and Docker Compose.

## Prerequisites

- Docker and Docker Compose installed on your system
- Git to clone the repository

## Getting Started

1. Clone the repository:
   ```
   git clone <your-repository-url>
   cd ai-govern
   ```

2. Build and start the containers:
   ```
   docker-compose up -d --build
   ```

   This will:
   - Build the frontend and backend images
   - Start the PostgreSQL database
   - Run database migrations
   - Start all services

3. Initialize the database (first run only):
   ```
   docker-compose exec -e INIT_DB=true backend npm run db:seed
   ```

4. Access the application:
   - Frontend and API: http://localhost:5000

## Default Login Credentials

- Username: admin_demo_org
- Password: password123

## Container Architecture

The application is split into three containers:

1. **Frontend Container**:
   - React/TypeScript application
   - Build container only (doesn't serve content)
   - Compiles frontend assets and places them in a shared volume

2. **Backend Container**:
   - Node.js/Express server
   - Runs on port 5000
   - Handles API requests, authentication, and file processing
   - Serves the compiled frontend assets from the shared volume
   - Acts as the single entry point for the application

3. **PostgreSQL Container**:
   - Database for the application
   - Persists data via Docker volume
   - Runs on port 5432

## Data Persistence

Data is persisted through Docker volumes:

- `postgres-data`: Database files
- `uploads`: User-uploaded files
- `frontend-build`: Built frontend assets (shared between frontend and backend containers)

## Environment Variables

You can customize the deployment by modifying the environment variables in the `docker-compose.yml` file:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption
- `NODE_ENV`: Application environment (production/development)

## Troubleshooting Network Issues

If you encounter network errors during the build process (especially with npm install):

1. **Use a package proxy or mirror**:
   ```
   # In .npmrc
   registry=https://registry.npmmirror.com/
   ```

2. **Build with an alternative DNS**:
   ```
   docker-compose build --build-arg "npm_config_registry=https://registry.npmmirror.com/"
   ```

3. **Try using a VPN or different network connection**

4. **Use Docker's buildkit with network retries**:
   ```
   DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker-compose up -d --build
   ```

5. **Build behind a proxy**:
   ```
   docker-compose build --build-arg http_proxy=http://proxy-url:port --build-arg https_proxy=http://proxy-url:port
   ```

## Common Commands

- Start the application:
  ```
  docker-compose up -d
  ```

- Stop the application:
  ```
  docker-compose down
  ```

- View logs:
  ```
  docker-compose logs -f
  ```

- Rebuild and restart containers:
  ```
  docker-compose up -d --build
  ```

- Reset the database:
  ```
  docker-compose down -v
  docker-compose up -d
  docker-compose exec -e INIT_DB=true backend npm run db:seed
  ``` 