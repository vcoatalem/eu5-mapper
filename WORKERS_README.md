# Worker .ts to .js build and usage

## What changed

- You can now write your web worker files in TypeScript (e.g. `canvas-worker.ts`).
- A build script (`scripts/build-workers.js`) automatically transpiles any `*-worker.ts` in `app/components/` to `.js` before the Next.js build.
- The app always loads the `.js` worker file at runtime, ensuring compatibility with browsers and Vercel static hosting.

## How it works

- On `next build`, the `prebuild` script runs and transpiles all `*-worker.ts` files to `.js` using esbuild.
- The `WorkerManager` and all worker instantiations use the `.js` file (never `.ts`).
- You only need to edit the `.ts` file; the `.js` is generated automatically.

## Vercel compatibility

- No custom server or dynamic worker loading is required; all worker files are statically generated and deployed.
- No changes to Next.js or Vercel config are needed beyond this script.

## To add a new worker

1. Create `your-worker.ts` in `app/workers/`.
2. Call WorkerManager.init() with the base filename of your worker
3. The build step will handle the rest.

---

If you have issues with worker loading on Vercel, ensure the `.js` file is present in the deployed output and referenced correctly.
