// phase-executors, phases 1 to 3: commit verification, neutral fallback, executor routing (e2e, tdd), segments and the retry.
// Black-box through the CLI in scratch projects. Test titles are string literals: the gate rows of the plan check them.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  cleanupAll, makeProject, writePlan, writeReview, init, next, run, writeResult, readLogEntries, readMetaFile, writeMetaFile,
  readReportFile, entry, writeLog, gitInit, git, gitEnv, commitFiles, gitAvailable,
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

// ---- phase 2 fixtures -------------------------------------------------------

const POLICY = JSON.parse(fs.readFileSync(path.join(REPO, "skills/10x-pipeline/policy.json"), "utf8"));
const fill = (text, id = "demo") => text.replace(/\{id\}/g, id).trim();
const PLAIN_IMPLEMENT = `${fill(POLICY.prompts.implement)}\n\n${POLICY.prompts.suffix}`;
const PLAIN_REVIEW = fill(POLICY.prompts["impl-review"]);

const GOAL_ROW = "Parser keeps blank lines: `node --test test/parser.test.mjs`";
const E2E_ROW = "Playwright spec covers the login flow: `npx playwright test tests/e2e/login.spec.ts`";
const goalPhase = (name = "Parser") => ({ name, auto: [GOAL_ROW, `${GOAL_ROW} again`] });
const e2ePhase = (name = "Login flow") => ({ name, auto: [E2E_ROW, `${E2E_ROW} twice`] });

const SETUP_MD = [
  "# Test stack", "", "## E2E", "", "<!-- Written by /10x-e2e-setup. -->", "",
  "- runner: Playwright Test, @playwright/test 1.50.0",
  "- config: playwright.config.ts",
  "- single-spec command: npx playwright test tests/e2e/<name>.spec.ts",
  "- seed: `tests/e2e/seed.spec.ts` — protects the login redirect",
  "- updated: 2026-10-30", "", "## Other", "", "- config: nope.ts", "",
].join("\n");

// The /10x-e2e-setup record and the two files it names.
function writeSetup(project, { md = SETUP_MD, files = ["playwright.config.ts", "tests/e2e/seed.spec.ts"] } = {}) {
  if (md !== null) {
    fs.mkdirSync(path.join(project.root, "context/foundation"), { recursive: true });
    fs.writeFileSync(path.join(project.root, "context/foundation/test-stack.md"), md);
  }
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(project.root, f)), { recursive: true });
    fs.writeFileSync(path.join(project.root, f), "// fixture\n");
  }
}

// The plan with the phases of `specs` ([{ name, auto: [text] }]); `ticked` lists the phase numbers that are done.
const planWith = (specs, ticked = []) =>
  buildPlan(specs.map((ph, i) => ({ ...ph, auto: ph.auto.map((text) => ({ text, done: ticked.includes(i + 1) })) })));

// A project at a fresh plan review with the given phases. `useGit` adds a repository with one base commit.
function e2eProject({ specs, setup = true, useGit = false, policy = null, log = null } = {}) {
  const project = makeProject({ plan: planWith(specs), policy });
  writeReview(project, "plan-review", { verdict: "SOUND" });
  if (setup) writeSetup(project);
  if (useGit) {
    gitInit(project);
    commitFiles(project, ["src/base.mjs", `context/changes/${project.id}/plan.md`]);
  }
  writeLog(project, log ?? [entry(1, "plan"), entry(2, "plan-review")]);
  return project;
}

const lastEntry = (project) => readLogEntries(project).at(-1);
const start = (project, rigor = "standard", goal = "Cover the login flow in the browser") => init(project, goal, ["--rigor", rigor]);

// Rewrites the plan with the phases in `ticked` done, writes the result and runs `next`.
function advance(project, specs, ticked, result = { status: "done", note: "x" }) {
  writePlan(project, planWith(specs, ticked));
  writeResult(project, result);
  return next(project);
}

// ---- phase 2: e2e routing ---------------------------------------------------

test("e2e setup predicate", () => {
  const routed = (project) => start(project).json;
  // Both fields exist: the e2e executor. The seed value carries backticks and a " — protects" tail.
  const ok = e2eProject({ specs: [e2ePhase()] });
  assert.equal(routed(ok).prompt.startsWith("Run /10x-e2e demo phase 1\n"), true);
  assert.equal(lastEntry(ok).template, "implement-e2e");

  const cases = {
    "a config file that does not exist": (project) => fs.rmSync(path.join(project.root, "playwright.config.ts")),
    "a seed file that does not exist": (project) => fs.rmSync(path.join(project.root, "tests/e2e/seed.spec.ts")),
    "a section without a seed field": (project) => writeSetup(project, { md: SETUP_MD.replace(/^- seed:.*$/m, "- seed:"), files: [] }),
    "a section without a config field": (project) => writeSetup(project, { md: SETUP_MD.replace(/^- config:.*\n/m, ""), files: [] }),
    "the seed field only in another section": (project) => writeSetup(project, { md: `${SETUP_MD.replace(/^- seed:.*\n/m, "")}- seed: tests/e2e/seed.spec.ts\n`, files: [] }),
    "no test-stack.md": (project) => fs.rmSync(path.join(project.root, "context/foundation/test-stack.md")),
  };
  for (const [what, spoil] of Object.entries(cases)) {
    const project = e2eProject({ specs: [e2ePhase()] });
    spoil(project);
    const res = routed(project);
    assert.equal(res.step, "implement", what);
    assert.equal(res.prompt, PLAIN_IMPLEMENT, what);
    assert.equal(lastEntry(project).template, "implement", what);
  }
});

test("no e2e rows keeps plain prompt", () => {
  const project = e2eProject({ specs: [goalPhase(), goalPhase("Writer")] });
  const res = start(project).json;
  assert.equal(res.step, "implement");
  assert.equal(res.prompt, PLAIN_IMPLEMENT);
  const e = lastEntry(project);
  assert.equal(e.template, "implement");
  assert.equal(e.skill, "10x-goal-implement");
  for (const key of ["phase", "lastPhase", "executor", "retry"]) assert.equal(key in e, false, key);
});

test("e2e phase routes to e2e", () => {
  const project = e2eProject({ specs: [e2ePhase()] });
  const res = start(project).json;
  assert.equal(res.step, "implement");
  assert.ok(res.prompt.startsWith("Run /10x-e2e demo phase 1\n"), res.prompt);
  assert.doesNotMatch(res.prompt, /\{(id|phase|lastPhase|retry|uncommitted)\}/);
  assert.match(res.prompt, /after phase 1 /);
  const e = lastEntry(project);
  assert.equal(e.template, "implement-e2e");
  assert.equal(e.executor, "e2e");
  assert.equal(e.phase, 1);
  assert.equal(e.lastPhase, 1);
  assert.equal(e.step, "implement");

  // Two browser phases in a row form one e2e segment that stops after the last one.
  const two = e2eProject({ specs: [e2ePhase(), e2ePhase("Checkout")] });
  const second = start(two).json;
  assert.ok(second.prompt.startsWith("Run /10x-e2e demo phase 1\n"));
  assert.match(second.prompt, /after phase 2 /);
  assert.equal(lastEntry(two).lastPhase, 2);
});

test("e2e rows without setup", () => {
  const project = e2eProject({ specs: [e2ePhase()], setup: false });
  const res = start(project).json;
  assert.equal(res.prompt, PLAIN_IMPLEMENT);
  assert.equal(lastEntry(project).template, "implement");
});

test("mixed plan segments", () => {
  const specs = [goalPhase(), e2ePhase(), goalPhase("Writer"), e2ePhase("Checkout")];
  const project = e2eProject({ specs });
  // The goal phase before the e2e phase runs as a segment that stops after phase 1.
  const first = start(project).json;
  assert.ok(first.prompt.startsWith("Run /10x-goal-implement demo phase 1\n"), first.prompt);
  assert.match(first.prompt, /phases 1 to 1 /);
  assert.deepEqual([lastEntry(project).template, lastEntry(project).executor, lastEntry(project).lastPhase], ["implement-segment", "goal", 1]);
  // Then the e2e step for phase 2 only: phase 3 is a goal phase.
  const second = advance(project, specs, [1]).json;
  assert.ok(second.prompt.startsWith("Run /10x-e2e demo phase 2\n"), second.prompt);
  assert.deepEqual([lastEntry(project).template, lastEntry(project).lastPhase], ["implement-e2e", 2]);
  // The pool (2) is spent: the rest of the plan goes to the plain step, although phase 4 is browser-level.
  const third = advance(project, specs, [1, 2]).json;
  assert.equal(third.prompt, PLAIN_IMPLEMENT);
  assert.equal(lastEntry(project).template, "implement");
  assert.equal(readLogEntries(project).filter((e) => e.template === "implement-segment").length, 1);
});

test("e2e blocked falls back", () => {
  const specs = [e2ePhase()];
  const project = e2eProject({ specs });
  const first = start(project).json;
  assert.ok(first.prompt.startsWith("Run /10x-e2e "));
  const level = readMetaFile(project).rigor.level;
  const res = advance(project, specs, [], { status: "blocked", note: "feature not built" }).json;
  const blocked = readLogEntries(project)[2];
  assert.equal(blocked.fallback, true);
  // Not repeated for the phase: goal-implement, one tier as for a fresh plain step, no failure counted, rigor kept.
  assert.equal(res.prompt, PLAIN_IMPLEMENT);
  const e = lastEntry(project);
  assert.equal(e.template, "implement");
  assert.doesNotMatch(e.tierWhy, /failed attempt/);
  assert.equal(readMetaFile(project).rigor.level, level);
  const fresh = e2eProject({ specs, setup: false });
  start(fresh);
  assert.equal(e.tier, lastEntry(fresh).tier);
});

test("e2e failed not repeated", { skip: noGit }, () => {
  // The step ticked nothing: unverified, not a fallback. The phase goes to goal-implement one tier higher.
  const specs = [e2ePhase()];
  const quiet = e2eProject({ specs });
  start(quiet);
  const res = advance(quiet, specs, []).json;
  const failed = readLogEntries(quiet)[2];
  assert.equal(failed.ok, false);
  assert.equal(failed.fallback, undefined);
  assert.equal(res.prompt, PLAIN_IMPLEMENT);
  assert.match(lastEntry(quiet).tierWhy, /\+1 for 1 failed attempt/);

  // A Skip flip (rows ticked, no commit): never e2e again, and one tier higher.
  const skip = e2eProject({ specs, useGit: true });
  start(skip);
  const flipped = advance(skip, specs, [1]).json;
  assert.doesNotMatch(flipped.prompt, /^Run \/10x-e2e /);
  assert.ok(flipped.prompt.startsWith("Run /10x-goal-implement demo phase 1\n"), flipped.prompt);
  assert.match(lastEntry(skip).tierWhy, /\+1 for 1 failed attempt/);
});

test("e2e effort floor", () => {
  for (const rigor of ["standard", "thorough"]) {
    const project = e2eProject({ specs: [e2ePhase()] });
    const res = start(project, rigor).json;
    assert.ok(["high", "xhigh", "max"].includes(res.effort), `${rigor}: ${res.effort}`);
    assert.match(lastEntry(project).tierWhy, /floor high/, rigor);
    // The same plan on the plain step is cheaper, so the floor is what raised the e2e step.
    const plain = e2eProject({ specs: [e2ePhase()], setup: false });
    const cheap = start(plain, rigor).json;
    assert.ok(lastEntry(project).tier > lastEntry(plain).tier, `${rigor}: ${cheap.effort}`);
  }
});

test("e2e prompt rules", () => {
  const project = e2eProject({ specs: [e2ePhase(), e2ePhase("Checkout")] });
  const { prompt } = start(project).json;
  // The stop phase is named, Skip is forbidden and a redirect ends blocked without a human.
  assert.match(prompt, /after phase 2 \*\*WHEN\*\*/);
  assert.match(prompt, /\*\*GIVEN\*\* the skill offers "Skip - already done".*\*\*MUST NOT\*\* choose it/);
  assert.match(prompt, /would redirect to \/10x-e2e-setup, \/10x-tdd or \/10x-implement \*\*THEN\*\* you \*\*MUST\*\* stop, change nothing and finish with status `blocked`/);
  assert.match(prompt, /never set `signals\.needsHuman`/);
  assert.match(prompt, /manual confirmation gate.*treat it as confirmed.*leave every Manual row unticked/);
  assert.match(prompt, /approve it as proposed/);
  assert.match(prompt, /commit only the planned set/);
  assert.match(prompt, /passing spec for the risk already exists.*leave the rows unticked.*status `blocked`/);
  assert.match(prompt, /MUST NOT\*\* run pbcopy/);
  // The shipped prompt array has the first line and the file reference.
  assert.deepEqual(POLICY.prompts["implement-e2e"], ["Run /10x-e2e {id} phase {phase}", "@prompts/executor-e2e.md"]);
});

// ---- phase 2: retry ---------------------------------------------------------

// A repository project that ran an e2e step which ticked every row without a commit: the next step is the retry.
function retryProject() {
  const specs = [e2ePhase()];
  const project = e2eProject({ specs, useGit: true });
  start(project);
  const res = advance(project, specs, [1]).json;
  return { project, specs, res };
}

test("retry after uncommitted ticks", { skip: noGit }, () => {
  const { project, specs, res } = retryProject();
  const failed = readLogEntries(project)[2];
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.uncommitted, ["1.1", "1.2"]);
  // Every Automated row is ticked, yet the next step is the retry and not impl-review.
  assert.equal(res.step, "implement");
  assert.ok(res.prompt.startsWith("Run /10x-goal-implement demo phase 1\n"), res.prompt);
  assert.match(res.prompt, /rows 1\.1, 1\.2 of context\/changes\/demo\/plan\.md are marked done/);
  const e = lastEntry(project);
  assert.equal(e.template, "implement-retry");
  assert.deepEqual(e.retry, ["1.1", "1.2"]);
  assert.equal(e.executor, "goal");
  assert.equal(e.before.head, headSha(project));
  assert.deepEqual(e.before.done, ["1.1", "1.2"]);

  // The subagent re-opens the rows, makes a code commit and ticks them again: the retry is ok.
  commitFiles(project, ["src/feature.mjs"]);
  const after = advance(project, specs, [1]).json;
  const retried = readLogEntries(project)[3];
  assert.equal(retried.ok, true);
  assert.equal(retried.verified, true);
  assert.equal(after.step, "impl-review");
  assert.equal(lastEntry(project).template, "impl-review");
  assert.equal(after.prompt.startsWith(PLAIN_REVIEW), true);
  assert.doesNotMatch(after.prompt, /ticked in `plan\.md` with no code commit/);
});

test("retry prompt rules", { skip: noGit }, () => {
  const { res } = retryProject();
  const { prompt } = res;
  assert.match(prompt, /ticked in `plan\.md` with no commit behind them \*\*WHEN\*\* you start \*\*THEN\*\* you \*\*MUST\*\* set each of those rows back to `\[ \]` before any other work/);
  assert.match(prompt, /\*\*MUST NOT\*\* tick the row/);
  assert.match(prompt, /write the commit SHA after the row/);
  assert.match(prompt, /phase 1 is done \*\*WHEN\*\* later phases still have pending rows \*\*THEN\*\* you \*\*MUST NOT\*\* start them/);
  assert.match(prompt, /nothing left to change \*\*WHEN\*\* this is the last attempt \*\*THEN\*\* you \*\*MUST\*\* finish with status `blocked`/);
  assert.deepEqual(POLICY.prompts["implement-retry"], ["Run /10x-goal-implement {id} phase {phase}", "@prompts/executor-retry.md"]);
});

test("retry once then warn", { skip: noGit }, () => {
  // An earlier plain failure plus the failed e2e step make two failures; the retry decides whether a third counts.
  // The failure re-plan (phase 4) would take the second failure first, so it is switched off here: this test is about the retry.
  const flow = (retryResult) => {
    const specs = [e2ePhase()];
    const project = e2eProject({
      specs,
      useGit: true,
      policy: { codeReplan: { max: 0 } },
      log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement", { ok: false, verified: false })],
    });
    start(project);
    advance(project, specs, [1]);
    assert.equal(lastEntry(project).template, "implement-retry");
    const res = advance(project, specs, [1], retryResult).json;
    return { project, res };
  };

  // A retry that ends done without a commit: a neutral fallback, no new failure, no rigor rise.
  const done = flow({ status: "done", note: "nothing to change" });
  const retried = readLogEntries(done.project)[4];
  assert.equal(retried.template, "implement-retry");
  assert.equal(retried.ok, false);
  assert.equal(retried.fallback, true);
  assert.equal(readMetaFile(done.project).rigor.level, "standard");
  // The run goes on to impl-review with the warning; its first part is the plain impl-review prompt.
  assert.equal(done.res.step, "impl-review");
  assert.equal(lastEntry(done.project).template, "impl-review-warn");
  assert.ok(done.res.prompt.startsWith(`${PLAIN_REVIEW}\n`), done.res.prompt);
  assert.match(done.res.prompt, /rows 1\.1, 1\.2 are ticked in `plan\.md` with no code commit/);
  assert.deepEqual(POLICY.prompts["impl-review-warn"], [POLICY.prompts["impl-review"], "@prompts/impl-review-warn.md"]);
  // A blocked retry (a legitimate zero-diff phase) is the same: no halt.
  const blocked = flow({ status: "blocked", note: "nothing left to change" });
  assert.equal(readLogEntries(blocked.project)[4].fallback, true);
  assert.equal(blocked.res.step, "impl-review");
  assert.equal(lastEntry(blocked.project).template, "impl-review-warn");

  // A retry that ends failed counts as a failure: the third one raises the rigor level.
  const failed = flow({ status: "failed", note: "broke" });
  const bad = readLogEntries(failed.project)[4];
  assert.equal(bad.ok, false);
  assert.equal(bad.fallback, undefined);
  assert.equal(readMetaFile(failed.project).rigor.level, "thorough");
  assert.equal(failed.res.step, "impl-review");
  assert.equal(readLogEntries(failed.project).filter((e) => e.template === "implement-retry").length, 1);
});

test("retry without commit evidence warns", () => {
  // A retry whose commit check cannot run (no repository, a repository with no commit, a recorded head that does not
  // resolve) must not pass silently when its rows are ticked again: a neutral fallback and the impl-review-warn prompt.
  const RETRY = ["1.1", "1.2"];
  const UNKNOWN = "0123456789abcdef0123456789abcdef01234567";
  const setups = {
    "no repository": () => strictProject({ template: "implement-retry", useGit: false, over: { retry: RETRY } }),
    "a repository with no commit": () => {
      const s = strictProject({ template: "implement-retry", useGit: false, over: { retry: RETRY } });
      gitInit(s.project);
      return s;
    },
    "an unknown recorded head": () => strictProject({
      template: "implement-retry", over: { retry: RETRY, before: { autoDone: 0, head: UNKNOWN, done: [] } },
    }),
  };
  for (const [what, setup] of Object.entries(setups)) {
    if (what !== "no repository" && noGit) continue;
    // Rows ticked again, status done: unproven, neutral, warned.
    const { project } = setup();
    tickAll(project);
    const { res, e } = finish(project);
    assert.equal(e.ok, false, what);
    assert.equal(e.verified, false, what);
    assert.equal(e.fallback, true, what);
    assert.deepEqual(e.uncommitted, RETRY, what);
    assert.equal(e.evidenceUnavailable, true, what);
    assert.equal(readMetaFile(project).rigor.level, "lean", `${what}: a neutral entry raises no rigor`);
    assert.equal(res.json.step, "impl-review", what);
    assert.equal(lastEntry(project).template, "impl-review-warn", what);
    assert.match(res.json.prompt, /rows 1\.1, 1\.2 are ticked in `plan\.md` with no code commit/, what);
    assert.match(res.json.prompt, /Commit evidence was unavailable/, what);

    // Rows not ticked again: still unproven, still no failure count.
    const open = setup();
    const b = finish(open.project, { status: "blocked", note: "nothing to change" });
    assert.equal(b.e.ok, false, what);
    assert.equal(b.e.fallback, true, what);
    assert.equal(b.e.uncommitted, undefined, what);

    // A retry that reports failed is a failure, as for a missing commit.
    const failed = setup();
    tickAll(failed.project);
    const f = finish(failed.project, { status: "failed", note: "broke" });
    assert.equal(f.e.ok, false, what);
    assert.equal(f.e.fallback, undefined, what);
    assert.deepEqual(f.e.uncommitted, RETRY, what);
  }
});

test("warning names a check that ran", { skip: noGit }, () => {
  // With a readable history the warning carries no evidence note: the commit check ran and found nothing.
  const { project } = strictProject({ template: "implement-retry", over: { retry: ["1.1", "1.2"] } });
  tickAll(project);
  const { res, e } = finish(project, { status: "done", note: "x" });
  assert.equal(e.fallback, true);
  assert.equal(e.evidenceUnavailable, undefined);
  assert.equal(lastEntry(project).template, "impl-review-warn");
  assert.doesNotMatch(res.json.prompt, /evidence was unavailable/);
});

// ---- phase 2: pool, lean, containment, no phase list -------------------------

test("extra steps pool", () => {
  const poolOf = (allowance) => ({ extraSteps: { allowance: { lean: 0, standard: allowance, thorough: allowance } } });
  // A pool of 1 cannot pay a goal segment and the e2e step behind it: the plain step.
  const specs = [goalPhase(), e2ePhase()];
  const small = e2eProject({ specs, policy: poolOf(1) });
  assert.equal(start(small).json.prompt, PLAIN_IMPLEMENT);
  assert.equal(lastEntry(small).template, "implement");
  // A pool of 2 pays for both.
  const enough = e2eProject({ specs, policy: poolOf(2) });
  assert.ok(start(enough).json.prompt.startsWith("Run /10x-goal-implement demo phase 1\n"));
  // A pool of 0 turns the executors off, and so does a negative one.
  for (const zero of [0, -3]) {
    const off = e2eProject({ specs: [e2ePhase()], policy: poolOf(zero) });
    assert.equal(start(off).json.prompt, PLAIN_IMPLEMENT, String(zero));
  }
  // A pool of 1 pays for one e2e step; once it is spent the next browser phase gets the plain step.
  const two = [e2ePhase(), goalPhase(), e2ePhase("Checkout")];
  const spent = e2eProject({ specs: two, policy: poolOf(1) });
  assert.ok(start(spent).json.prompt.startsWith("Run /10x-e2e demo phase 1\n"));
  assert.equal(advance(spent, two, [1]).json.prompt, PLAIN_IMPLEMENT);
  assert.equal(lastEntry(spent).template, "implement");
});

test("lean keeps plain implement", () => {
  const specs = [e2ePhase()];
  const withSetup = e2eProject({ specs });
  const lean = start(withSetup, "lean", "fix typo");
  assert.equal(lean.json.prompt, PLAIN_IMPLEMENT);
  assert.equal(lastEntry(withSetup).template, "implement");
  // A lean walk is the same with and without the feature: same step, model, effort, reason and prompt.
  const without = e2eProject({ specs, setup: false });
  const base = start(without, "lean", "fix typo");
  assert.deepEqual(lean.json, base.json);
  const walked = advance(withSetup, specs, [1]);
  const baseWalk = advance(without, specs, [1]);
  assert.deepEqual(walked.json, baseWalk.json);
  // The lean budget stays 10: nine executed steps still run, ten halt.
  for (const [count, action] of [[9, "run"], [10, "halt"]]) {
    const project = e2eProject({ specs });
    const log = [entry(1, "plan"), entry(2, "plan-review")];
    for (let n = 3; n <= count; n++) log.push(entry(n, "implement", { template: "implement" }));
    writeLog(project, log);
    const res = start(project, "lean", "fix typo");
    assert.equal(res.json.action, action, `${count} steps: ${res.stdout}`);
    if (action === "halt") assert.match(res.json.reason, /Step budget 10 spent/);
  }
});

test("e2e setup path containment", () => {
  const routesE2e = (md, files = ["playwright.config.ts", "tests/e2e/seed.spec.ts"], after = () => {}) => {
    const project = e2eProject({ specs: [e2ePhase()], setup: false });
    writeSetup(project, { md, files });
    after(project);
    start(project);
    return lastEntry(project).template === "implement-e2e";
  };
  assert.equal(routesE2e(SETUP_MD), true);
  // An absolute path, even one that exists, is no hit.
  const abs = (project) => SETUP_MD.replace("- config: playwright.config.ts", `- config: ${path.join(project.root, "playwright.config.ts")}`);
  const absProject = e2eProject({ specs: [e2ePhase()] });
  writeSetup(absProject, { md: abs(absProject), files: [] });
  start(absProject);
  assert.equal(lastEntry(absProject).template, "implement");
  // A path with a .. segment is no hit, although the file it reaches exists.
  const outer = makeProject();
  fs.writeFileSync(path.join(outer.base, "outside.ts"), "x\n");
  assert.equal(routesE2e(SETUP_MD.replace("- config: playwright.config.ts", `- config: ../${path.basename(outer.base)}/outside.ts`)), false);
  assert.equal(routesE2e(SETUP_MD.replace("- config: playwright.config.ts", "- config: tests/../playwright.config.ts")), false);
  assert.equal(routesE2e(SETUP_MD.replace("- config: playwright.config.ts", "- config: ")), false);
  // A symlink that leaves the root is no hit; a symlink that stays inside is fine.
  if (process.platform !== "win32") {
    const leave = e2eProject({ specs: [e2ePhase()] });
    fs.rmSync(path.join(leave.root, "playwright.config.ts"));
    fs.symlinkSync(path.join(outer.base, "outside.ts"), path.join(leave.root, "playwright.config.ts"));
    start(leave);
    assert.equal(lastEntry(leave).template, "implement");
    const stay = e2eProject({ specs: [e2ePhase()] });
    fs.rmSync(path.join(stay.root, "playwright.config.ts"));
    fs.symlinkSync(path.join(stay.root, "tests/e2e/seed.spec.ts"), path.join(stay.root, "playwright.config.ts"));
    start(stay);
    assert.equal(lastEntry(stay).template, "implement-e2e");
  }
});

test("no phase list stays plain", () => {
  // Progress headings that are not "### Phase N": the phase list is empty, the plain step runs.
  const text = [
    "# Plan", "", "## Progress", "", "### Faza 1: Login", "", "#### Automated", "",
    `- [ ] 1.1 ${E2E_ROW}`, `- [ ] 1.2 ${E2E_ROW} twice`, "", "#### Manual", "", "- [ ] 1.3 Look at it", "",
  ].join("\n");
  const project = makeProject({ plan: text });
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeSetup(project);
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review")]);
  const res = start(project).json;
  assert.equal(res.step, "implement");
  assert.equal(res.prompt, PLAIN_IMPLEMENT);
  assert.equal(lastEntry(project).template, "implement");
});

// ---- phase 2: log entry and outputs ------------------------------------------

test("entry skill names executor", { skip: noGit }, () => {
  const e2e = e2eProject({ specs: [e2ePhase()] });
  start(e2e);
  assert.equal(lastEntry(e2e).skill, "10x-e2e");

  const mixed = [goalPhase(), e2ePhase()];
  const seg = e2eProject({ specs: mixed });
  start(seg);
  assert.equal(lastEntry(seg).template, "implement-segment");
  assert.equal(lastEntry(seg).skill, "10x-goal-implement");

  const plain = e2eProject({ specs: [goalPhase()] });
  start(plain);
  assert.equal(lastEntry(plain).template, "implement");
  assert.equal(lastEntry(plain).skill, "10x-goal-implement");

  const { project } = retryProject();
  assert.equal(lastEntry(project).template, "implement-retry");
  assert.equal(lastEntry(project).skill, "10x-goal-implement");
  // The failed e2e step before the retry logged the e2e skill.
  assert.equal(readLogEntries(project)[2].skill, "10x-e2e");
});

// A finished run in a repository: every row ticked, an approved impl-review, and a log in which an e2e step ticked its
// rows without a commit and the retry changed nothing. `archive` sets the archive flag.
function warnedProject(archive) {
  const project = makeProject({ plan: planWith([e2ePhase()], [1]) });
  fs.writeFileSync(path.join(project.changeDir, "change.md"), "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [
    entry(1, "plan"),
    entry(2, "plan-review"),
    entry(3, "implement", { template: "implement-e2e", executor: "e2e", phase: 1, lastPhase: 1, ok: false, verified: false, uncommitted: ["1.1", "1.2"] }),
    entry(4, "implement", { template: "implement-retry", executor: "goal", phase: 1, lastPhase: 1, retry: ["1.1", "1.2"], ok: false, verified: false, fallback: true, uncommitted: ["1.1", "1.2"] }),
    entry(5, "impl-review", { template: "impl-review-warn" }),
  ]);
  writeMetaFile(project, { id: "demo", goal: "Cover the login flow in the browser", rigor: { requested: "standard" }, ...(archive ? { archive: true } : {}) });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  return project;
}

test("uncommitted ticks reach outputs", { skip: noGit }, () => {
  // Without --archive: the done output and meta.outcome carry the ids; report.md has no archive lines.
  const plain = warnedProject(false);
  const done = run(plain, ["next", plain.id], { env: gitEnv(plain) });
  assert.equal(done.json.action, "done", done.stdout);
  assert.deepEqual(done.json.uncommittedTicks, ["1.1", "1.2"]);
  assert.deepEqual(readMetaFile(plain).outcome.uncommittedTicks, ["1.1", "1.2"]);
  assert.doesNotMatch(readReportFile(plain), /Ticked without a commit/);

  // With --archive: the archive action summary, meta.outcome and the lines of report.md.
  const project = warnedProject(true);
  const res = run(project, ["next", project.id], { env: gitEnv(project) });
  assert.equal(res.json.action, "archive", res.stdout);
  assert.deepEqual(res.json.summary.uncommittedTicks, ["1.1", "1.2"]);
  assert.deepEqual(readMetaFile(project).outcome.uncommittedTicks, ["1.1", "1.2"]);
  assert.match(readReportFile(project), /^Ticked without a commit: 2\n- 1\.1\n- 1\.2$/m);
  assert.match(git(project, ["show", "HEAD:context/changes/demo/agent-smith/report.md"]), /^Ticked without a commit: 2$/m);

  // A clean run carries no such key anywhere.
  const clean = warnedProject(true);
  writeLog(clean, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  const ok = run(clean, ["next", clean.id], { env: gitEnv(clean) });
  assert.equal(ok.json.action, "archive", ok.stdout);
  assert.equal("uncommittedTicks" in ok.json.summary, false);
  assert.equal("uncommittedTicks" in readMetaFile(clean).outcome, false);
  assert.doesNotMatch(readReportFile(clean), /Ticked without a commit/);
});

// ---- phase 3: tdd ------------------------------------------------------------

const TDD_FILES = ["`src/parser.mjs`"];
const tddPhase = (name = "Parser", files = TDD_FILES, auto = [GOAL_ROW, `${GOAL_ROW} again`]) => ({ name, files, auto });
const GOAL_ONLY = { name: "Writer", auto: [GOAL_ROW, `${GOAL_ROW} again`] };

// The prompt of the first step for `specs` at `rigor`, and the entry it logged.
function firstStep(specs, { rigor = "thorough", setup = false, policy = null } = {}) {
  const project = e2eProject({ specs, setup, policy });
  const res = start(project, rigor, "Parse blank lines").json;
  return { project, res, e: lastEntry(project) };
}

test("phase files reader", () => {
  const route = (planText) => {
    const project = e2eProject({ specs: [tddPhase()], setup: false });
    writePlan(project, planText);
    start(project, "thorough", "Parse blank lines");
    return lastEntry(project).template;
  };
  const base = buildPlan([tddPhase()]);
  assert.equal(route(base), "implement-tdd");
  // A Polish heading, a **Files** line with comma-separated plain paths and a trailing note or :line are read.
  assert.equal(route(base.replace(/^## Phase 1/m, "## Faza 1")), "implement-tdd");
  assert.equal(route(base.replace("**File**: `src/parser.mjs`", "**Files**: src/parser.mjs, src/util.mjs")), "implement-tdd");
  assert.equal(route(base.replace("**File**: `src/parser.mjs`", "**Files**: `src/parser.mjs` (new), `src/util.mjs:12-20`")), "implement-tdd");
  // One doc path among the files blocks the phase, whatever form the line has.
  assert.equal(route(base.replace("**File**: `src/parser.mjs`", "**Files**: src/parser.mjs, docs/notes.mjs")), "implement");
  // A file line outside a phase block, or after the Progress heading, is not read: the phase names no file.
  const stray = base.replace("**File**: `src/parser.mjs`\n", "").replace("# Plan\n", "# Plan\n\n**File**: `src/parser.mjs`\n");
  assert.equal(route(stray), "implement");
  // The files of one phase do not leak into the next: phase 1 has no file line, so the goal segment runs first.
  const two = buildPlan([{ name: "Writer", auto: [GOAL_ROW] }, tddPhase("Parser")]);
  assert.equal(route(two), "implement-segment");
});

test("tdd phase at thorough", () => {
  const { res, e } = firstStep([tddPhase()]);
  assert.ok(res.prompt.startsWith("Run /10x-tdd demo phase 1\n"), res.prompt);
  assert.doesNotMatch(res.prompt, /\{(id|phase|lastPhase|retry|uncommitted)\}/);
  assert.match(res.prompt, /after phase 1 /);
  assert.equal(res.step, "implement");
  assert.deepEqual([e.template, e.executor, e.phase, e.lastPhase], ["implement-tdd", "tdd", 1, 1]);
  assert.ok(["high", "xhigh", "max"].includes(res.effort), res.effort);
  assert.match(e.tierWhy, /floor high/);
  // The entry records head and done for the commit check.
  assert.deepEqual(Object.keys(e.before).sort(), ["autoDone", "done", "head"]);

  // Two pure-logic phases in a row form one tdd segment that stops after the last one.
  const two = firstStep([tddPhase(), tddPhase("Printer", ["`src/printer.mjs`"])]);
  assert.ok(two.res.prompt.startsWith("Run /10x-tdd demo phase 1\n"));
  assert.match(two.res.prompt, /after phase 2 /);
  assert.equal(two.e.lastPhase, 2);

  // A goal phase after the tdd phase is left to the plain step: the tdd segment ends before it.
  const mixed = firstStep([tddPhase(), GOAL_ONLY]);
  assert.equal(mixed.e.template, "implement-tdd");
  assert.equal(mixed.e.lastPhase, 1);
  // Goal, then tdd: a goal segment first, then the tdd step (the pool of 3 pays for both).
  const specs = [GOAL_ONLY, tddPhase()];
  const goalFirst = firstStep(specs);
  assert.equal(goalFirst.e.template, "implement-segment");
  assert.equal(goalFirst.e.lastPhase, 1);
  const second = advance(goalFirst.project, specs, [1]).json;
  assert.ok(second.prompt.startsWith("Run /10x-tdd demo phase 2\n"), second.prompt);
});

test("tdd gated by rigor", () => {
  for (const rigor of ["standard", "lean"]) {
    const { res, e } = firstStep([tddPhase()], { rigor });
    assert.equal(res.prompt, PLAIN_IMPLEMENT, rigor);
    assert.equal(e.template, "implement", rigor);
  }
  // The gate is data: a project that lowers minRigor gets tdd at standard.
  const lowered = firstStep([tddPhase()], { rigor: "standard", policy: { executors: { tdd: { minRigor: "standard" } } } });
  assert.equal(lowered.e.template, "implement-tdd");
  // A pool of 0 keeps tdd off even at thorough.
  const dry = firstStep([tddPhase()], { policy: { extraSteps: { allowance: { thorough: 0 } } } });
  assert.equal(dry.res.prompt, PLAIN_IMPLEMENT);
});

test("tdd predicate rejects", () => {
  assert.equal(firstStep([tddPhase()]).e.template, "implement-tdd");
  const plain = (what, spec, policy = null) => {
    const { res, e } = firstStep([spec], { policy });
    assert.equal(res.prompt, PLAIN_IMPLEMENT, what);
    assert.equal(e.template, "implement", what);
  };
  plain("a doc path", tddPhase("Parser", ["`docs/guide.md`"]));
  plain("a path that is not code", tddPhase("Parser", ["`src/notes.txt`"]));
  plain("a directory", tddPhase("Parser", ["`src/`"]));
  plain("a config glob", tddPhase("Parser", ["`.github/scripts/ci.mjs`"]));
  plain("a code path next to a doc path", tddPhase("Parser", ["`src/parser.mjs`", "`README.md`"]));
  plain("no file line", { name: "Parser", auto: [GOAL_ROW, `${GOAL_ROW} again`] });
  plain("a UI word", tddPhase("Parser", TDD_FILES, ["Page renders the list: `node --test test/page.test.mjs`"]));
  plain("a browser word", tddPhase("Parser", TDD_FILES, [GOAL_ROW, "Opens it in the browser: `node --test test/open.test.mjs`"]));
  plain("a row with no test command", tddPhase("Parser", TDD_FILES, [GOAL_ROW, "Parser is documented: `node scripts/check.mjs`"]));
  plain("a test word outside backticks", tddPhase("Parser", TDD_FILES, [GOAL_ROW, "Run the test suite once"]));
  // A done row: the implementation may exist already, so the skill would stop.
  const ticked = e2eProject({ specs: [tddPhase()], setup: false });
  writePlan(ticked, buildPlan([{ ...tddPhase(), auto: [{ text: GOAL_ROW, done: true }, `${GOAL_ROW} again`] }]));
  const res = start(ticked, "thorough", "Parse blank lines").json;
  assert.equal(res.prompt, PLAIN_IMPLEMENT);
  assert.equal(lastEntry(ticked).template, "implement");
  // The word lists are data: an empty test word list turns the predicate off.
  plain("no test words", tddPhase(), { executors: { tdd: { testWords: [] } } });
});

test("e2e wins over tdd", () => {
  // Under the shipped lists an e2e phase also carries a UI word, so loosen the UI list to make both predicates true.
  const policy = { executors: { tdd: { uiWords: ["css"] } } };
  const spec = { name: "Login flow", files: TDD_FILES, auto: [E2E_ROW, `${E2E_ROW} twice`] };
  const both = firstStep([spec], { setup: true, policy });
  assert.equal(both.e.template, "implement-e2e");
  assert.equal(both.e.executor, "e2e");
  assert.ok(both.res.prompt.startsWith("Run /10x-e2e demo phase 1\n"));
  // Without the e2e setup the same phase goes to tdd.
  const noSetup = firstStep([spec], { setup: false, policy });
  assert.equal(noSetup.e.template, "implement-tdd");
  // A tdd phase before an e2e phase: the segments differ, so the tdd step stops after phase 1.
  const mixed = firstStep([tddPhase(), { name: "Login flow", auto: [E2E_ROW, `${E2E_ROW} twice`] }], { setup: true });
  assert.equal(mixed.e.template, "implement-tdd");
  assert.equal(mixed.e.lastPhase, 1);
});

test("tdd blocked falls back", () => {
  const specs = [tddPhase()];
  const { project } = firstStep(specs);
  const level = readMetaFile(project).rigor.level;
  const res = advance(project, specs, [], { status: "blocked", note: "not a fit for test-first" }).json;
  const blocked = readLogEntries(project)[2];
  assert.equal(blocked.template, "implement-tdd");
  assert.equal(blocked.fallback, true);
  assert.equal(blocked.ok, false);
  // Not repeated for the phase: the plain step, no failure counted, no tier bump, rigor kept, no halt.
  assert.equal(res.action, "run");
  assert.equal(res.prompt, PLAIN_IMPLEMENT);
  const e = lastEntry(project);
  assert.equal(e.template, "implement");
  assert.doesNotMatch(e.tierWhy, /failed attempt/);
  assert.equal(readMetaFile(project).rigor.level, level);
  const fresh = firstStep(specs, { policy: { extraSteps: { allowance: { thorough: 0 } } } });
  assert.equal(e.tier, fresh.e.tier);

  // A tdd step that ticks rows with no code commit is a failure, not a fallback, and is not repeated either.
  const skip = e2eProject({ specs, setup: false, useGit: true });
  start(skip, "thorough", "Parse blank lines");
  const flipped = advance(skip, specs, [1]).json;
  const failed = readLogEntries(skip)[2];
  assert.equal(failed.ok, false);
  assert.equal(failed.fallback, undefined);
  assert.deepEqual(failed.uncommitted, ["1.1", "1.2"]);
  assert.doesNotMatch(flipped.prompt, /^Run \/10x-tdd /);
});

test("tdd prompt rules", () => {
  const { res } = firstStep([tddPhase(), tddPhase("Printer", ["`src/printer.mjs`"])]);
  const { prompt } = res;
  assert.match(prompt, /after phase 2 \*\*WHEN\*\*/);
  assert.match(prompt, /\*\*GIVEN\*\* the skill offers "Skip - already done".*\*\*MUST NOT\*\* choose it/);
  assert.match(prompt, /no test runner is set up.*redirect to \/10x-implement.*\*\*THEN\*\* you \*\*MUST\*\* stop, change nothing and finish with status `blocked`/);
  assert.match(prompt, /never set `signals\.needsHuman`/);
  assert.match(prompt, /manual confirmation gate.*treat it as confirmed.*leave every Manual row unticked/);
  assert.match(prompt, /approve it as proposed/);
  assert.match(prompt, /commit only the planned set/);
  assert.match(prompt, /MUST NOT\*\* tick the row, because the router counts only rows backed by a code commit/);
  assert.match(prompt, /MUST NOT\*\* run pbcopy/);
  assert.match(prompt, /MUST NOT\*\* print a plain-text question/);
  assert.deepEqual(POLICY.prompts["implement-tdd"], ["Run /10x-tdd {id} phase {phase}", "@prompts/executor-tdd.md"]);
});

test("tdd entry skill", () => {
  const { e } = firstStep([tddPhase()]);
  assert.equal(e.skill, "10x-tdd");
  // The segment before it logs the goal skill; the tdd step after it the tdd skill.
  const specs = [GOAL_ONLY, tddPhase()];
  const { project, e: seg } = firstStep(specs);
  assert.equal(seg.template, "implement-segment");
  assert.equal(seg.skill, "10x-goal-implement");
  advance(project, specs, [1]);
  assert.equal(lastEntry(project).template, "implement-tdd");
  assert.equal(lastEntry(project).skill, "10x-tdd");
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
    for (const phase of [1, 2, 3, 4, 5, 6]) {
      const res = gateRun(real, phase);
      assert.equal(res.status, 0, `phase ${phase}: ${res.stderr}`);
    }
  }
});

// ---- phase 6: report label, compare count and the smoke run ------------------

test("report shows fallback", () => {
  const project = makeProject({ plan: buildPlan([{ auto: ["row one"] }]) });
  writeLog(project, [
    entry(1, "plan", { usage: { totalTokens: 10 } }),
    entry(2, "implement", { template: "implement-e2e", ok: false, verified: false, fallback: true, result: { status: "blocked", note: "no feature" }, usage: { totalTokens: 10 } }),
    entry(3, "implement", { template: "implement-segment", usage: { totalTokens: 10 } }),
    entry(4, "implement", { ok: false, verified: false, result: { status: "failed", note: "broke" }, usage: { totalTokens: 10 } }),
    entry(5, "implement", { template: "implement-retry", usage: { totalTokens: 10 } }),
    entry(6, "impl-review", { usage: { totalTokens: 10 } }),
    pendingEntry(7, "fix"),
  ]);
  writeMetaFile(project, { id: project.id, goal: "fix typo", baseSha: "a".repeat(40), rigor: { level: "standard" }, outcome: { action: "done" } });
  assert.equal(run(project, ["status", project.id, "--report"]).status, 0);
  const rows = Object.fromEntries(readReportFile(project).split("\n").filter((l) => /^\| \d+ \|/.test(l)).map((l) => {
    const cells = l.split("|").map((c) => c.trim());
    return [cells[1], { step: cells[2], result: cells[7] }];
  }));
  assert.deepEqual(rows[1], { step: "plan", result: "ok" });
  assert.deepEqual(rows[2], { step: "implement (implement-e2e)", result: "fallback" });
  assert.deepEqual(rows[3], { step: "implement (implement-segment)", result: "ok" });
  assert.deepEqual(rows[4], { step: "implement", result: "failed" });
  assert.deepEqual(rows[5], { step: "implement (implement-retry)", result: "ok" });
  assert.deepEqual(rows[6], { step: "impl-review", result: "ok" });
  assert.deepEqual(rows[7], { step: "fix", result: "-" });

  // compare counts the failed entry, not the fallback; the fallback entry still has to carry a token figure.
  const baseline = makeProject({ plan: buildPlan([{ auto: ["row one"] }]) });
  writeLog(baseline, [entry(1, "plan", { usage: { totalTokens: 100 } }), entry(2, "implement", { usage: { totalTokens: 100 } })]);
  writeMetaFile(baseline, { id: baseline.id, goal: "fix typo", baseSha: "a".repeat(40), rigor: { level: "standard" }, outcome: { action: "done" } });
  const res = run(project, ["compare", project.id, "--baseline", baseline.root]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.routed.failedAttempts, 1);
  assert.equal(res.json.baseline.failedAttempts, 0);
});

test("executors smoke", () => {
  const specs = [{ name: "Login flow", auto: ["Playwright spec covers login: `npx playwright test tests/e2e/login.spec.ts`"], manual: ["Run `node --version` and see a version"] }];
  const project = makeProject({ plan: buildPlan(specs) });
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review")]);
  // init prints one JSON object with a run action; status prints one JSON object with the step log.
  const started = init(project, "Cover the login flow in the browser", ["--rigor", "standard", "--chrome"]);
  assert.equal(started.status, 0, started.stderr);
  assert.notEqual(started.json, null, `init printed no JSON: ${started.stdout}`);
  assert.equal(started.json.action, "run");
  assert.equal(started.json.step, "implement");
  const status = run(project, ["status", project.id]);
  assert.equal(status.status, 0, status.stderr);
  assert.notEqual(status.json, null, `status printed no JSON: ${status.stdout}`);
  assert.equal(status.json.rigor, "standard");
  assert.equal(Array.isArray(status.json.steps), true);
  assert.equal(status.json.steps.at(-1).step, "implement");
  // The files the router owns parse as JSON, one object per log line.
  assert.equal(readMetaFile(project).chrome, true);
  assert.equal(readLogEntries(project).length, 3);
  // A resume prints valid JSON again.
  writeResult(project, { status: "done", note: "x" });
  const resumed = next(project);
  assert.notEqual(resumed.json, null, `next printed no JSON: ${resumed.stdout}`);
});
