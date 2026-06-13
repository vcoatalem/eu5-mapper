#!/bin/bash
# Shared env loader for curl scripts.
# Parses --stage=<dev|prod> from args (default: dev).
# Sources the matching .env.<stage> file and validates BASE_URL + FAKE_USER_ID.
# Also exports STAGE so callers can derive bucket names.

STAGE="dev"
for arg in "$@"; do
  case "$arg" in
    --stage=*) STAGE="${arg#--stage=}" ;;
  esac
done

ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ENV_DIR/.env.$STAGE"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file for stage '$STAGE' not found. Run 'make deploy' first." >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

if [ -z "${BASE_URL:-}" ]; then
  echo "Error: BASE_URL is not set in $ENV_FILE" >&2
  exit 1
fi

if [ -z "${FAKE_USER_ID:-}" ]; then
  echo "Error: FAKE_USER_ID is not set in $ENV_FILE" >&2
  exit 1
fi
