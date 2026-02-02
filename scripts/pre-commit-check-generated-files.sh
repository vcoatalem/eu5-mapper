#!/bin/bash

# Pre-commit hook to ensure:
# 1. versions-manifest.json is updated when public/{semver}/ files change
# 2. public/workers/*.js files are updated when workers/*-worker.ts files change

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

# ============================================================================
# Check 1: Manifest file check for semver directories
# ============================================================================
SEMVER_PATTERN='^public/[0-9]+\.[0-9]+\.[0-9]+/'
HAS_SEMVER_CHANGES=false
MANIFEST_FILE="public/versions-manifest.json"
HAS_MANIFEST_CHANGE=false

# Check for semver directory changes
for file in $STAGED_FILES; do
  if [[ $file =~ $SEMVER_PATTERN ]]; then
    HAS_SEMVER_CHANGES=true
    break
  fi
done

# Check if manifest is also staged
if [[ "$STAGED_FILES" == *"$MANIFEST_FILE"* ]]; then
  HAS_MANIFEST_CHANGE=true
fi

# If semver files changed but manifest didn't, block the commit
if [ "$HAS_SEMVER_CHANGES" = true ] && [ "$HAS_MANIFEST_CHANGE" = false ]; then
  echo "❌ Error: Changes detected in public/{semver}/ directories, but versions-manifest.json is not updated."
  echo ""
  echo "Please run 'npm run build:manifest' to update the manifest file, then stage and commit it:"
  echo "  npm run build:manifest"
  echo "  git add public/versions-manifest.json"
  echo ""
  echo "Alternatively, if you intentionally want to commit without updating the manifest,"
  echo "you can bypass this check with: git commit --no-verify"
  exit 1
fi

# ============================================================================
# Check 2: Worker files check
# ============================================================================
WORKER_TS_PATTERN='^workers/.*-worker\.ts$'
MISSING_JS_FILES=()

# Check for worker .ts file changes
for file in $STAGED_FILES; do
  if [[ $file =~ $WORKER_TS_PATTERN ]]; then
    # Extract the base name (e.g., "canvas-worker" from "workers/canvas-worker.ts")
    base_name=$(basename "$file" .ts)
    # Construct the corresponding .js file path
    js_file="public/workers/${base_name}.js"
    
    # Check if the corresponding .js file is also staged
    if [[ "$STAGED_FILES" != *"$js_file"* ]]; then
      MISSING_JS_FILES+=("$js_file")
    fi
  fi
done

# If worker .ts files changed but corresponding .js files didn't, block the commit
if [ ${#MISSING_JS_FILES[@]} -gt 0 ]; then
  echo "❌ Error: Changes detected in workers/*-worker.ts files, but corresponding .js files are not updated."
  echo ""
  echo "The following .js files need to be built and staged:"
  for js_file in "${MISSING_JS_FILES[@]}"; do
    echo "  - $js_file"
  done
  echo ""
  echo "Please run 'npm run build:workers' to build the worker files, then stage and commit them:"
  echo "  npm run build:workers"
  echo "  git add public/workers/*.js"
  echo ""
  echo "Alternatively, if you intentionally want to commit without building workers,"
  echo "you can bypass this check with: git commit --no-verify"
  exit 1
fi

exit 0
