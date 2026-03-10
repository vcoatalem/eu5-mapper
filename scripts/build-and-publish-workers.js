// This file ensures that all .ts worker files in app/components are transpiled to .js and placed in the same directory for use by WorkerManager.
// It is called in Vercel build pipeline
// Can be run locally (see command in package.json) to develop with workers

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const workersDir = path.join(__dirname, "..", "workers");
const publicWorkersDir = path.join(__dirname, "..", "public", "workers");

fs.readdirSync(workersDir, { recursive: true }).forEach((file) => {
  if (file.endsWith("-worker.ts")) {
    const inputPath = path.join(workersDir, file);
    const outPath = path.join(workersDir, "dist", file.replace(/\.ts$/, ".js"));
    esbuild.buildSync({
      entryPoints: [inputPath],
      outfile: outPath,
      bundle: true, // Bundle all dependencies into one file
      format: "iife",
      platform: "browser",
      target: ["es2020"],
      minify: false,
    });
    console.log(`Transpiled ${file} -> ${outPath}`);

    // Copy to public/workers
    const fileName = path.basename(outPath);
    const destPath = path.join(publicWorkersDir, fileName);
    fs.copyFileSync(outPath, destPath);
    console.log(`Copied ${outPath} -> ${destPath}`);
  }
});
