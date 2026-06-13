#!/bin/bash
# Full save file pipeline: presign → upload → poll → save JSON result
# Usage: ./game-data-from-save-file.sh --save-file=<path.eu5> [--output=<out.json>] --stage=<dev|prod>
#
# NOTE: Requires a deployed AWS stage — does NOT work with serverless-offline because:
#   - serverless-s3-local does not forward S3 ObjectCreated events to offline lambdas
#   - the rakaly lambda is ECR image-based and cannot be invoked by serverless-offline

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_env.sh" "$@"

SAVE_FILE=""
OUTPUT_FILE="game-data.json"
for arg in "$@"; do
  case "$arg" in
    --save-file=*) SAVE_FILE="${arg#--save-file=}" ;;
    --output=*)    OUTPUT_FILE="${arg#--output=}" ;;
  esac
done

if [ -z "$SAVE_FILE" ]; then
  echo "Error: --save-file=<path.eu5> is required" >&2
  exit 1
fi

if [ ! -f "$SAVE_FILE" ]; then
  echo "Error: save file not found: $SAVE_FILE" >&2
  exit 1
fi

POLL_INTERVAL=3   # seconds between polls
POLL_TIMEOUT=600  # total seconds before giving up (covers 3 Lambda retry attempts)

T_TOTAL=$(date +%s)

elapsed() {
  echo $(( $(date +%s) - $1 ))s
}

# ── 1. Get pre-signed URLs ────────────────────────────────────────────────────

echo "→ Getting pre-signed URLs (fakeId=$FAKE_USER_ID)..."
T=$(date +%s)
PRESIGN=$(curl -s --fail-with-body "$BASE_URL/upload-url?fakeId=$FAKE_USER_ID") || {
  echo "  Presign request failed: $PRESIGN" >&2
  exit 1
}
echo "  done ($(elapsed $T))"

UPLOAD_URL=$(echo "$PRESIGN" | jq -r '.uploadUrl')
CONVERTED_URL=$(echo "$PRESIGN" | jq -r '.convertedUrl')
POLL_URL=$(echo "$PRESIGN" | jq -r '.pollUrl')
UPLOAD_ID=$(echo "$PRESIGN" | jq -r '.uploadId')

echo "  uploadId: $UPLOAD_ID"

# ── 2. Upload save file to S3 ─────────────────────────────────────────────────

echo "→ Uploading $SAVE_FILE..."
T=$(date +%s)
UPLOAD_RESPONSE=$(curl -s --fail-with-body -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@$SAVE_FILE") || {
  echo "  S3 upload failed: $UPLOAD_RESPONSE" >&2
  exit 1
}
echo "  done ($(elapsed $T)) — key: $FAKE_USER_ID/$UPLOAD_ID.eu5"

# ── 3. Poll until parsed JSON is available ────────────────────────────────────

echo "→ Polling for result (timeout ${POLL_TIMEOUT}s)..."
T=$(date +%s)
DEADLINE=$(( $(date +%s) + POLL_TIMEOUT ))

while true; do
  if [ "$(date +%s)" -ge "$DEADLINE" ]; then
    echo "  Timed out after ${POLL_TIMEOUT}s." >&2
    exit 1
  fi

  STATUS=$(curl -s --head -o /dev/null -w "%{http_code}" "$POLL_URL" || echo "000")

  if [ "$STATUS" = "200" ]; then
    echo "  ready ($(elapsed $T))"
    break
  elif [ "$STATUS" = "000" ]; then
    echo "  curl failed (network error), retrying..." >&2
  elif [ "$STATUS" != "403" ] && [ "$STATUS" != "404" ]; then
    echo "  Unexpected HTTP status $STATUS while polling — aborting." >&2
    exit 1
  fi

  sleep "$POLL_INTERVAL"
done

# ── 4. Fetch and store result ─────────────────────────────────────────────────

echo "→ Fetching result..."
T=$(date +%s)
curl -s --fail-with-body "$CONVERTED_URL" -o "$OUTPUT_FILE" || {
  echo "  Failed to fetch result." >&2
  exit 1
}
echo "  done ($(elapsed $T)) — saved to $OUTPUT_FILE"

echo "→ Total: $(elapsed $T_TOTAL)"
