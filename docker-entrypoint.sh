#!/bin/sh
set -e

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
until nc -z postgres 5432; do
  sleep 1
done
echo "PostgreSQL is ready"

# Check if frontend assets are available in the volume
echo "Checking for frontend assets..."
if [ ! -f "/app/dist/public/index.html" ]; then
  echo "Warning: Frontend assets not found in the expected location."
  echo "Checking if we need to build them locally..."
  
  # If we have the client directory, try to build the frontend
  if [ -d "/app/client" ] && [ -f "/app/vite.config.ts" ]; then
    echo "Building frontend assets locally..."
    npx vite build
  else
    echo "Error: Cannot find frontend assets and cannot build them."
    exit 1
  fi
fi
echo "Frontend assets are available"

# Run database migrations
echo "Running database migrations..."
npm run db:push

# Seed the database if needed (only on first run)
if [ "$INIT_DB" = "true" ]; then
  echo "Seeding the database..."
  npm run db:seed
fi

# Start the application
echo "Starting application..."
exec "$@" 