#!/usr/bin/env bash
# Railway: wait for Postgres + Redis, then run Bull worker.
set -euo pipefail

HOST="${DATABASE_HOST:-postgres}"
PORT="${DATABASE_PORT:-5432}"
if [ -n "${DATABASE_URL:-}" ]; then
  HOST="$(node -e 'const u=new URL(process.env.DATABASE_URL); process.stdout.write(u.hostname)')"
  PORT="$(node -e 'const u=new URL(process.env.DATABASE_URL); process.stdout.write(u.port||5432)')"
fi
/opt/wait-for-it.sh "${HOST}:${PORT}" -t 60

if [ -n "${REDIS_URL:-}" ]; then
  RHOST="$(node -e 'const u=new URL(process.env.REDIS_URL); process.stdout.write(u.hostname)')"
  RPORT="$(node -e 'const u=new URL(process.env.REDIS_URL); process.stdout.write(u.port||6379)')"
  /opt/wait-for-it.sh "${RHOST}:${RPORT}" -t 60
fi

exec npm run start:worker:prod
