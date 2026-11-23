// Greedy longest-first assignment using case durations from CI run 43973074457.
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { run } from "node:test";
import { spec } from "node:test/reporters";
import { isEntryPoint } from "../skills/10x-pipeline/scripts/pr-common.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PATTERNS = ["skills/10x-pipeline/test/*.test.mjs", "skills/openspec-pipeline/test/*.test.mjs", "tools/test/*.test.mjs"];

export function splitTests(files, durations, count) {
  const seconds = (file) => durations[file] ?? 5;
  const shards = Array.from({ length: count }, () => ({ files: [], seconds: 0 }));
  for (const file of files.toSorted().sort((a, b) => seconds(b) - seconds(a))) {
    const shard = shards.reduce((best, candidate) => candidate.seconds < best.seconds ? candidate : best);
    shard.files.push(file);
    shard.seconds += seconds(file);
  }
  return shards.map((shard) => shard.files);
}

export async function runShard(files) {
  // The API preserves file order, while the CLI sorts file arguments alphabetically.
  const tests = run({ files, concurrency: 2, coverage: true, cwd: ROOT });
  tests.on("test:fail", () => { process.exitCode = 1; });
  await pipeline(tests, new spec(), process.stdout);
}

if (isEntryPoint(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const match = args.length === 1 && /^([1-9]\d*)\/([1-9]\d*)$/.exec(args[0]);
    if (!match) throw new Error("Usage: node tools/test-shards.mjs <index>/<total>");
    const index = Number(match[1]);
    const total = Number(match[2]);
    const files = [...fs.globSync(PATTERNS, { cwd: ROOT })];
    if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) || index > total || total > files.length) {
      throw new Error("Shard index must be between 1 and total, with at most one shard per test file");
    }
    const durations = JSON.parse(fs.readFileSync(new URL("./test-durations.json", import.meta.url), "utf8"));
    const selected = splitTests(files, durations, total)[index - 1];
    await runShard(selected);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
