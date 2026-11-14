import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ID_RE } from "../scripts/state.mjs";
import { ID_RE as PR_ID_RE } from "../scripts/pr-common.mjs";
import {
  ROUTE, cleanupAll, makeProject, run, entry, writeLog, writeMetaFile, writeResult, readLogEntries,
} from "./helpers.mjs";
import { makeOpenspecProject } from "../../openspec-pipeline/test/openspec-helpers.mjs";

after(cleanupAll);

// Include empty directories and exact file bytes, so a refused init cannot leave a lock or state folder.
function snapshot(root) {
  return fs.readdirSync(root).sort().map((name) => {
    const file = path.join(root, name);
    return fs.statSync(file).isDirectory() ? [name, snapshot(file)] : [name, fs.readFileSync(file)];
  });
}

function legacyProject(chain) {
  const project = (chain === "10x" ? makeProject : makeOpenspecProject)({ id: "a".repeat(101) });
  writeMetaFile(project, { id: project.id, goal: "fix typo", ...(chain === "openspec" ? { chain } : {}) });
  writeLog(project, [entry(1, chain === "10x" ? "plan" : "os-propose")]);
  return project;
}

test("router and PR id patterns agree on grammar and length", () => {
  assert.equal(ID_RE.source, PR_ID_RE.source);
  assert.equal(ID_RE.flags, PR_ID_RE.flags);
  const valid = ["a", "0", "a-b", "a-", ...[99, 100].map((n) => "a".repeat(n)), "1-" + "a".repeat(98)];
  const invalid = ["", "A", "-a", "a_b", "a b", " a", "a\n", "a/b", "a\\b", "ą", ...[101, 150].map((n) => "a".repeat(n))];
  for (const id of [...valid, ...invalid]) {
    assert.equal(ID_RE.test(id), PR_ID_RE.test(id), JSON.stringify(id));
    assert.equal(ID_RE.test(id), valid.includes(id), JSON.stringify(id));
  }
});

for (const chain of ["10x", "openspec"]) {
  const make = chain === "10x" ? makeProject : makeOpenspecProject;
  const firstStep = chain === "10x" ? "plan" : "os-propose";
  const chainFlags = [["--chain", chain], [`--chain=${chain}`], ...(chain === "10x" ? [[]] : [])];

  test(`${chain}: init accepts valid ids through 100 characters`, () => {
    for (const id of ["a", "0", "a".repeat(99), "a".repeat(100), "1-" + "a".repeat(98)]) {
      const project = make({ id });
      const res = run(project, ["init", id, "--goal", "fix typo", "--chain", chain]);
      assert.equal(res.status, 0, res.stdout);
      assert.equal(res.json.action, "run");
      assert.equal(res.json.step, firstStep);
    }
  });

  test(`${chain}: over-limit init refuses before project reads or writes`, () => {
    for (const size of [101, 150]) {
      for (const flags of chainFlags) {
        const project = make({ id: "a".repeat(size) });
        const before = snapshot(project.root);
        const res = run(project, ["init", project.id, "--goal", "fix typo", ...flags]);
        assert.equal(res.status, 1, res.stdout);
        assert.equal(res.json.action, "halt");
        assert.match(res.json.reason, /maximum of 100 characters/);
        assert.ok(res.json.reason.includes(project.id));
        assert.match(res.json.reason, /Nothing was written/);
        assert.deepEqual(snapshot(project.root), before);
      }
    }

    const project = legacyProject(chain);
    fs.writeFileSync(path.join(project.root, "context/foundation/agent-smith-policy.json"), "{malformed");
    const launcher = path.join(project.root, "trap.mjs");
    fs.writeFileSync(launcher, `
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = process.cwd();
for (const name of ["readFileSync", "openSync", "existsSync", "readdirSync", "statSync", "lstatSync", "accessSync", "realpathSync", "readlinkSync"]) {
  const original = fs[name];
  fs[name] = function (file, ...args) {
    const resolved = typeof file === "number" ? "" : path.resolve(file instanceof URL ? fileURLToPath(file) : String(file));
    if (resolved === root || resolved.startsWith(root + path.sep)) {
      process.stderr.write("PROJECT ACCESS: " + name + " " + resolved + "\\n");
      throw new Error("project access forbidden");
    }
    return original.call(this, file, ...args);
  };
}
await import(${JSON.stringify(pathToFileURL(ROUTE).href)});
`);
    const before = snapshot(project.root);
    for (const flags of chainFlags) {
      // Without instrumentation the cap must also win over malformed policy and existing run state.
      for (const script of [ROUTE, launcher]) {
        const res = run(project, ["init", project.id, ...flags], { script });
        assert.equal(res.status, 1, res.stdout);
        assert.equal(res.json?.action, "halt", res.stderr);
        assert.match(res.json.reason, /maximum of 100 characters/);
        assert.doesNotMatch(res.stderr, /PROJECT ACCESS/);
        assert.deepEqual(snapshot(project.root), before);
      }
    }
    // Prove that a trapped read is observable even when the router catches its exception.
    const control = run(project, ["status", project.id, "--chain", chain], { script: launcher });
    assert.match(control.stderr, /PROJECT ACCESS/);
    assert.deepEqual(snapshot(project.root), before);
  });

  test(`${chain}: legacy longer ids retain status, report, next and usage`, () => {
    const project = legacyProject(chain);
    for (const flags of [[], ["--chain", chain]]) {
      const before = snapshot(project.root);
      const res = run(project, ["status", project.id, ...flags]);
      assert.equal(res.status, 0, res.stdout);
      assert.equal(res.json.change, project.id);
      assert.equal(res.json.steps[0].step, firstStep);
      assert.deepEqual(snapshot(project.root), before);
    }
    const report = run(project, ["status", project.id, "--report"]);
    assert.equal(report.status, 0, report.stdout);
    assert.ok(fs.readFileSync(path.join(project.agentDir, "report.md"), "utf8").startsWith(`# Run report: ${project.id}`));
    const usage = run(project, ["usage", project.id, "1", "--tokens", "123"]);
    assert.equal(usage.status, 0, usage.stdout);
    assert.equal(usage.json.action, "usage");
    assert.equal(usage.json.attached, true);
    assert.deepEqual(readLogEntries(project)[0].usage, { totalTokens: 123 });

    writeLog(project, [entry(1, firstStep, { pendingPrompt: "legacy pending prompt", result: undefined, ok: undefined, verified: undefined, finishedAt: undefined })]);
    writeResult(project, { status: "orchestrator-error", note: "retry pending step" });
    const next = run(project, ["next", project.id]);
    assert.equal(next.status, 0, next.stdout);
    assert.equal(next.json.action, "run");
    assert.equal(next.json.step, firstStep);
    assert.equal(next.json.change, project.id);
    assert.equal(next.json.prompt, "legacy pending prompt");
  });

  test(`${chain}: legacy longer ids retain read-only risk, archive verification and comparison`, () => {
    const project = legacyProject(chain);
    const baseline = legacyProject(chain);
    for (const p of [project, baseline]) {
      writeMetaFile(p, { id: p.id, goal: "fix typo", baseSha: "a".repeat(40), outcome: { action: "done" }, ...(chain === "openspec" ? { chain } : {}) });
      writeLog(p, [entry(1, firstStep, { usage: { totalTokens: 100 } })]);
    }
    const before = [snapshot(project.root), snapshot(baseline.root)];
    const risk = run(project, ["risk", project.id]);
    assert.equal(risk.status, 0, risk.stdout);
    assert.ok(Array.isArray(risk.json.hot));
    assert.ok(Array.isArray(risk.json.planHits));
    assert.ok(Array.isArray(risk.json.diffHits));
    const compare = run(project, ["compare", project.id, "--baseline", baseline.root]);
    assert.equal(compare.status, 0, compare.stdout);
    assert.equal(compare.json.comparable, true);
    assert.equal(compare.json.routed.steps, 1);
    assert.equal(compare.json.baseline.tokens.total, 100);
    assert.equal(compare.json.dropPercent, 0);
    assert.deepEqual([snapshot(project.root), snapshot(baseline.root)], before);

    const archiveRoot = chain === "10x" ? "context/archive" : "openspec/changes/archive";
    const archived = path.join(project.root, archiveRoot, `2026-01-01-${project.id}`);
    fs.mkdirSync(path.dirname(archived), { recursive: true });
    if (chain === "10x") fs.writeFileSync(path.join(project.changeDir, "change.md"), `---\nchange_id: ${project.id}\nstatus: archived\narchived_at: 2026-01-01\n---\n`);
    fs.renameSync(project.changeDir, archived);
    const archivedBefore = snapshot(project.root);
    for (const flags of [[], ["--chain", chain]]) {
      const res = run(project, ["verify-archive", project.id, ...flags]);
      assert.equal(res.status, 0, res.stdout);
      assert.equal(res.json.archived, true);
      assert.equal(res.json.path, `${archiveRoot}/2026-01-01-${project.id}`);
      assert.deepEqual(snapshot(project.root), archivedBefore);
    }
  });
}

test("syntax and invalid-chain validation still precede init length validation", () => {
  const project = makeProject();
  const before = snapshot(project.root);
  for (const id of ["Uppercase", "-leading", "under_score", "../escape"]) {
    const res = run(project, ["init", id]);
    assert.equal(res.status, 1);
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /Usage:/);
  }
  const res = run(project, ["init", "a".repeat(101), "--chain=invalid"]);
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /Invalid --chain/);
  assert.deepEqual(snapshot(project.root), before);
});
