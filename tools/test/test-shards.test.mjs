import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { splitTests } from "../test-shards.mjs";
import { removeTree } from "../../skills/10x-pipeline/scripts/remove-tree.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const durations = JSON.parse(fs.readFileSync(new URL("../test-durations.json", import.meta.url), "utf8"));
const patterns = ["skills/10x-pipeline/test/*.test.mjs", "skills/openspec-pipeline/test/*.test.mjs", "tools/test/*.test.mjs"];

test("longest-first sharding balances duration and starts long files first", () => {
  assert.deepEqual(splitTests(["d", "b", "a", "c"], { a: 8, b: 7, c: 6, d: 5 }, 2), [["a", "d"], ["b", "c"]]);
});

test("every current file and a newly added file appear once across six deterministic shards", () => {
  const files = [...fs.globSync(patterns, { cwd: ROOT }), "new.test.mjs"];
  const shards = splitTests(files, durations, 6);
  assert.deepEqual(shards.flat().sort(), files.toSorted());
  assert.deepEqual(shards, splitTests(files.toReversed(), durations, 6));
  for (const shard of shards) assert.ok(shard.length > 0);
  for (const [file, seconds] of Object.entries(durations)) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), file);
    assert.ok(Number.isFinite(seconds) && seconds > 0, file);
  }
});

test("the shard CLI refuses malformed or empty shards before running tests", () => {
  const run = (args) => spawnSync(process.execPath, ["tools/test-shards.mjs", ...args], { cwd: ROOT, encoding: "utf8", timeout: 5000 });
  for (const args of [[], ["0/6"], ["7/6"], ["1/0"], ["1/1000"], ["1/6", "extra"], ["x/6"], ["1/9007199254740992"]]) {
    const result = run(args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal(result.stdout, "");
    assert.ok(result.stderr.trim());
  }
});

test("the shard runner preserves file order, reports coverage and exits on test failures", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "as-shards-"));
  try {
    const first = path.join(scratch, "z.test.mjs");
    const second = path.join(scratch, "a.test.mjs");
    fs.writeFileSync(first, 'import test from "node:test"; test("scheduled first", () => {});\n');
    fs.writeFileSync(second, 'import test from "node:test"; test("scheduled second", () => { throw new Error("expected fixture failure"); });\n');
    const runner = pathToFileURL(path.join(ROOT, "tools/test-shards.mjs")).href;
    const entry = path.join(scratch, "run.mjs");
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    for (const [files, status] of [[[first], 0], [[first, second], 1]]) {
      const code = `import { runShard } from ${JSON.stringify(runner)}; await runShard(${JSON.stringify(files)});`;
      fs.writeFileSync(entry, code);
      const result = spawnSync(process.execPath, ["--experimental-test-coverage", entry], {
        cwd: ROOT, env, encoding: "utf8", timeout: 10000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, status, result.stdout + result.stderr);
      assert.match(result.stdout, /start of coverage report/);
      if (status === 1) {
        assert.ok(result.stdout.indexOf("scheduled first") < result.stdout.indexOf("scheduled second"));
        assert.match(result.stdout, /expected fixture failure/);
      }
    }
  } finally {
    removeTree(scratch);
  }
});
