#!/usr/bin/env tsx
import fs from "fs/promises";

const usage = () => {
  console.log("Usage: npm run parse-savegame -- <input-file> [output-file]");
  process.exit(1);
};

const main = async () => {
  const Jomini = (await import("jomini")).Jomini;

  const args = process.argv.slice(2);
  if (args.length === 0) usage();
  const input = args[0];
  const out = args[1] ?? `${input}.json`;

  try {
    const content = await fs.readFile(input, "utf8");
    const jomini = await Jomini.initialize();
    const parsed = jomini.parseText(content, {}, (q) => ({
      root: q.root(),
      json: q.json(),
    }));

    let jsonStr = parsed.json;
    if (typeof jsonStr !== "string") {
      throw new Error("Expected Jomini to return a JSON string");
    }

    await fs.writeFile(out, jsonStr, "utf8");
    console.log(`Wrote parsed json to ${out}`);
  } catch (err) {
    console.error("Error parsing or writing file:", err);
    process.exit(2);
  }
};

main();
