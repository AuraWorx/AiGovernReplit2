#!/bin/bash
# Script to manually fix frontend directory issues if needed

# Run this inside the backend container if you're still having issues:
# docker-compose exec backend /bin/sh -c "sh /app/fix-frontend.sh"

echo "Fixing frontend asset locations..."

# Check if vite build created assets
if [ -d "/app/dist/public" ]; then
  echo "Found assets in /app/dist/public"
  
  # Create server/public directory if it doesn't exist
  mkdir -p /app/server/public
  
  # Copy assets to the location expected by the server
  echo "Copying assets to /app/server/public"
  cp -r /app/dist/public/* /app/server/public/
  
  echo "Assets copied successfully!"
  echo "Directory structure:"
  ls -la /app/server/public
else
  echo "No assets found in /app/dist/public"
  
  # If we have the client directory, try to build
  if [ -d "/app/client" ] && [ -f "/app/vite.config.ts" ]; then
    echo "Attempting to build frontend locally..."
    
    # Run vite build
    npx vite build
    
    # Check if build succeeded
    if [ -d "/app/dist/public" ]; then
      echo "Build successful! Copying assets..."
      mkdir -p /app/server/public
      cp -r /app/dist/public/* /app/server/public/
      echo "Assets copied successfully!"
    else
      echo "Build failed. No assets generated."
      exit 1
    fi
  else
    echo "Cannot build frontend - missing client directory or vite config."
    exit 1
  fi
fi

echo "Fix complete. The server should now be able to find the frontend assets."
echo "Restart the container for changes to take effect." 