#!/bin/bash
# POST /invoke/rakaly — melts a .eu5 save file and stores gzipped output
# Usage: ./rakaly.sh --stage=<dev|prod> --input-filename=<file.eu5>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_env.sh" "$@"

INPUT_FILENAME=""
for arg in "$@"; do
  case "$arg" in
    --input-filename=*) INPUT_FILENAME="${arg#--input-filename=}" ;;
  esac
done

if [ -z "$INPUT_FILENAME" ]; then
  echo "Error: --input-filename=<file.eu5> is required" >&2
  exit 1
fi

OUTPUT_FILENAME="${INPUT_FILENAME%.eu5}.melted.txt.gz"
UPLOADS_BUCKET="eu5mapper-saves-uploads-$STAGE"
MELTED_BUCKET="eu5mapper-saves-melted-$STAGE"

RESPONSE=$(curl -s -X POST "$BASE_URL/invoke/rakaly" \
  -H "Content-Type: application/json" \
  -d "{\"bucket\": \"$UPLOADS_BUCKET\", \"key\": \"$FAKE_USER_ID/$INPUT_FILENAME\"}")
echo "$RESPONSE" | jq .

OUTPUT_KEY=$(echo "$RESPONSE" | jq -r '.outputKey')
OUTPUT_FILENAME=$(basename "$OUTPUT_KEY")

echo ""
echo "→ Input:  s3://$UPLOADS_BUCKET/$FAKE_USER_ID/$INPUT_FILENAME"
echo "→ Output: s3://$MELTED_BUCKET/$OUTPUT_KEY"
echo ""
echo "→ Next:"
echo "   ./jomini.sh --stage=$STAGE --input-filename=$OUTPUT_FILENAME"
