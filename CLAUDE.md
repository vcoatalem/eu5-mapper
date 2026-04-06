# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

EU5 Mapper is a Next.js web app for visualizing and planning in Europa Universalis 5. Its core feature is computing **proximity** between game locations — a key game mechanic — using the same adjacency/pathfinding rules as the game engine.

## Commands

```bash
# Development
npm run dev                    # Start Next.js dev server (localhost:3000)
npm run build:workers:watch    # Compile web workers in watch mode (run in parallel with dev)

# Build
npm run build                  # Next.js production build
npm run build:workers          # One-shot worker build

# Quality
npm run lint                   # ESLint
npm run types                  # TypeScript type-check (no emit)
npm run test                   # Jest (pathfinding accuracy tests)

# Utilities
npm run parse-savegame -- <input-file> [output-file]  # Parse EU5 save file to JSON
```

**Workers must be compiled separately.** The app will not function without running `npm run build:workers` (or the watch variant during development), because `workers/dist/` is what the browser loads.

## Architecture

### Data flow

1. **Game data** is fetched from a CDN (not in this repo) based on the game version selected. The URL and SHA are in `app/config/gameData.config.ts`. Each version has a `manifest.json` describing the files.
2. `GameDataLoaderHelper` (`app/lib/gameDataLoader.helper.ts`) fetches, decompresses (gzip), and validates each file with Zod schemas.
3. Parsed data is written to **IndexedDB** so web workers can access it directly. `AppContextProvider` orchestrates this and provides `gameData` + `imagePaths` via React context.

### State management

Controllers extend `Observable<T>` (`app/lib/observable.ts`) — a minimal pub/sub class. React components subscribe using `useSyncExternalStore`. Key controllers:

- `gameStateController` — selected location, country, and user-configured buffs
- `proximityComputationController` — triggers proximity computation when game state changes
- `editModeController` — road/maritime connection editing state
- `colorSearchController`, `shortestPathController`, `neighborsProximityComputationController`, `layerVisibilityController`

### Web workers

Two workers are compiled from `workers/` using esbuild (`scripts/build-and-publish-workers.js`):

- **canvas-worker** — pixel-level color search (scanline flood fill) to map clicked canvas coordinates to game locations
- **graph-worker** — proximity/pathfinding (Dijkstra on `CompactGraph`) and neighbor computation

`workerManager` (`app/lib/workerManager.ts`) manages pools of each worker type and routes tasks per `workerManagerConfig` (`app/lib/workerManager.config.ts`). Workers read game data directly from IndexedDB.

### Map rendering

The world map is rendered on multiple stacked `<canvas>` elements (`CanvasName` type in `app/lib/types/rendering.ts`). The drawing layer, border layer, and terrain layer are separate PNG images loaded from the CDN. `DrawingService` handles canvas painting. `cameraController` manages pan/zoom.

### Routing

The app uses a versioned route: `app/[version]/page.tsx`. `version.guard.ts` validates the version param against a list of supported versions.

### Pathfinding tests

`tests/pathfinding/` contains accuracy tests that compare computed proximity against manually collected reference CSVs from the actual game. Reference files in `tests/pathfinding/references/<version>/` are auto-discovered by `pathfinding.test.ts`. Adding a new CSV automatically runs it in CI.

### Save game import pipeline (`serverless/`)

Three AWS Lambda functions process EU5 save files end-to-end. All are TypeScript/Node.js, managed by Serverless Framework. See `serverless/README.md` for full details.

| Lambda | Trigger | Role |
|---|---|---|
| `presign` | HTTP GET `/upload-url?fakeId=` | Issues pre-signed S3 PUT + GET URLs |
| `rakaly` | S3 ObjectCreated (uploads bucket) + HTTP POST | Runs rakaly binary, gzips output |
| `jomini` | S3 ObjectCreated (melted bucket) + HTTP POST | Gunzips, parses with jomini WASM, writes JSON |

Key files in the app layer:
- `app/lib/fakeId.ts` — `getFakeId()` returns `dev_{GIT_SHA}` in dev, `undefined` in prod (gates the feature)
- `app/lib/saveFileUpload.ts` — `uploadSaveFile()` + `pollUntilReady()` (exponential backoff, 5 min timeout)
- `app/lib/jomini/parse.ts` — parsing logic used in-browser; `serverless/jomini-lambda/parse.ts` is the Lambda copy (only difference: `ZodGameDataVersion` is inlined instead of imported from `@/app/config`)

**Dev workflow:**
```bash
cd serverless
make dev       # build + sls offline (HTTP :3001)
# set NEXT_PUBLIC_PRESIGN_API_URL=http://localhost:3001 in .env.local
# S3 triggers don't fire offline — use POST /invoke/rakaly and /invoke/jomini manually
```

**Deploy:**
```bash
cd serverless && make deploy       # → dev stage
cd serverless && make deploy-prod  # → prod stage
# copy PresignApiUrl from output → NEXT_PUBLIC_PRESIGN_API_URL in .env.local
```
