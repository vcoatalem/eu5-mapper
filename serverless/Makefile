.PHONY: build deploy deploy-prod destroy dev test test-unit \
        test-rakaly test-rakaly-docker test-jomini logs-rakaly logs-jomini logs-presign

STAGE       ?= dev
AWS_PROFILE ?= default
SLS         := npx sls

# ── Build ──────────────────────────────────────────────────────────────────────

## Compile all Lambda handlers with esbuild
build:
	@npm run build

# ── Deploy ─────────────────────────────────────────────────────────────────────

## Build and deploy to dev stage (default)
deploy: build
	@set -o pipefail; AWS_PROFILE=$(AWS_PROFILE) $(SLS) deploy --stage $(STAGE) 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | tee /tmp/sls-deploy-out.txt
	@URL=$$(AWS_PROFILE=$(AWS_PROFILE) $(SLS) info --stage $(STAGE) 2>&1 \
	    | sed 's/\x1b\[[0-9;]*m//g' \
	    | grep -oE 'https://[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com' \
	    | head -1); \
	  if [ -n "$$URL" ]; then \
	    printf 'BASE_URL=%s\nFAKE_USER_ID=dev_%s\n' "$$URL" "$$(git rev-parse --short HEAD)" > .env.$(STAGE); \
	    echo ""; \
	    echo "→ Wrote .env.$(STAGE) — set NEXT_PUBLIC_PRESIGN_API_URL=$$URL in your app .env.local"; \
	  else \
	    echo ""; \
	    echo "⚠ Could not extract PresignApiUrl — write .env.$(STAGE) manually (see .env.example)"; \
	  fi

## Build and deploy to prod stage
deploy-prod: build
	@set -o pipefail; AWS_PROFILE=$(AWS_PROFILE) $(SLS) deploy --stage prod --no-color | tee /tmp/sls-deploy-out.txt
	@echo "--- sls output ---"; cat /tmp/sls-deploy-out.txt; echo "--- end ---"; \
	  URL=$$(grep 'PresignApiUrl' /tmp/sls-deploy-out.txt | awk '{print $$NF}'); \
	  if [ -n "$$URL" ]; then \
	    printf 'BASE_URL=%s\nFAKE_USER_ID=\n' "$$URL" > .env.prod; \
	    echo ""; \
	    echo "→ Wrote .env.prod (set FAKE_USER_ID manually) — set NEXT_PUBLIC_PRESIGN_API_URL=$$URL in your app .env.local"; \
	  else \
	    echo ""; \
	    echo "⚠ Could not extract PresignApiUrl — write .env.prod manually (see .env.example)"; \
	    echo "  (check /tmp/sls-deploy-out.txt to debug)"; \
	  fi

# ── Destroy ────────────────────────────────────────────────────────────────────

## Empty S3 buckets then tear down the dev stack (DESTRUCTIVE)
destroy:
	@bash scripts/empty-buckets.sh --stage=$(STAGE)
	@AWS_PROFILE=$(AWS_PROFILE) $(SLS) remove --stage $(STAGE)

# ── Local dev ──────────────────────────────────────────────────────────────────

## Build and start serverless-offline (HTTP on :3001, local S3 on :4569)
## Set NEXT_PUBLIC_PRESIGN_API_URL=http://localhost:3001 in your .env.local
## S3 event triggers do NOT fire automatically in offline mode.
## Use `make invoke-rakaly` and `make invoke-jomini` to test those handlers.
dev: build
	@$(SLS) offline start

# ── Tests ──────────────────────────────────────────────────────────────────────

## Run all tests
test:
	@npm test

## Run presign unit tests only (no binary required)
test-unit:
	@npm run test:unit

## Run rakaly integration test natively (Linux only — binary is linux/amd64)
test-rakaly:
	@npm run test:rakaly

## Build the test Docker image (linux/amd64 + Node 22 + rakaly binary).
## Rebuilt automatically when Dockerfile.test or the binary changes.
rakaly-lambda/.test-image: rakaly-lambda/Dockerfile.test rakaly-lambda/rakaly
	@docker build --platform linux/amd64 \
		-t eu5mapper-rakaly-test \
		-f rakaly-lambda/Dockerfile.test \
		rakaly-lambda/
	@touch rakaly-lambda/.test-image

## Run rakaly integration test inside the test Docker image (works on any host).
## node_modules are cached in a named Docker volume so host packages are unaffected.
test-rakaly-docker: rakaly-lambda/.test-image
	@docker run --rm --platform linux/amd64 \
		-v "$(CURDIR):/app" \
		-v eu5mapper-node-modules-linux:/app/node_modules \
		-w /app \
		eu5mapper-rakaly-test \
		sh -c "npm ci --silent && npx jest tests/rakaly.test.ts"

## Run jomini integration test
test-jomini:
	@npm run test:jomini

# ── Logs (deployed stage) ──────────────────────────────────────────────────────

logs-presign:
	@AWS_PROFILE=$(AWS_PROFILE) $(SLS) logs -f presign --tail --stage $(STAGE)

logs-rakaly:
	@AWS_PROFILE=$(AWS_PROFILE) $(SLS) logs -f rakaly --tail --stage $(STAGE)

logs-jomini:
	@AWS_PROFILE=$(AWS_PROFILE) $(SLS) logs -f jomini --tail --stage $(STAGE)
