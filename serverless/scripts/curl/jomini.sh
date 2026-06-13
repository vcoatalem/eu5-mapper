#!/bin/bash
# POST /invoke/jomini — parses a melted .txt.gz and writes structured JSON
# Usage: ./jomini.sh --stage=<dev|prod> --input-filename=<file.melted.txt.gz>

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
  echo "Error: --input-filename=<file.melted.txt.gz> is required" >&2
  exit 1
fi

MELTED_BUCKET="eu5mapper-saves-melted-$STAGE"
CONVERTED_BUCKET="eu5mapper-saves-converted-$STAGE"

RESPONSE=$(curl -s -X POST "$BASE_URL/invoke/jomini" \
  -H "Content-Type: application/json" \
  -d "{\"bucket\": \"$MELTED_BUCKET\", \"key\": \"$FAKE_USER_ID/$INPUT_FILENAME\"}")
echo "$RESPONSE" | jq .

OUTPUT_KEY=$(echo "$RESPONSE" | jq -r '.outputKey')
OUTPUT_FILENAME=$(basename "$OUTPUT_KEY")

echo ""
echo "→ Input:  s3://$MELTED_BUCKET/$FAKE_USER_ID/$INPUT_FILENAME"
echo "→ Output: s3://$CONVERTED_BUCKET/$OUTPUT_KEY"
echo ""
echo "→ Next: result JSON available at s3://$CONVERTED_BUCKET/$OUTPUT_KEY"
