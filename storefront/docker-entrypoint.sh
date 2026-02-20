#!/usr/bin/env bash
set -euo pipefail

KEY_FILE="${PUBLISHABLE_KEY_FILE:-/bootstrap/publishable_key}"

until [ -s "${KEY_FILE}" ]; do
  echo "Waiting for publishable key file at ${KEY_FILE}..."
  sleep 2
done

if [ -z "${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:-}" ]; then
  export NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY="$(cat "${KEY_FILE}")"
fi

echo "Starting Next.js storefront on port 8000..."
exec yarn dev
