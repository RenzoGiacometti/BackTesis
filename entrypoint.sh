#!/bin/sh
set -e

echo "Applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  node dist/seed.js
fi

echo "Starting PluvIA Backend..."
exec node dist/src/main
