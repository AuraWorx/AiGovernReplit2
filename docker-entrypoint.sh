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
if [ -f "/app/dist/public/index.html" ]; then
  echo "Frontend assets found in /app/dist/public, copying to server/public..."
  mkdir -p /app/server/public
  cp -r /app/dist/public/* /app/server/public/
elif [ -d "/app/client" ] && [ -f "/app/vite.config.ts" ]; then
  echo "Building frontend assets locally..."
  npx vite build
  # Create server/public directory and copy the built assets there
  mkdir -p /app/server/public
  cp -r /app/dist/public/* /app/server/public/
else
  echo "Error: Cannot find frontend assets and cannot build them."
  exit 1
fi
echo "Frontend assets are available in the correct location"

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