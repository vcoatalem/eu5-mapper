// This file ensures that all .ts worker files in app/components are transpiled to .js and placed in the same directory for use by WorkerManager.
// It is used by Next.js custom build steps.

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const workersDir = path.join(__dirname, "..", "app", "workers");

fs.readdirSync(workersDir).forEach((file) => {
  if (file.endsWith("-worker.ts")) {
    const inputPath = path.join(workersDir, file);
    const outPath = path.join(workersDir, "dist", file.replace(/\.ts$/, ".js"));
    esbuild.buildSync({
      entryPoints: [inputPath],
      outfile: outPath,
      bundle: false,
      format: "iife",
      platform: "browser",
      target: ["es2020"],
      minify: false,
    });
    console.log(`Transpiled ${file} -> ${outPath}`);
  }
});
