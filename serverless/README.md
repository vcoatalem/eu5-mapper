# EU5 Mapper — Save Import Serverless

Serverless Framework stack that processes EU5 save files through a three-stage pipeline.

## Architecture

```
Browser (dev only, gated on fakeId)
  │
  ├─ GET /upload-url?fakeId=dev_{gitSha}
  │     presign Lambda → { uploadUrl (PUT 15min), convertedUrl (GET 1hr) }
  │
  ├─ PUT uploadUrl → uploads bucket: {fakeId}/{uploadId}.eu5
  │                       └─ S3 ObjectCreated trigger
  │                             rakaly Lambda
  │                             └─ runs rakaly binary → gzip → s3 put
  │                                melted bucket: {fakeId}/{uploadId}.melted.txt.gz
  │                                       └─ S3 ObjectCreated trigger
  │                                             jomini Lambda
  │                                             └─ gunzip → parse → s3 put
  │                                                converted bucket: {fakeId}/{uploadId}.json
  │
  └─ poll convertedUrl (HEAD, exp backoff, 5min timeout) → GET JSON → use in app
```

### Three Lambdas

| Function | Trigger | Input | Output |
|---|---|---|---|
| `presign` | HTTP GET `/upload-url` | `?fakeId=` | Pre-signed S3 URLs |
| `rakaly` | S3 ObjectCreated (uploads bucket) + HTTP POST `/invoke/rakaly` | `.eu5` binary | `.melted.txt.gz` |
| `jomini` | S3 ObjectCreated (melted bucket) + HTTP POST `/invoke/jomini` | `.melted.txt.gz` | `.json` |

### Three S3 Buckets

| Bucket | Purpose | Lifecycle |
|---|---|---|
| `eu5mapper-saves-uploads-{stage}` | User uploads | 1 day |
| `eu5mapper-saves-melted-{stage}` | Internal pipeline (rakaly → jomini) | 1 day |
| `eu5mapper-saves-converted-{stage}` | Final parsed JSON (app reads this) | 7 days |

### Key derivation

Both `presign` and `rakaly` must agree on this — it's how the client knows where to poll without an extra round-trip:

```
uploads:   {fakeId}/{uploadId}.eu5
melted:    {fakeId}/{uploadId}.melted.txt.gz
converted: {fakeId}/{uploadId}.json
```

### fakeId

A `fakeId` scopes files to a user. Currently only `dev_${NEXT_PUBLIC_GIT_SHA}` is issued (dev mode only) — the feature is completely disabled in production. When real auth is added, the presign Lambda will issue a real user ID and the pattern in `app/lib/fakeId.ts` changes.

### rakaly binary

The `rakaly` Lambda runs a pre-compiled Linux binary bundled inside a Docker image. The binary is committed to git at `rakaly-lambda/rakaly` — no setup step required.

### Why jomini is not bundled by esbuild

The `jomini` npm package includes a `.wasm` file. esbuild cannot reliably bundle WASM without breaking the WASM loading path. Solution: mark jomini as external (`--external:jomini`) and include `node_modules/jomini/**` in the Lambda package. Node.js resolves it correctly from `/var/task/node_modules/jomini`.

### S3 event triggers in offline mode

`serverless-offline` does not fire S3 event triggers automatically. For local end-to-end testing, use the HTTP fallback endpoints (`/invoke/rakaly`, `/invoke/jomini`) after starting `make dev`.

## Setup

```bash
cd serverless && npm install
```

## Common commands

```bash
make build          # compile all TypeScript handlers with esbuild
make dev            # build + start offline (HTTP :3001, local S3 :4569)
make deploy         # prepare + build + sls deploy --stage dev
make deploy-prod    # prepare + build + sls deploy --stage prod

make test                 # run all jest tests
make test-unit            # presign unit tests only (no binary needed)
make test-rakaly          # rakaly integration test (Linux only)
make test-rakaly-docker   # rakaly integration test via Docker (works on any host)
make test-jomini          # jomini integration test

make invoke-presign # sls invoke local for presign
make invoke-rakaly  # sls invoke local for rakaly (HTTP event)
make invoke-jomini  # sls invoke local for jomini (HTTP event)

make logs-rakaly    # tail deployed rakaly logs
make logs-jomini    # tail deployed jomini logs
```

### AWS profile

Commands default to `AWS_PROFILE=lambda`. Override with:

```bash
make deploy AWS_PROFILE=myprofile STAGE=staging
```

### After deploying

The `sls deploy` output prints a `PresignApiUrl` stack output. Copy it to `.env.local` in the Next.js app:

```
NEXT_PUBLIC_PRESIGN_API_URL=https://xxx.execute-api.eu-west-1.amazonaws.com
```

For local dev with `make dev`, use:

```
NEXT_PUBLIC_PRESIGN_API_URL=http://localhost:3001
```

## Testing

Three layers (see `tests/`):

1. **Unit tests** (`presign.test.ts`) — validate fakeId rules, URL shape. No binary or real AWS needed.
2. **Integration tests** (`rakaly.test.ts`, `jomini.test.ts`) — mock S3 read/write, run real binary/parser against fixture files in `tests/fixtures/`. The rakaly binary is `linux/amd64` only, so the test is skipped when run natively on macOS. Use `make test-rakaly-docker` to run it on any host via Docker (`--platform linux/amd64`). A named Docker volume (`eu5mapper-node-modules-linux`) caches Linux `node_modules` so the host's packages are unaffected.
3. **Manual invocation** — `sls invoke local` with event JSONs in `tests/events/`.

Fixture files (`tests/fixtures/`):
- `SP_SAR.eu5` — binary EU5 save (input for rakaly test)
- `SP_BRI_1395.eu5` — alternate binary save
- `SP_SAR.melted.txt` — plain-text melted output (reference)
- `SP_SAR.melted.txt.gz` — gzipped melted output (input for jomini test)
