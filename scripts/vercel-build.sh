#!/usr/bin/env bash
# Vercel build command (vercel.json). Production builds apply pending Prisma
# migrations before building; preview builds never touch the schema, because
# preview deployments share the production database.
# See docs/deployment/database-migrations.md.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "Applying database migrations (VERCEL_ENV=production)"
  npx prisma migrate deploy
else
  echo "Skipping database migrations (VERCEL_ENV=${VERCEL_ENV:-unset})"
fi

npm run build
