#!/bin/bash
# This script injects the commit SHA into the meta tag in app/layout.tsx

# Check if commit SHA argument is provided
if [ -z "$1" ]; then
  echo "Error: Commit SHA argument is required" >&2
  echo "Usage: $0 <commit-sha>" >&2
  exit 1
fi

COMMIT_SHA="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAYOUT_PATH="${SCRIPT_DIR}/../app/layout.tsx"

# Check if layout file exists
if [ ! -f "$LAYOUT_PATH" ]; then
  echo "Error: Layout file not found at $LAYOUT_PATH" >&2
  exit 1
fi

# Check if the meta tag exists using grep
if ! grep -q 'name="commit-sha"' "$LAYOUT_PATH"; then
  echo "Error: Could not find commit-sha meta tag in layout.tsx" >&2
  exit 1
fi

# Use sed to replace the content value
# This matches: <meta name="commit-sha" content="XXX" />
# and replaces XXX (or any existing value) with the commit SHA
if sed -i.bak "s/\(<meta[[:space:]]*name=\"commit-sha\"[[:space:]]*content=\"\)[^\"]*\(\"[[:space:]]*\/>\)/\1${COMMIT_SHA}\2/" "$LAYOUT_PATH"; then
  # Remove backup file if sed created one (macOS sed behavior)
  [ -f "${LAYOUT_PATH}.bak" ] && rm "${LAYOUT_PATH}.bak"
  echo "Successfully injected commit SHA: ${COMMIT_SHA}"
else
  echo "Error: Failed to inject commit SHA" >&2
  exit 1
fi
