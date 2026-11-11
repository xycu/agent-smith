// Shared file guard and plan Files parser of state.mjs (file-guard-dedup).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { guardedStat, readGuarded, planFileTokens, readPlan } from "../scripts/state.mjs";
import { readComplexity } from "../scripts/preplan.mjs";
import { verifyManual } from "../scripts/steps.mjs";
import { removeTree } from "../scripts/remove-tree.mjs";

const policy = JSON.parse(fs.readFileSync(new URL("../policy.json", import.meta.url), "utf8"));
const scratch = () => fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-guard-"));

test("guardedStat and readGuarded", () => {
  const base = scratch();
  try {
    const dir = path.join(base, "d");
    const outside = path.join(base, "o");
    fs.mkdirSync(dir);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(dir, "a.txt"), "hello");
    fs.writeFileSync(path.join(outside, "b.txt"), "secret");
    fs.symlinkSync(path.join(outside, "b.txt"), path.join(dir, "link.txt"));
    fs.symlinkSync(outside, path.join(dir, "sub"));
    assert.equal(readGuarded(path.join(dir, "a.txt"), dir, 100), "hello");
    assert.ok(guardedStat(path.join(dir, "a.txt"), dir)?.isFile());
    assert.equal(readGuarded(path.join(dir, "link.txt"), dir, 100), null, "symlinked file");
    assert.equal(readGuarded(path.join(dir, "sub", "b.txt"), dir, 100), null, "symlinked folder");
    assert.equal(readGuarded(path.join(dir, "a.txt"), dir, 3), null, "oversize");
    assert.equal(readGuarded(path.join(dir, "none.txt"), dir, 100), null, "missing");
    assert.equal(guardedStat(path.join(dir, "a.txt"), path.join(base, "nodir")), null, "missing dir");
    assert.equal(guardedStat(dir, base), null, "a folder");
  } finally {
    removeTree(base);
  }
});

test("planFileTokens", () => {
  assert.deepEqual(planFileTokens("**Files**: `a/b.mjs`, `c.mjs` and more"), ["a/b.mjs", "c.mjs"]);
  assert.deepEqual(planFileTokens("**File**: a.mjs, b.mjs"), ["a.mjs", "b.mjs"]);
  assert.deepEqual(planFileTokens("**Files**: ./a.mjs:12, b.mjs:3-9"), ["a.mjs", "b.mjs"]);
  assert.equal(planFileTokens("Files: a.mjs"), null);
  assert.deepEqual(planFileTokens("**Files**: , ,"), []);
});

// The score file goes through the same guard; the error only words the refusal.
test("readComplexity refuses a score file that is not a regular file under the cap", () => {
  const base = scratch();
  try {
    const change = path.join(base, "change");
    fs.mkdirSync(change);
    const file = path.join(change, policy.score.file);
    const factors = Object.fromEntries([...policy.score.factors.cognitive, ...policy.score.factors.execution]
      .map((name) => [name, { score: 1, evidence: "seen" }]));
    const valid = JSON.stringify({ schemaVersion: policy.score.schemaVersion, factors, unknowns: [], confidence: policy.score.confidences[0] });
    const read = () => readComplexity({ change }, policy);
    assert.deepEqual({ ...read(), error: undefined }, { ok: false, error: undefined, exists: false }, "missing");
    fs.writeFileSync(file, valid);
    assert.equal(read().ok, true, JSON.stringify(read()));
    // A symlink is refused whether its target lies outside the change folder or inside it.
    for (const target of [path.join(base, "elsewhere.json"), path.join(change, "real.json")]) {
      fs.writeFileSync(target, valid);
      fs.unlinkSync(file);
      fs.symlinkSync(target, file);
      assert.deepEqual(read(), { ok: false, error: "a symlink, not a regular file", exists: true }, target);
    }
    fs.unlinkSync(file);
    fs.mkdirSync(file);
    assert.deepEqual(read(), { ok: false, error: "not a regular file", exists: true });
    fs.rmdirSync(file);
    fs.writeFileSync(file, valid + " ".repeat(policy.score.maxBytes));
    assert.deepEqual(read(), { ok: false, error: `larger than ${policy.score.maxBytes} bytes`, exists: true });
  } finally {
    removeTree(base);
  }
});

// A manual-verify tick whose evidence file is a symlink is unproven, whether the link leaves the evidence folder or stays inside.
test("a symlinked evidence file is not valid evidence", () => {
  const base = scratch();
  try {
    const change = path.join(base, "change");
    fs.mkdirSync(path.join(change, "evidence"), { recursive: true });
    fs.writeFileSync(path.join(base, "secret.txt"), "secret\n");
    fs.writeFileSync(path.join(change, "evidence", "real.txt"), "output\n");
    fs.symlinkSync(path.join(base, "secret.txt"), path.join(change, "evidence", "out-link.txt"));
    fs.symlinkSync(path.join(change, "evidence", "real.txt"), path.join(change, "evidence", "in-link.txt"));
    const verify = (name) => {
      const row = `- [x] 1.1 Check it — evidence: evidence/${name}`;
      fs.writeFileSync(path.join(change, "plan.md"), `# Plan\n\n## Phase 1: Part\n\n## Progress\n\n### Phase 1: Part\n\n#### Automated\n\n#### Manual\n\n${row}\n`);
      const last = { step: "manual-verify", startedAt: 0, before: { manual: [{ id: "1.1", text: "1.1 Check it", done: false }], auto: [] } };
      const ok = verifyManual(last, [last], readPlan(path.join(change, "plan.md")), { status: "done" }, { change }, policy);
      return { ok, ticked: last.ticked, unproven: last.unproven };
    };
    assert.deepEqual(verify("real.txt"), { ok: true, ticked: ["1.1"], unproven: [] });
    assert.deepEqual(verify("out-link.txt"), { ok: false, ticked: [], unproven: ["1.1"] });
    assert.deepEqual(verify("in-link.txt"), { ok: false, ticked: [], unproven: ["1.1"] });
  } finally {
    removeTree(base);
  }
});
