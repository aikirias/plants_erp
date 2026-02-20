#!/usr/bin/env bash
set -euo pipefail

wait_for_port() {
  local host="$1"
  local port="$2"
  until (echo >"/dev/tcp/${host}/${port}") >/dev/null 2>&1; do
    echo "Waiting for ${host}:${port}..."
    sleep 2
  done
}

wait_for_port postgres 5432
wait_for_port redis 6379

echo "Running database migrations..."
yes | yarn medusa db:migrate

BOOTSTRAP_MARKER="${MEDUSA_BOOTSTRAP_MARKER:-/data/bootstrap.done}"

if [ ! -f "${BOOTSTRAP_MARKER}" ]; then
  echo "Running initial seed..."
  yarn seed

  if [ -n "${MEDUSA_ADMIN_EMAIL:-}" ] && [ -n "${MEDUSA_ADMIN_PASSWORD:-}" ]; then
    echo "Creating Medusa admin user ${MEDUSA_ADMIN_EMAIL}..."
    yarn medusa user -e "${MEDUSA_ADMIN_EMAIL}" -p "${MEDUSA_ADMIN_PASSWORD}" || true
  fi

  mkdir -p "$(dirname "${BOOTSTRAP_MARKER}")"
  touch "${BOOTSTRAP_MARKER}"
fi

echo "Starting Medusa backend..."
exec yarn start
