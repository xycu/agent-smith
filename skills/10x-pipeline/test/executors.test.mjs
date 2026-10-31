// phase-executors, phases 1 and 2: commit verification, neutral fallback, executor routing, segments and the retry.
// Black-box through the CLI in scratch projects. Test titles are string literals: the gate rows of the plan check them.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  cleanupAll, makeProject, writePlan, writeReview, init, next, run, writeResult, readLogEntries, readMetaFile, writeMetaFile,
  entry, writeLog, gitInit, git, commitFiles, gitAvailable,
} from "./helpers.mjs";
import { buildPlan, pendingEntry, headSha, gateCheck } from "./phase-helpers.mjs";

after(cleanupAll);

const noGit = gitAvailable() ? false : "git is not installed";
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(TEST_DIR, "../../..");

// ---- phase 1 fixtures -------------------------------------------------------

const ROWS = ["row one", "row two"];

// A one-phase plan with pending rows, a fresh SOUND plan review and a pending `implement` entry of `template`.
// `useGit` makes the project a repository with one base commit. The pending entry records head and done like the router does.
function strictProject({ template = "implement-e2e", useGit = true, goal = "fix typo", policy = null, over = {} } = {}) {
  const project = makeProject({ plan: buildPlan([{ auto: ROWS }]), policy });
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeMetaFile(project, { id: project.id, goal });
  let head = null;
  if (useGit) {
    gitInit(project);
    commitFiles(project, ["src/base.mjs", `context/changes/${project.id}/plan.md`]);
    head = headSha(project);
  }
  writeLog(project, [
    entry(1, "plan"),
    entry(2, "plan-review"),
    pendingEntry(3, "implement", { template, before: { autoDone: 0, head, done: [] }, ...over }),
  ]);
  return { project, head };
}

// Rewrites the plan with every row ticked. `suffix` maps a row index to text appended to the row.
function tickAll(project, suffix = {}) {
  writePlan(project, buildPlan([{ auto: ROWS.map((text, i) => ({ text: text + (suffix[i] ?? ""), done: true })) }]));
}

// Writes the result, runs `next` and returns the `implement` entry it finished plus the router output.
function finish(project, result = { status: "done", note: "x" }) {
  writeResult(project, result);
  const res = next(project);
  return { res, e: readLogEntries(project)[2] };
}

// ---- phase 1: verification --------------------------------------------------

test("plain implement keeps count rule", { skip: noGit }, () => {
  const { project } = strictProject({ template: "implement" });
  tickAll(project);
  const { e } = finish(project);
  assert.equal(e.ok, true);
  assert.equal(e.verified, true);
  assert.equal(e.fallback, undefined);
  assert.equal(e.uncommitted, undefined);
});

test("strict verify rejects skip flip", { skip: noGit }, () => {
  for (const template of ["implement-e2e", "implement-tdd"]) {
    const { project } = strictProject({ template });
    tickAll(project);
    const { e } = finish(project);
    assert.equal(e.ok, false, template);
    assert.equal(e.verified, false, template);
    assert.equal(e.fallback, undefined, template);
  }
});

test("strict verify accepts new commit", { skip: noGit }, () => {
  for (const template of ["implement-e2e", "implement-tdd"]) {
    const { project } = strictProject({ template });
    tickAll(project);
    commitFiles(project, ["src/feature.mjs"]);
    const { e } = finish(project);
    assert.equal(e.ok, true, template);
    assert.equal(e.verified, true, template);
    assert.equal(e.uncommitted, undefined, template);
  }
});

test("strict verify checks sha suffix", { skip: noGit }, () => {
  // A suffix naming a commit outside before.head..HEAD fails even when a code commit exists.
  const a = strictProject();
  tickAll(a.project, { 0: ` — ${a.head.slice(0, 7)}` });
  commitFiles(a.project, ["src/feature.mjs"]);
  assert.equal(finish(a.project).e.ok, false);

  // A suffix naming the new code commit passes.
  const b = strictProject();
  commitFiles(b.project, ["src/feature.mjs"]);
  const sha = headSha(b.project).slice(0, 7);
  tickAll(b.project, { 0: ` — ${sha}`, 1: ` — ${sha}` });
  assert.equal(finish(b.project).e.ok, true);

  // A suffix alone never passes: no new commit.
  const c = strictProject();
  tickAll(c.project, { 0: ` — ${c.head.slice(0, 7)}`, 1: ` — ${c.head.slice(0, 7)}` });
  const fin = finish(c.project);
  assert.equal(fin.e.ok, false);
  assert.equal(fin.e.verified, false);
});

test("strict verify without git", () => {
  // No head recorded (no repository): the count rule applies.
  const ticked = strictProject({ useGit: false });
  tickAll(ticked.project);
  assert.equal(finish(ticked.project).e.ok, true);
  const none = strictProject({ useGit: false });
  assert.equal(finish(none.project).e.ok, false);
});

test("fallback is neutral", { skip: noGit }, () => {
  // A blocked executor entry: a fallback, no failure count, no tier bump, no rigor rise.
  const { project } = strictProject({ template: "implement-tdd" });
  const { res, e } = finish(project, { status: "blocked", note: "not tdd-able" });
  assert.equal(e.ok, false);
  assert.equal(e.fallback, true);
  assert.equal(res.json.step, "implement");
  const entries = readLogEntries(project);
  assert.doesNotMatch(entries[3].tierWhy, /failed attempt/);
  assert.equal(readMetaFile(project).rigor.level, "lean");

  // A failed (not blocked) executor entry is a failure: it counts and raises rigor.
  const failed = strictProject({ template: "implement-tdd" });
  const f = finish(failed.project, { status: "failed", note: "broke" });
  assert.equal(f.e.fallback, undefined);
  assert.match(readLogEntries(failed.project)[3].tierWhy, /1 failed attempt/);
  assert.equal(readMetaFile(failed.project).rigor.level, "standard");

  // A fallback between two failures keeps the streak: it neither counts nor ends it.
  const streak = strictProject({ template: "implement-e2e" });
  writeLog(streak.project, [
    entry(1, "plan"),
    entry(2, "plan-review"),
    entry(3, "implement", { ok: false, verified: false }),
    entry(4, "implement", { template: "implement-e2e", ok: false, verified: false, fallback: true }),
  ]);
  next(streak.project);
  assert.match(readLogEntries(streak.project)[4].tierWhy, /\+1 for 1 failed attempt/);
});

test("blocked plain implement fails", { skip: noGit }, () => {
  const { project } = strictProject({ template: "implement" });
  const { e } = finish(project, { status: "blocked", note: "cannot" });
  assert.equal(e.ok, false);
  assert.equal(e.fallback, undefined);
  assert.equal(readMetaFile(project).rigor.level, "standard");

  // needsHuman from an executor entry still halts.
  const exec = strictProject({ template: "implement-e2e" });
  const halted = finish(exec.project, { status: "blocked", note: "x", signals: { needsHuman: "no setup" } });
  assert.equal(halted.res.json.action, "halt");
  assert.match(halted.res.json.reason, /needs a human: no setup/);
});

test("entry records before state", { skip: noGit }, () => {
  // With plain implement in the strict list the router records head and the done ids.
  const strict = makeProject({ plan: buildPlan([{ auto: [{ text: "row one", done: true }, "row two"] }]), policy: { executors: { strictVerify: ["implement"] } } });
  writeReview(strict, "plan-review", { verdict: "SOUND" });
  gitInit(strict);
  commitFiles(strict, ["src/base.mjs"]);
  writeLog(strict, [entry(1, "plan"), entry(2, "plan-review")]);
  const res = init(strict, "fix typo");
  assert.equal(res.json.step, "implement", JSON.stringify(res.json));
  const e = readLogEntries(strict).pop();
  assert.deepEqual(e.before, { autoDone: 1, head: headSha(strict), done: ["1.1"] });
  const status = run(strict, ["status", strict.id]);
  assert.equal(status.json.steps.pop().template, "implement");

  // Without a repository head is null.
  const bare = makeProject({ plan: buildPlan([{ auto: ROWS }]), policy: { executors: { strictVerify: ["implement"] } } });
  writeReview(bare, "plan-review", { verdict: "SOUND" });
  writeLog(bare, [entry(1, "plan"), entry(2, "plan-review")]);
  init(bare, "fix typo");
  assert.deepEqual(readLogEntries(bare).pop().before, { autoDone: 0, head: null, done: [] });

  // A plain entry under the shipped policy keeps `before` byte for byte.
  const plain = makeProject({ plan: buildPlan([{ auto: ROWS }]) });
  writeReview(plain, "plan-review", { verdict: "SOUND" });
  writeLog(plain, [entry(1, "plan"), entry(2, "plan-review")]);
  init(plain, "fix typo");
  assert.deepEqual(readLogEntries(plain).pop().before, { autoDone: 0 });
});

test("strict verify rejects forged evidence", { skip: noGit }, () => {
  const plan = (id) => `context/changes/${id}/plan.md`;
  // plan.md alone is the first (and only) path of the commit: not evidence.
  const a = strictProject();
  tickAll(a.project);
  commitFiles(a.project, [plan(a.project.id)]);
  assert.equal(finish(a.project).e.ok, false);

  // plan.md plus change folder files, docs and a lockfile: still not evidence.
  const b = strictProject();
  tickAll(b.project);
  commitFiles(b.project, [plan(b.project.id), `context/changes/${b.project.id}/notes.txt`, "README.md", "docs/guide.md", "package-lock.json"]);
  const fin = finish(b.project);
  assert.equal(fin.e.ok, false);
  assert.deepEqual(fin.e.uncommitted, ["1.1", "1.2"]);

  // The same commit with one code file counts.
  const c = strictProject();
  tickAll(c.project);
  commitFiles(c.project, [plan(c.project.id), "README.md", "src/feature.mjs"]);
  assert.equal(finish(c.project).e.ok, true);

  // An entry that never recorded a head is treated like a null head: the count rule applies.
  const d = strictProject({ over: { before: { autoDone: 0 } } });
  tickAll(d.project);
  assert.equal(finish(d.project).e.ok, true);
});

test("strict failure records uncommitted", { skip: noGit }, () => {
  const { project } = strictProject();
  writePlan(project, buildPlan([{ auto: [{ text: ROWS[0], done: true }, ROWS[1]] }]));
  const { e } = finish(project);
  assert.equal(e.ok, false);
  assert.deepEqual(e.uncommitted, ["1.1"]);
  // A step that ticked nothing records no ids.
  const none = strictProject();
  assert.equal(finish(none.project).e.uncommitted, undefined);
});

test("strict verify git edge cases", { skip: noGit }, () => {
  // An unknown commit as head (status 128, for example after a gc): no check, the count rule applies.
  const unknown = strictProject({ over: { before: { autoDone: 0, head: "a".repeat(40), done: [] } } });
  tickAll(unknown.project);
  assert.equal(finish(unknown.project).e.ok, true);

  // A head that is not an ancestor of HEAD (status 1): false, even though rows are ticked and files changed.
  const side = strictProject();
  git(side.project, ["switch", "-q", "-c", "side"]);
  commitFiles(side.project, ["src/side.mjs"]);
  const sideSha = headSha(side.project);
  git(side.project, ["switch", "-q", "main"]);
  commitFiles(side.project, ["src/feature.mjs"]);
  writeLog(side.project, [
    entry(1, "plan"),
    entry(2, "plan-review"),
    pendingEntry(3, "implement", { template: "implement-e2e", before: { autoDone: 0, head: sideSha, done: [] } }),
  ]);
  tickAll(side.project);
  assert.equal(finish(side.project).e.ok, false);

  // Paths that start with @ or hold a space are read intact: such a commit counts.
  const odd = strictProject();
  tickAll(odd.project);
  commitFiles(odd.project, ["@at.js", "sp ace.js"]);
  assert.equal(finish(odd.project).e.ok, true);

  // A commit that touches only docs, a lockfile or the change folder is ignored. The change folder file sorts first,
  // so a leading separator left on the first path of the commit would make it count (review round 3, W1).
  const docs = strictProject();
  tickAll(docs.project);
  commitFiles(docs.project, ["docs/guide.md", "package-lock.json", `context/changes/${docs.project.id}/notes.txt`]);
  assert.equal(finish(docs.project).e.ok, false);
});

// ---- gate check -------------------------------------------------------------

// Runs the exact command line of the plan's gate rows against a plan file and returns the exit status.
function gateRun(planFile, phase) {
  const url = pathToFileURL(path.join(TEST_DIR, "phase-helpers.mjs")).href;
  const code = `import(${JSON.stringify(url)}).then((m) => process.exit(m.gateCheck(${JSON.stringify(planFile)}, ${phase})))`;
  return spawnSync(process.execPath, ["-e", code], { cwd: REPO, encoding: "utf8" });
}

function gatePlan(rows) {
  const project = makeProject();
  const file = path.join(project.base, "gate-plan.md");
  fs.writeFileSync(file, `# Plan\n\n## Progress\n\n### Phase 1: One\n\n#### Automated\n\n${rows.join("\n")}\n\n### Phase 2: Two\n\n#### Automated\n\n- [ ] 2.1 x\n`);
  return file;
}

const patternRow = (pattern, file = "skills/10x-pipeline/test/executors.test.mjs") =>
  `- [ ] 1.1 Row: \`node --test --test-name-pattern "${pattern}" ${file}\``;

test("gate check fails when nothing is checked", () => {
  // A real title passes and exits 0.
  const ok = gateRun(gatePlan([patternRow("plain implement keeps count rule")]), 1);
  assert.equal(ok.status, 0, ok.stderr);
  // Each broken plan exits non-zero through the real command line.
  const cases = {
    "a misspelled pattern": gatePlan([patternRow("plain implemnt keeps count rule")]),
    "a missing file": gatePlan([patternRow("plain implement keeps count rule", "skills/10x-pipeline/test/nope.test.mjs")]),
    "a phase with no pattern row": gatePlan(["- [ ] 1.1 Row: `node --test skills/10x-pipeline/test/rules.test.mjs`"]),
    "a regex metacharacter": gatePlan([patternRow("plain implement keeps.count rule")]),
    "an empty pattern": gatePlan([patternRow("")]),
  };
  for (const [what, file] of Object.entries(cases)) {
    const res = gateRun(file, 1);
    assert.equal(res.status, 1, `${what}: ${res.stdout}${res.stderr}`);
    assert.match(res.stderr, /gateCheck phase 1/, what);
  }
  // A phase that is not in the plan has no pattern row, and an unreadable plan fails.
  assert.equal(gateRun(gatePlan([patternRow("plain implement keeps count rule")]), 7).status, 1);
  assert.equal(gateRun(path.join(TEST_DIR, "no-such-plan.md"), 1).status, 1);
  // The function returns only the integers 0 and 1.
  assert.equal(gateCheck(path.join(TEST_DIR, "no-such-plan.md"), 1), 1);
  // The plan of this change passes for the phases whose tests exist (skipped once the change folder is archived).
  const real = path.join(REPO, "context/changes/phase-executors/plan.md");
  if (fs.existsSync(real)) {
    for (const phase of [1]) {
      const res = gateRun(real, phase);
      assert.equal(res.status, 0, `phase ${phase}: ${res.stderr}`);
    }
  }
});
