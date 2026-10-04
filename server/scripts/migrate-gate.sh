#!/bin/sh
set -e

secret=/run/secrets/postgres_password
port="${MIGRATE_GATE_PORT:-5433}"

if [ ! -s "$secret" ]; then
  echo "migrate-gate: no database password provided, skipping (the migrate service will apply migrations)"
  exit 0
fi

if ! nc -z -w 3 127.0.0.1 "$port"; then
  echo "migrate-gate: database is not reachable on 127.0.0.1:$port, skipping (the migrate service will apply migrations)"
  exit 0
fi

echo "migrate-gate: applying pending migrations before the new image is used"
DATABASE_URL="postgresql://postgres:$(cat "$secret")@127.0.0.1:$port/fice?schema=public" \
  npx prisma migrate deploy
