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
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api

## Default Login Credentials

- Username: admin_demo_org
- Password: password123

## Container Architecture

The application is split into three containers:

1. **Frontend Container**:
   - React/TypeScript application
   - Runs on port 3000
   - Built with Vite

2. **Backend Container**:
   - Node.js/Express server
   - Runs on port 5000
   - Handles API requests, authentication, and file processing

3. **PostgreSQL Container**:
   - Database for the application
   - Persists data via Docker volume
   - Runs on port 5432

## Data Persistence

Data is persisted through Docker volumes:

- `postgres-data`: Database files
- `uploads`: User-uploaded files
- `frontend-build`: Built frontend assets

## Environment Variables

You can customize the deployment by modifying the environment variables in the `docker-compose.yml` file:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption
- `NODE_ENV`: Application environment (production/development)

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