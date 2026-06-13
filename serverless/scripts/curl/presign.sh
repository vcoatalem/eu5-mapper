#!/bin/bash
# GET /upload-url — returns pre-signed S3 upload + result URLs
# Usage: ./presign.sh --stage=<dev|prod>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_env.sh" "$@"

RESPONSE=$(curl -s --fail-with-body "$BASE_URL/upload-url?fakeId=$FAKE_USER_ID")
echo "$RESPONSE" | jq .

UPLOAD_ID=$(echo "$RESPONSE" | jq -r '.uploadId')

echo ""
echo "→ Next: upload your file, then run:"
echo "   ./rakaly.sh --stage=$STAGE --input-filename=$UPLOAD_ID.eu5"
