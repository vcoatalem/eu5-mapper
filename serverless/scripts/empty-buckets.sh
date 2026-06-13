#!/bin/bash
# Empties all S3 buckets for a given stage.
# Usage: ./scripts/empty-buckets.sh --stage=<dev|prod>
#
# Run this before 'make destroy' if CloudFormation fails because buckets are non-empty.

set -euo pipefail

STAGE="dev"
for arg in "$@"; do
  case "$arg" in
    --stage=*) STAGE="${arg#--stage=}" ;;
  esac
done

if [ "$STAGE" != "dev" ]; then
  echo "Error: --stage must be 'dev'" >&2
  exit 1
fi

BUCKETS=(
  "eu5mapper-saves-uploads-$STAGE"
  "eu5mapper-saves-melted-$STAGE"
  "eu5mapper-saves-converted-$STAGE"
)

for bucket in "${BUCKETS[@]}"; do
  echo "→ Emptying s3://$bucket ..."
  aws s3 rm "s3://$bucket" --recursive && echo "  Done." || echo "  Failed or already empty."
done

echo ""
echo "All buckets emptied for stage '$STAGE'. You can now run 'make destroy'."
