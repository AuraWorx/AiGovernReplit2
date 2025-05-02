#!/bin/sh
set -e

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
until nc -z postgres 5432; do
  sleep 1
done
echo "PostgreSQL is ready"

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