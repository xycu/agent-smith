// Real pre-init setup, both chains. Fixtures and all Git effects stay in scratch repositories.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cleanupAll, makeProject, run, git, gitEnv, gitInit, ROUTE, planText, writeReview } from "./helpers.mjs";

after(cleanupAll);
const PREPARE_RUN = fileURLToPath(new URL("../scripts/prepare-run.mjs", import.meta.url));
const SCRIPTS = path.dirname(PREPARE_RUN);
const REAL_GIT = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const relChange = (chain) => `${chain === "openspec" ? "openspec" : "context"}/changes/demo`;

function fixture(chain = "10x", nest = null, committed = false) {
  const p = makeProject({ policy: { isolation: { require: true } }, nest, change: false });
  p.chain = chain;
  if (chain === "openspec") fs.rmdirSync(p.changeDir);
  p.changeDir = path.join(p.root, relChange(chain));
  fs.mkdirSync(p.changeDir, { recursive: true });
  fs.writeFileSync(path.join(p.changeDir, "change.md"), "---\nchange_id: demo\nstatus: planned\n---\n");
  fs.writeFileSync(path.join(p.root, "tracked.txt"), "original\n");
  if (chain === "openspec") fs.writeFileSync(path.join(p.root, "openspec/config.yaml"), "schema: spec-driven\n");
  gitInit(p);
  git(p, ["add", "--", path.relative(p.base, path.join(p.root, "context/foundation")),
    path.relative(p.base, path.join(p.root, "tracked.txt"))]);
  if (chain === "openspec") git(p, ["add", "--", path.relative(p.base, path.join(p.root, "openspec/config.yaml"))]);
  if (committed) git(p, ["add", "--", path.relative(p.base, p.changeDir)]);
  git(p, ["commit", "-qm", "fixture"]);
  return p;
}

function setup(p, { env = {}, args = ["demo", "--chain", p.chain], script = PREPARE_RUN, timeout } = {}) {
  const res = run(p, args, { script, env: { ...gitEnv(p), ...env }, ...(timeout ? { timeout } : {}) });
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.json, res.stdout);
  assert.equal(res.stdout.trim().split("\n").length, 1);
  assert.equal(res.json.root, p.root);
  assert.deepEqual(res.json.left, []);
  if (res.json.reason !== null) assert.equal(res.json.runRoot, null);
  return res.json;
}

function success(p, expected, options) {
  const out = setup(p, options);
  assert.equal(out.reason, null, JSON.stringify(out));
  assert.equal(out.case, expected);
  return out;
}

function linked(p, branch = "agent-smith/demo", name = "custom checkout") {
  const top = path.join(p.base, name);
  git(p, ["worktree", "add", "-qb", branch, top]);
  return { ...p, root: path.join(top, path.relative(p.base, p.root)), top };
}

function override(p, value) {
  fs.writeFileSync(path.join(p.root, "context/foundation/agent-smith-policy.json"), JSON.stringify(value));
}

function snapshot(file) {
  const stat = fs.lstatSync(file);
  return { mtime: stat.mtimeMs, mode: stat.mode, bytes: fs.readFileSync(file, "utf8") };
}

// A Node wrapper delegates only the permitted commands to real Git, records argv, and can fail or pause a call.
function wrapper(p, mode = "", match = "", mutation = null) {
  const bin = path.join(p.base, "wrapper");
  fs.mkdirSync(bin, { recursive: true });
  const log = path.join(bin, "commands.jsonl");
  const signal = path.join(bin, "ready");
  const release = path.join(bin, "release");
  const script = `#!${process.execPath}
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + "\\n");
const command = args[0] === "-C" ? args[2] : args[0];
const allowed = ["rev-parse", "symbolic-ref", "show-ref", "status", "check-ignore", "worktree", "ls-files", "ls-tree", "merge-base", "hash-object"];
if (!allowed.includes(command) || (command === "worktree" && !["add", "list"].includes(args[1]))) process.exit(99);
const matched = args.join(" ").includes(${JSON.stringify(match)});
if (${JSON.stringify(mode)} === "fail" && matched) { process.stderr.write("injected Git failure"); process.exit(70); }
if (${JSON.stringify(mode)} === "timeout" && matched) {
  process.on("SIGTERM", () => { fs.writeFileSync(${JSON.stringify(signal)}, "terminated"); process.exit(0); });
  setTimeout(() => process.exit(71), 130000);
} else {
  const mutation = ${JSON.stringify(mutation)};
  if (${JSON.stringify(mode)} === "edit" && matched) {
    const calls = fs.readFileSync(${JSON.stringify(log)}, "utf8").trim().split("\\n").map(JSON.parse);
    if (calls.filter((call) => call.join(" ").includes(${JSON.stringify(match)})).length === mutation.after) {
      fs.writeFileSync(mutation.file, mutation.text);
    }
  }
  const res = spawnSync(${JSON.stringify(REAL_GIT)}, args, { env: process.env, encoding: "utf8",
    input: command === "hash-object" ? fs.readFileSync(0) : undefined });
  if (${JSON.stringify(mode)} === "pause" && command === "worktree" && args[1] === "add" && res.status === 0) {
    fs.writeFileSync(${JSON.stringify(signal)}, "registered");
    const deadline = Date.now() + 90000;
    while (!fs.existsSync(${JSON.stringify(release)})) {
      if (Date.now() > deadline) process.exit(72);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  process.stdout.write(res.stdout || "");
  process.stderr.write(res.stderr || "");
  process.exit(res.status ?? 73);
}
`;
  fs.writeFileSync(path.join(bin, "git"), script, { mode: 0o755 });
  return { env: { PATH: `${bin}${path.delimiter}${process.env.PATH}` }, log, signal, release };
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: six cases, precedence and immutable resumes`, () => {
    const p = fixture(chain);
    const head = git(p, ["rev-parse", "HEAD"]);
    const index = fs.readFileSync(path.join(p.base, ".git/index"));
    const config = fs.readFileSync(path.join(p.base, ".git/config"));
    fs.writeFileSync(path.join(p.root, "tracked.txt"), "dirty\n");
    fs.writeFileSync(path.join(p.root, "outside é\nfile"), "outside");
    const created = success(p, "created");
    assert.equal(created.copied, true);
    assert.equal(created.excludeAdded, true);
    assert.deepEqual(created.notInRun.sort(), ["outside é\nfile", "tracked.txt"].sort());
    assert.equal(git(p, ["rev-parse", "agent-smith/demo"]), head);
    assert.equal(git(p, ["rev-parse", "HEAD"]), head);
    assert.deepEqual(fs.readFileSync(path.join(p.base, ".git/index")), index);
    assert.deepEqual(fs.readFileSync(path.join(p.base, ".git/config")), config);
    assert.equal(fs.readFileSync(path.join(created.runRoot, "tracked.txt"), "utf8"), "original\n");
    assert.equal(fs.existsSync(path.join(created.runRoot, "outside é\nfile")), false);
    const dest = path.join(created.runRoot, relChange(chain), "change.md");
    fs.writeFileSync(dest, "newer run");
    fs.utimesSync(dest, 1200000000, 1200000001);
    const before = snapshot(dest);
    fs.writeFileSync(path.join(p.changeDir, "change.md"), "stale source");
    fs.mkdirSync(path.join(p.changeDir, "agent-smith"), { recursive: true });
    fs.writeFileSync(path.join(p.changeDir, "agent-smith/meta.json"), "{}");
    const reused = success(p, "reused");
    assert.equal(reused.runRoot, created.runRoot);
    assert.equal(reused.copied, false);
    assert.equal(reused.excludeAdded, false);
    assert.deepEqual(snapshot(dest), before);
    const current = { ...p, root: created.runRoot };
    assert.equal(success(current, "in-run-worktree").branch, "agent-smith/demo");
    assert.equal(success(current, "in-run-worktree", { args: ["other", "--chain", chain] }).branch, "agent-smith/demo");
    override(current, { isolation: { require: false } });
    assert.equal(success(current, "opt-out").runRoot, current.root);

    const flight = fixture(chain);
    fs.mkdirSync(path.join(flight.changeDir, "agent-smith"));
    const meta = path.join(flight.changeDir, "agent-smith/meta.json");
    fs.writeFileSync(meta, "{}");
    const saved = snapshot(meta);
    const refs = git(flight, ["show-ref"]);
    assert.equal(success(flight, "in-flight-main").runRoot, flight.root);
    assert.deepEqual(snapshot(meta), saved);
    assert.equal(git(flight, ["show-ref"]), refs);
    git(flight, ["branch", "agent-smith/demo"]);
    assert.equal(success(flight, "attached").copied, false);
    assert.equal(fs.existsSync(path.join(flight.root, ".claude/worktrees/agent-smith-demo", relChange(chain), "agent-smith/meta.json")), false);
  });

  test(`${chain}: fresh committed copy preserves times, mode, hidden files and symlinks`, () => {
    const p = fixture(chain, null, true);
    const plan = path.join(p.changeDir, "plan.md");
    const review = path.join(p.changeDir, ".hidden/review.md");
    fs.mkdirSync(path.dirname(review));
    fs.writeFileSync(plan, "plan\n", { mode: 0o755 });
    fs.writeFileSync(review, "review\n");
    fs.symlinkSync("../../../../tracked.txt", path.join(p.changeDir, "link"));
    const source = path.join(p.changeDir, "change.md");
    fs.writeFileSync(source, "modified committed content");
    for (const [file, time] of [[plan, 1200000000], [review, 1200000002], [source, 1200000004]]) fs.utimesSync(file, time, time);
    const out = success(p, "created");
    for (const [file, time] of [[plan, 1200000000], [review, 1200000002], [source, 1200000004]]) {
      const dest = path.join(out.runRoot, path.relative(p.root, file));
      const stat = fs.statSync(dest);
      assert.equal(stat.atimeMs, time * 1000);
      assert.equal(stat.mtimeMs, time * 1000);
      assert.equal(stat.mode & 0o777, fs.statSync(file).mode & 0o777);
      assert.equal(fs.readFileSync(dest, "utf8"), fs.readFileSync(file, "utf8"));
    }
    assert.equal(fs.readlinkSync(path.join(out.runRoot, relChange(chain), "link")), "../../../../tracked.txt");
    assert.equal(fs.existsSync(path.join(out.runRoot, relChange(chain), "demo")), false);
  });

  test(`${chain}: registered custom worktree and unattached branch keep committed destination`, () => {
    const p = fixture(chain, null, true);
    const wt = linked(p);
    fs.writeFileSync(path.join(p.changeDir, "change.md"), "stale source");
    assert.equal(success(p, "reused").worktree, wt.top);
    const q = fixture(chain, null, true);
    git(q, ["branch", "agent-smith/demo"]);
    fs.writeFileSync(path.join(q.changeDir, "change.md"), "stale source");
    const exclude = fs.readFileSync(path.join(q.base, ".git/info/exclude"));
    const out = success(q, "attached");
    assert.equal(out.copied, false);
    assert.equal(out.excludeAdded, false);
    assert.deepEqual(fs.readFileSync(path.join(q.base, ".git/info/exclude")), exclude);
    assert.match(fs.readFileSync(path.join(out.runRoot, relChange(chain), "change.md"), "utf8"), /change_id: demo/);
  });

  test(`${chain}: unrelated linked branch, detached HEAD and other-chain metadata follow later cases`, () => {
    const p = fixture(chain, null, true);
    const wt = linked(p, "feature/demo");
    assert.equal(success(wt, "created").branch, "agent-smith/demo");
    const q = fixture(chain, null, true);
    git(q, ["checkout", "--detach", "-q"]);
    success(q, "created");
    const r = fixture(chain);
    const other = path.join(r.root, relChange(chain === "10x" ? "openspec" : "10x"), "agent-smith");
    fs.mkdirSync(other, { recursive: true });
    fs.writeFileSync(path.join(other, "meta.json"), "{}");
    success(r, "created");
  });

  test(`${chain}: prepare then real init runs from the isolated root; no-op router behavior survives`, () => {
    const p = fixture(chain);
    const out = success(p, "created");
    const result = run({ ...p, root: out.runRoot }, ["init", "demo", "--goal", GOAL, "--chain", chain], { env: gitEnv(p) });
    assert.equal(result.json?.action, "run", JSON.stringify(result));
    const meta = path.join(out.runRoot, relChange(chain), "agent-smith/meta.json");
    assert.equal(JSON.parse(fs.readFileSync(meta)).isolated, true);
    const before = snapshot(meta);
    success(p, "reused");
    assert.deepEqual(snapshot(meta), before);
    assert.equal(fs.existsSync(path.join(p.changeDir, "agent-smith/meta.json")), false);
    const q = fixture(chain);
    override(q, { isolation: { require: false }, score: { minRigor: null } });
    const off = success(q, "opt-out");
    assert.equal(run({ ...q, root: off.runRoot }, ["init", "demo", "--goal", GOAL, "--chain", chain], { env: gitEnv(q) }).json?.action, "run");
    const r = fixture(chain);
    fs.mkdirSync(path.join(r.changeDir, "agent-smith"));
    fs.writeFileSync(path.join(r.changeDir, "agent-smith/meta.json"), "{}");
    success(r, "in-flight-main");
    assert.equal(run(r, ["init", "demo", "--goal", GOAL, "--chain", chain], { env: gitEnv(r) }).json?.action, "halt");
  });

  for (const nest of ["apps/widget", "apps/żółć [a]*? #! space"]) {
    test(`${chain}: prefix ${nest} in all four worktree paths`, () => {
      const p = fixture(chain, nest, true);
      const created = success(p, "created");
      assert.equal(created.worktree, path.join(p.root, ".claude/worktrees/agent-smith-demo"));
      assert.equal(created.runRoot, path.join(created.worktree, nest));
      assert.ok(fs.existsSync(path.join(created.runRoot, relChange(chain), "change.md")));
      success({ ...p, root: created.runRoot }, "in-run-worktree");
      assert.equal(success(p, "reused").runRoot, created.runRoot);
      assert.equal(git(p, ["-C", p.root, "check-ignore", ".claude/worktrees/agent-smith-demo/x"]), ".claude/worktrees/agent-smith-demo/x");
      const q = fixture(chain, nest, true);
      git(q, ["branch", "agent-smith/demo"]);
      const attached = success(q, "attached");
      assert.equal(attached.runRoot, path.join(attached.worktree, nest));
    });
  }
}

test("opt-out without Git or a repository is read-only; bad argv never invokes Git", () => {
  const p = makeProject();
  p.chain = "10x";
  assert.equal(success(p, "opt-out").runRoot, p.root);
  const empty = path.join(p.base, "empty");
  fs.mkdirSync(empty);
  success(p, "opt-out", { env: { PATH: empty } });
  const w = wrapper(p);
  for (const args of [[], ["../bad"], ["demo", "--chain"], ["demo", "--chain", "bad"], ["demo", "--other"], ["demo", "extra"], ["demo", "--chain=10x"]]) {
    const res = run(p, args, { script: PREPARE_RUN, env: { ...gitEnv(p), ...w.env } });
    assert.equal(res.status, 2);
    assert.equal(res.stdout, "");
    assert.match(res.stderr, /Usage:/);
  }
  assert.equal(fs.existsSync(w.log), false);
});

function effectiveIsolation(p, scripts = SCRIPTS) {
  const code = `import {loadPolicy} from ${JSON.stringify(pathToFileURL(path.join(scripts, "state.mjs")).href)};
import {isolationOn} from ${JSON.stringify(pathToFileURL(path.join(scripts, "isolation.mjs")).href)};
console.log(JSON.stringify(isolationOn(loadPolicy())));`;
  const parity = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: p.root, env: gitEnv(p), encoding: "utf8", timeout: 120000 });
  assert.equal(parity.status, 0, parity.stderr);
  return JSON.parse(parity.stdout);
}

test("policy projection agrees with real loadPolicy/isolationOn for all supported JSON shapes", () => {
  const values = [{}, { isolation: {} }, { isolation: { require: true } }, { isolation: { require: false } },
    ...[null, "true", 1, [], false].map((isolation) => ({ isolation })),
    ...[null, "true", 1, [], {}].map((require) => ({ isolation: { require } }))];
  for (const value of values) {
    const p = fixture();
    override(p, value);
    success(p, effectiveIsolation(p) ? "created" : "opt-out");
  }
  const p = fixture();
  fs.unlinkSync(path.join(p.root, "context/foundation/agent-smith-policy.json"));
  success(p, "created");
});

test("policy projection follows changed shipped defaults and OpenSpec fragments", () => {
  const p = fixture();
  const plugin = path.join(p.base, "plugin");
  fs.cpSync(path.resolve(SCRIPTS, "../.."), plugin, { recursive: true });
  const script = path.join(plugin, "10x-pipeline/scripts/prepare-run.mjs");
  const base = path.join(plugin, "10x-pipeline/policy.json");
  const fragment = path.join(plugin, "openspec-pipeline/policy.json");
  fs.writeFileSync(base, JSON.stringify({ isolation: { require: false } }));
  fs.writeFileSync(fragment, JSON.stringify({ isolation: { require: true } }));
  override(p, { isolation: {} });
  assert.equal(effectiveIsolation(p, path.dirname(script)), true);
  success(p, "created", { script });
  fs.writeFileSync(fragment, JSON.stringify({ isolation: { require: false } }));
  assert.equal(effectiveIsolation(p, path.dirname(script)), false);
  success(p, "opt-out", { script });
});

test("invalid and unreadable policy fail before any mutation, even with privileged tests", () => {
  for (const text of ["{", "null", "[]", "true", "1", '"bad"', null]) {
    const p = fixture();
    const policy = path.join(p.root, "context/foundation/agent-smith-policy.json");
    if (text === null) { fs.unlinkSync(policy); fs.mkdirSync(policy); } else fs.writeFileSync(policy, text);
    const refs = git(p, ["show-ref"]);
    const exclude = fs.readFileSync(path.join(p.base, ".git/info/exclude"));
    const out = setup(p);
    assert.ok(out.reason);
    assert.equal(out.case, null);
    assert.equal(git(p, ["show-ref"]), refs);
    assert.deepEqual(fs.readFileSync(path.join(p.base, ".git/info/exclude")), exclude);
  }
});

test("excludes preserve bytes and newline boundaries; existing ignores add nothing", () => {
  const p = fixture();
  const file = path.join(p.base, ".git/info/exclude");
  fs.writeFileSync(file, "# existing bytes");
  success(p, "created");
  const bytes = fs.readFileSync(file, "utf8");
  assert.equal(bytes, "# existing bytes\n/.claude/worktrees/\n");
  success(p, "reused");
  assert.equal(fs.readFileSync(file, "utf8"), bytes);
  const q = fixture();
  fs.writeFileSync(path.join(q.base, ".git/info/exclude"), ".claude/\n");
  assert.equal(success(q, "created").excludeAdded, false);
});

test("status reports staged, unstaged, untracked and rename paths with repository-relative raw spelling", () => {
  const p = fixture("10x", "apps/widget");
  fs.renameSync(path.join(p.root, "tracked.txt"), path.join(p.root, "renamed é\n.txt"));
  git(p, ["add", "-u"]);
  fs.writeFileSync(path.join(p.root, "renamed é\n.txt"), "unstaged");
  fs.writeFileSync(path.join(p.root, "untracked space"), "untracked");
  const out = success(p, "created");
  assert.deepEqual(out.notInRun.sort(), ["apps/widget/tracked.txt", "apps/widget/renamed é\n.txt", "apps/widget/untracked space"].sort());
});

test("an untracked project prefix receives fresh change inputs; main branch registration is reused", () => {
  const p = fixture("10x", "apps/widget");
  const nested = path.join(p.base, "untracked/project");
  fs.mkdirSync(path.join(nested, "context/changes/demo"), { recursive: true });
  fs.writeFileSync(path.join(nested, "context/changes/demo/change.md"), "untracked project");
  const out = success({ ...p, root: nested }, "created");
  assert.equal(fs.readFileSync(path.join(out.runRoot, "context/changes/demo/change.md"), "utf8"), "untracked project");
  const q = fixture();
  git(q, ["branch", "-m", "agent-smith/demo"]);
  assert.equal(success(q, "reused").runRoot, q.root);
});

test("operational failures return honest JSON and leave created resources intact", () => {
  for (const match of ["show-ref", "worktree list", "check-ignore", "status", "worktree add"]) {
    const p = fixture();
    if (match === "worktree list") git(p, ["branch", "agent-smith/demo"]);
    const w = wrapper(p, "fail", match);
    assert.match(setup(p, { env: w.env }).reason, /injected Git failure/);
    assert.equal(fs.readdirSync(path.join(p.base, ".git")).some((name) => name.endsWith(".lock")), false);
  }
  const occupied = fixture();
  const target = path.join(occupied.root, ".claude/worktrees/agent-smith-demo");
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "keep"), "valuable");
  assert.ok(setup(occupied).reason);
  assert.equal(fs.readFileSync(path.join(target, "keep"), "utf8"), "valuable");
  const exclude = fixture();
  fs.unlinkSync(path.join(exclude.base, ".git/info/exclude"));
  fs.mkdirSync(path.join(exclude.base, ".git/info/exclude"));
  assert.ok(setup(exclude).reason);
  const missing = fixture();
  fs.renameSync(missing.changeDir, `${missing.changeDir}-saved`);
  const failure = setup(missing);
  assert.equal(failure.case, "created");
  assert.equal(failure.copied, false);
  assert.ok(failure.reason);
  assert.equal(failure.worktree, null);
  assert.equal(failure.excludeAdded, false);
  assert.equal(git(missing, ["branch", "--list", "agent-smith/demo"]), "");
  fs.renameSync(`${missing.changeDir}-saved`, missing.changeDir);
  const resumed = success(missing, "created");
  assert.equal(fs.existsSync(path.join(resumed.runRoot, relChange("10x"), "change.md")), true);
  const copy = fixture("10x", null, true);
  fs.unlinkSync(path.join(copy.changeDir, "change.md"));
  fs.mkdirSync(path.join(copy.changeDir, "change.md"));
  const failedCopy = setup(copy);
  assert.equal(failedCopy.case, "created");
  assert.equal(failedCopy.copied, false);
  assert.ok(failedCopy.reason);
  success(copy, "reused");
});

test("unavailable registered worktrees cannot select a replacement repository", () => {
  const unavailable = fixture("10x", null, true);
  const wt = linked(unavailable);
  fs.renameSync(wt.top, `${wt.top}-moved`);
  assert.ok(setup(unavailable).reason);
  fs.mkdirSync(wt.top);
  git(unavailable, ["-C", wt.top, "init", "-q"]);
  assert.match(setup(unavailable).reason, /no longer belongs/);
});

test("Git discovery preserves the source index when clean file timestamps changed", () => {
  const p = fixture();
  const index = path.join(p.base, ".git/index");
  const before = fs.readFileSync(index);
  fs.utimesSync(path.join(p.root, "tracked.txt"), 1200000000, 1200000000);
  success(p, "created");
  assert.deepEqual(fs.readFileSync(index), before);
});

test("command allowlist and automatic tracking config remain unchanged", () => {
  const p = fixture();
  git(p, ["config", "branch.autoSetupMerge", "always"]);
  const config = fs.readFileSync(path.join(p.base, ".git/config"));
  const w = wrapper(p);
  success(p, "created", { env: w.env });
  success(p, "reused", { env: w.env });
  assert.deepEqual(fs.readFileSync(path.join(p.base, ".git/config")), config);
  const calls = fs.readFileSync(w.log, "utf8").trim().split("\n").map(JSON.parse);
  assert.ok(calls.some((args) => args.includes("--no-track")));
  assert.ok(calls.every((args) => !args.some((arg) => /^(?:push|config|commit|reset|clean|remove|prune|delete|--force|--no-verify)$/.test(arg))));
  const source = fs.readFileSync(PREPARE_RUN, "utf8");
  assert.doesNotMatch(source, /from ["'].\/(?:state|route|isolation|steps|flow|preplan)\.mjs/);
  assert.doesNotMatch(source, /\b(?:execSync|execFileSync|runGh)\b|spawn\(["'](?:gh|sh|bash|cp)["']/);
  assert.doesNotMatch(source, /["'](?:push|config|commit|reset|clean|--force|--no-verify)["']/);
});

function launch(p, env) {
  const child = spawn(process.execPath, [PREPARE_RUN, "demo", "--chain", p.chain], { cwd: p.root, env: { ...gitEnv(p), ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (part) => { stdout += part; });
  child.stderr.on("data", (part) => { stderr += part; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => { if (code === 0) resolve(JSON.parse(stdout)); else reject(new Error(stderr)); });
  });
  return { child, done };
}

async function waitFor(file) {
  const deadline = Date.now() + 60000;
  while (!fs.existsSync(file)) {
    assert.ok(Date.now() < deadline, `Timed out waiting for ${file}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: shared lock covers published worktree until copy finishes, across chains and prefixes`, async () => {
    const p = fixture(chain, "apps/widget");
    const w = wrapper(p, "pause");
    const first = launch(p, w.env);
    try {
      await waitFor(w.signal);
      const top = path.join(p.root, ".claude/worktrees/agent-smith-demo");
      assert.equal(fs.existsSync(path.join(top, "apps/widget", relChange(chain), "change.md")), false);
      for (const caller of [p, { ...p, root: path.join(top, "apps/widget") }, { ...p, root: top, chain: chain === "10x" ? "openspec" : "10x" }]) {
        assert.match(setup(caller).reason, /Setup lock exists.*inspect/);
      }
      fs.writeFileSync(w.release, "continue");
      const out = await first.done;
      assert.equal(out.reason, null, JSON.stringify(out));
      assert.equal(out.copied, true);
      success(p, "reused");
      success({ ...p, root: out.runRoot }, "in-run-worktree");
    } finally {
      fs.writeFileSync(w.release, "continue");
      await first.done;
    }
  });
}

test("fresh copy replaces destination symlinks without writing through them", () => {
  const p = fixture("10x", null, true);
  const outside = path.join(p.base, "outside");
  fs.writeFileSync(outside, "keep outside");
  const link = path.join(p.changeDir, "link");
  fs.symlinkSync(outside, link);
  git(p, ["add", "--", path.relative(p.base, link)]);
  git(p, ["commit", "-qm", "committed link"]);
  const out = success(p, "created");
  assert.equal(fs.readlinkSync(path.join(out.runRoot, relChange("10x"), "link")), outside);
  assert.equal(fs.readFileSync(outside, "utf8"), "keep outside");
  const q = fixture("10x", null, true);
  const qLink = path.join(q.changeDir, "link");
  fs.symlinkSync(outside, qLink);
  git(q, ["add", "--", path.relative(q.base, qLink)]);
  git(q, ["commit", "-qm", "committed link"]);
  fs.unlinkSync(qLink);
  fs.writeFileSync(qLink, "fresh file");
  const replaced = success(q, "created");
  assert.equal(fs.lstatSync(path.join(replaced.runRoot, relChange("10x"), "link")).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(outside, "utf8"), "keep outside");
  const r = fixture("10x", null, true);
  const file = path.join(r.changeDir, "change.md");
  fs.unlinkSync(file);
  fs.symlinkSync(outside, file);
  const changed = success(r, "created");
  assert.equal(fs.readlinkSync(path.join(changed.runRoot, relChange("10x"), "change.md")), outside);
  assert.equal(fs.readFileSync(outside, "utf8"), "keep outside");
});

test("a preexisting setup lock is preserved for inspection", () => {
  const p = fixture();
  const lock = path.join(p.base, ".git/agent-smith-setup-agent-smith%2Fdemo.lock");
  fs.writeFileSync(lock, "inspect me");
  assert.match(setup(p).reason, /Setup lock exists/);
  assert.equal(fs.readFileSync(lock, "utf8"), "inspect me");
});

test("real Git deadline returns failure JSON before the outer helper deadline", { timeout: 155000 }, () => {
  const p = fixture();
  const w = wrapper(p, "timeout", "show-ref");
  const start = Date.now();
  const out = setup(p, { env: w.env, timeout: 150000 });
  assert.match(out.reason, /timed out after 120000 ms/);
  assert.ok(Date.now() - start >= 120000);
  assert.equal(fs.readFileSync(w.signal, "utf8"), "terminated");
});

function cleanup(p, saved, { env = {}, input = JSON.stringify(saved), preload = null, args = [] } = {}) {
  const res = spawnSync(process.execPath, [...(preload ? ["--import", preload] : []), PREPARE_RUN,
    "demo", "--chain", p.chain, "--cleanup", ...args], {
    cwd: p.root, env: { ...gitEnv(p), ...env }, input, encoding: "utf8", timeout: 120000,
  });
  let json;
  try { json = JSON.parse(res.stdout); } catch { /* usage errors have no JSON */ }
  return { ...res, json };
}

function cleanSuccess(p, saved, options) {
  const res = cleanup(p, saved, options);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json?.reason, null, res.stdout);
  assert.equal(res.json.runRoot, saved.runRoot);
  return res.json;
}

function initialize(p, saved = success(p, "created"), flags = []) {
  const res = run({ ...p, root: saved.runRoot }, ["init", "demo", "--goal", GOAL, "--chain", p.chain, ...flags], { env: gitEnv(p) });
  assert.ok(["run", "done", "archive"].includes(res.json?.action), res.stdout + res.stderr);
  const file = path.join(saved.runRoot, relChange(p.chain), "agent-smith/meta.json");
  const meta = JSON.parse(fs.readFileSync(file));
  assert.match(meta.startCommit, /^[0-9a-f]{40,64}$/);
  return { saved, res, meta, file };
}

function originalState(p) {
  return {
    index: fs.readFileSync(path.join(p.base, ".git/index")),
    config: fs.readFileSync(path.join(p.base, ".git/config")),
    head: git(p, ["rev-parse", "HEAD"]),
    branch: git(p, ["symbolic-ref", "HEAD"]),
    refs: git(p, ["show-ref"]),
  };
}

function blob(p, meta, file) {
  const prefix = path.relative(p.base, p.root);
  const name = path.posix.join(prefix.split(path.sep).join("/"), relChange(p.chain), file);
  const res = spawnSync(REAL_GIT, ["show", `${meta.startCommit}:${name}`], { cwd: p.base, env: gitEnv(p) });
  assert.equal(res.status, 0, res.stderr.toString());
  return res.stdout;
}

for (const chain of ["10x", "openspec"]) {
  for (const nest of [null, "apps/widget", "apps/żółć [a]*? #! space"]) {
    test(`${chain}: cleanup retains exact blobs and permits source-absent resume (${nest})`, () => {
      const p = fixture(chain, nest);
      const inputs = { "change.md": fs.readFileSync(path.join(p.changeDir, "change.md")),
        "binary": Buffer.from([0, 255, 128, 13, 10]), ".hidden/nested/text": Buffer.from("retained żółć\n") };
      for (const [file, bytes] of Object.entries(inputs)) {
        fs.mkdirSync(path.dirname(path.join(p.changeDir, file)), { recursive: true });
        fs.writeFileSync(path.join(p.changeDir, file), bytes);
      }
      fs.mkdirSync(path.join(p.changeDir, "empty/deep"), { recursive: true });
      const { saved, meta } = initialize(p);
      const state = originalState(p);
      const beforeMeta = snapshot(path.join(saved.runRoot, relChange(chain), "agent-smith/meta.json"));
      const w = wrapper(p);
      assert.deepEqual(cleanSuccess(p, saved, { env: w.env }).left, []);
      assert.equal(fs.existsSync(p.changeDir), false);
      assert.deepEqual(originalState(p), state);
      for (const [file, bytes] of Object.entries(inputs)) assert.deepEqual(blob(p, meta, file), bytes);
      assert.deepEqual(cleanSuccess(p, saved).left, []);
      const resumed = success(p, "reused");
      assert.equal(resumed.runRoot, saved.runRoot);
      assert.deepEqual(cleanSuccess(p, resumed).left, []);
      assert.deepEqual(snapshot(path.join(saved.runRoot, relChange(chain), "agent-smith/meta.json")), beforeMeta);
      const again = run({ ...p, root: resumed.runRoot }, ["init", "demo", "--chain", chain], { env: gitEnv(p) });
      assert.match(again.json.reason, /Step 1 .* has no result/);
      assert.deepEqual(originalState(p), state);
    });
  }

  test(`${chain}: cleanup reports tracked, edited, additional, unretained and unsupported inputs`, () => {
    const p = fixture(chain, "apps/widget", true);
    const put = (file, text) => fs.writeFileSync(path.join(p.changeDir, file), text);
    for (const name of ["tracked-same", "tracked-modified", "tracked-staged", "removed-index"]) put(name, name);
    git(p, ["add", "--", path.relative(p.base, p.changeDir)]);
    git(p, ["commit", "-qm", "retain tracked inputs"]);
    put("tracked-modified", "modified");
    put("tracked-staged", "staged");
    git(p, ["add", "--", path.relative(p.base, path.join(p.changeDir, "tracked-staged"))]);
    git(p, ["rm", "--cached", "--", path.relative(p.base, path.join(p.changeDir, "removed-index"))]);
    for (const name of ["after-copy", "after-init", "unretained", "eligible"]) put(name, name);
    fs.symlinkSync("../../../../tracked.txt", path.join(p.changeDir, "link"));
    const saved = success(p, "created");
    put("after-copy", "edited after copying");
    fs.unlinkSync(path.join(saved.runRoot, relChange(chain), "unretained"));
    const { meta } = initialize(p, saved);
    put("after-init", "edited after init");
    put("new", "new source input");
    put("staged-add", "index owns this");
    git(p, ["add", "--", path.relative(p.base, path.join(p.changeDir, "staged-add"))]);
    assert.equal(spawnSync("mkfifo", [path.join(p.changeDir, "fifo")]).status, 0);
    const retained = ["change.md", "tracked-same", "tracked-modified", "tracked-staged", "removed-index",
      "after-copy", "after-init", "unretained", "link", "new", "staged-add", "fifo"];
    const bytes = retained.filter((name) => !["link", "fifo"].includes(name)).map((name) => [name, snapshot(path.join(p.changeDir, name))]);
    const state = originalState(p);
    const out = cleanSuccess(p, saved);
    assert.deepEqual(out.left, retained.map((name) => `${relChange(chain)}/${name}`).sort());
    for (const [name, value] of bytes) assert.deepEqual(snapshot(path.join(p.changeDir, name)), value);
    assert.equal(fs.lstatSync(path.join(p.changeDir, "link")).isSymbolicLink(), true);
    assert.equal(fs.lstatSync(path.join(p.changeDir, "fifo")).isFIFO(), true);
    assert.equal(fs.readFileSync(path.join(p.root, "tracked.txt"), "utf8"), "original\n");
    assert.deepEqual(blob(p, meta, "eligible"), Buffer.from("eligible"));
    assert.deepEqual(originalState(p), state);
    assert.deepEqual(cleanSuccess(p, saved).left, out.left);
  });

  test(`${chain}: cleanup skips every valid resume, opt-out and in-flight result`, () => {
    const p = fixture(chain);
    const saved = success(p, "created");
    const source = snapshot(path.join(p.changeDir, "change.md"));
    cleanSuccess(p, success(p, "reused"));
    const current = { ...p, root: saved.runRoot };
    cleanSuccess(current, success(current, "in-run-worktree"));
    assert.deepEqual(snapshot(path.join(p.changeDir, "change.md")), source);
    const q = fixture(chain, null, true);
    git(q, ["branch", "agent-smith/demo"]);
    cleanSuccess(q, success(q, "attached"));
    const flight = fixture(chain);
    fs.mkdirSync(path.join(flight.changeDir, "agent-smith"));
    fs.writeFileSync(path.join(flight.changeDir, "agent-smith/meta.json"), "{}");
    cleanSuccess(flight, success(flight, "in-flight-main"));
    override(flight, { isolation: { require: false } });
    cleanSuccess(flight, success(flight, "opt-out"));
    assert.ok(fs.existsSync(path.join(flight.changeDir, "change.md")));
    const absent = fixture(chain, null, true);
    git(absent, ["branch", "agent-smith/demo"]);
    fs.renameSync(absent.changeDir, `${absent.changeDir}-saved`);
    const attached = success(absent, "attached");
    assert.ok(fs.existsSync(path.join(attached.runRoot, relChange(chain), "change.md")));
  });

  test(`${chain}: cleanup requires successful init and reachable isolated start-commit metadata`, () => {
    const p = fixture(chain);
    const saved = success(p, "created");
    const before = snapshot(path.join(p.changeDir, "change.md"));
    assert.ok(cleanup(p, saved).json.reason);
    assert.deepEqual(snapshot(path.join(p.changeDir, "change.md")), before);
    const { meta, file } = initialize(p, saved);
    const orphan = git(p, ["commit-tree", git(p, ["rev-parse", "HEAD^{tree}"]), "-m", "unreachable start"]);
    for (const patch of [{ startCommit: undefined }, { startCommit: null }, { startCommit: "HEAD" },
      { startCommit: "a".repeat(40) }, { startCommit: orphan }, { isolated: false },
      { branch: "agent-smith/other" }, { chain: chain === "10x" ? "openspec" : "10x" }, { outcome: { action: "halt" } }]) {
      fs.writeFileSync(file, JSON.stringify({ ...meta, ...patch }));
      const out = cleanup(p, saved);
      assert.equal(out.status, 0, out.stderr);
      assert.ok(out.json.reason, JSON.stringify(patch));
      assert.equal(out.json.runRoot, null);
      assert.deepEqual(out.json.left, [`${relChange(chain)}/change.md`]);
      assert.deepEqual(snapshot(path.join(p.changeDir, "change.md")), before);
    }
    fs.writeFileSync(file, JSON.stringify(meta));
    assert.deepEqual(cleanSuccess(p, saved).left, []);
  });

  test(`${chain}: cleanup rejects malformed input and wrong roots, prefix, branch and repository`, () => {
    const p = fixture(chain);
    const { saved } = initialize(p);
    const before = snapshot(path.join(p.changeDir, "change.md"));
    const w = wrapper(p);
    for (const input of ["{", "null", "[]", "{}", JSON.stringify({ ...saved, copied: "true" }), JSON.stringify({ ...saved, left: null })]) {
      const res = cleanup(p, saved, { input, env: w.env });
      assert.equal(res.status, 2, res.stderr);
      assert.equal(res.stdout, "");
    }
    assert.equal(fs.existsSync(w.log), false);
    const other = fixture(chain);
    const elsewhere = success(other, "created");
    for (const patch of [{ root: other.root }, { branch: "agent-smith/other" }, { worktree: p.root },
      { runRoot: path.join(saved.runRoot, "context") }, { worktree: elsewhere.worktree, runRoot: elsewhere.runRoot }]) {
      const res = cleanup(p, { ...saved, ...patch });
      assert.ok(res.json.reason, JSON.stringify(patch));
      assert.equal(res.json.runRoot, null);
      assert.deepEqual(snapshot(path.join(p.changeDir, "change.md")), before);
    }
    // The saved paths can still match after another repository replaces the registered checkout.
    fs.renameSync(saved.worktree, `${saved.worktree}-saved`);
    fs.mkdirSync(saved.worktree);
    git(p, ["-C", saved.worktree, "init", "-q"]);
    assert.ok(cleanup(p, saved).json.reason);
    assert.deepEqual(snapshot(path.join(p.changeDir, "change.md")), before);
  });

  test(`${chain}: cleanup preserves sources behind symlinked ancestors`, () => {
    const p = fixture(chain);
    const { saved } = initialize(p);
    const parent = path.dirname(p.changeDir);
    fs.renameSync(parent, `${parent}-saved`);
    fs.symlinkSync(`${parent}-saved`, parent);
    const file = path.join(`${parent}-saved`, "demo/change.md");
    const before = snapshot(file);
    const out = cleanup(p, saved);
    assert.ok(out.json.reason);
    assert.deepEqual(snapshot(file), before);
    assert.deepEqual(out.json.left, [relChange(chain)]);
  });

  test(`${chain}: cleanup rechecks edits made after candidate enumeration`, () => {
    const p = fixture(chain);
    const { saved } = initialize(p);
    const file = path.join(p.changeDir, "change.md");
    const w = wrapper(p, "edit", "hash-object", { after: 2, file, text: "concurrent source edit" });
    const out = cleanSuccess(p, saved, { env: w.env });
    assert.deepEqual(out.left, [`${relChange(chain)}/change.md`]);
    assert.equal(fs.readFileSync(file, "utf8"), "concurrent source edit");
    assert.deepEqual(cleanSuccess(p, saved).left, out.left);
  });

  test(`${chain}: cleanup failures report survivors and retain every deleted byte`, () => {
    for (const fault of ["read", "lookup", "unlink", "rmdir", "list", "lock"]) {
      const p = fixture(chain);
      for (const name of ["a", "b"]) fs.writeFileSync(path.join(p.changeDir, name), name);
      const { saved, meta } = initialize(p);
      let options = {};
      if (fault === "lookup") options.env = wrapper(p, "fail", "ls-tree").env;
      else if (fault === "lock") fs.writeFileSync(path.join(p.base, ".git/agent-smith-setup-agent-smith%2Fdemo.lock"), "keep lock");
      else {
        const method = { read: "openSync", unlink: "unlinkSync", rmdir: "rmdirSync", list: "readdirSync" }[fault];
        const target = ["rmdir", "list"].includes(fault) ? p.changeDir : path.join(p.changeDir, "b");
        const preload = path.join(p.base, "fault.mjs");
        fs.writeFileSync(preload, `import fs from "node:fs";
const original = fs.${method};
fs.${method} = function(file, ...args) {
  if (file === ${JSON.stringify(target)}) throw Object.assign(new Error("injected ${fault} failure"), {code: "EACCES"});
  return original.call(this, file, ...args);
};`);
        options.preload = preload;
      }
      const out = cleanup(p, saved, options);
      assert.equal(out.status, 0, out.stderr);
      assert.equal(out.json.runRoot, null);
      assert.match(out.json.reason, /injected|Setup lock exists/);
      if (fault === "rmdir") {
        assert.deepEqual(out.json.left, [relChange(chain)]);
      } else if (fault === "unlink") {
        assert.equal(fs.existsSync(path.join(p.changeDir, "a")), false);
        assert.deepEqual(out.json.left, ["b", "change.md"].map((name) => `${relChange(chain)}/${name}`));
      } else {
        assert.equal(fs.readFileSync(path.join(p.changeDir, "a"), "utf8"), "a");
        assert.equal(fs.readFileSync(path.join(p.changeDir, "b"), "utf8"), "b");
        assert.ok(out.json.left.length);
      }
      assert.deepEqual(blob(p, meta, "a"), Buffer.from("a"));
    }
  });

  test(`${chain}: absent fresh inputs create no resources and keep archive diagnostics`, () => {
    const p = fixture(chain);
    fs.renameSync(p.changeDir, `${p.changeDir}-saved`);
    const archive = `${chain === "openspec" ? "openspec/changes/archive" : "context/archive"}/2026-11-14-demo`;
    fs.mkdirSync(path.join(p.root, archive), { recursive: true });
    fs.writeFileSync(path.join(p.root, archive, "change.md"), "---\nstatus: archived\n---\n");
    const state = originalState(p);
    const exclude = snapshot(path.join(p.base, ".git/info/exclude"));
    const out = setup(p);
    assert.ok(out.reason);
    assert.equal(out.runRoot, null);
    assert.equal(out.worktree, null);
    assert.deepEqual(originalState(p), state);
    assert.deepEqual(snapshot(path.join(p.base, ".git/info/exclude")), exclude);
    assert.equal(fs.existsSync(path.join(p.root, ".claude")), false);
    assert.equal(run(p, ["verify-archive", "demo", "--chain", chain]).json.archived, true);
  });

  test(`${chain}: halted duplicate initialization preserves the original copy`, () => {
    const p = fixture(chain);
    const saved = success(p, "created");
    const archive = chain === "openspec" ? "openspec/changes/archive" : "context/archive";
    fs.mkdirSync(path.join(saved.runRoot, archive, "2026-11-14-demo"), { recursive: true });
    const before = snapshot(path.join(p.changeDir, "change.md"));
    const result = run({ ...p, root: saved.runRoot }, ["init", "demo", "--chain", chain, "--goal", GOAL], { env: gitEnv(p) });
    assert.equal(result.json.action, "halt");
    assert.match(result.json.reason, /live folder .* next to archive/);
    assert.ok(cleanup(p, saved).json.reason);
    assert.deepEqual(snapshot(path.join(p.changeDir, "change.md")), before);
    assert.equal(success(p, "reused").runRoot, saved.runRoot);
    assert.deepEqual(snapshot(path.join(p.changeDir, "change.md")), before);
  });
}

for (const archive of [false, true]) {
  test(`10x: cleanup follows immediate ${archive ? "archive" : "done"} initialization`, () => {
    const p = fixture();
    fs.writeFileSync(path.join(p.changeDir, "change.md"), "---\nchange_id: demo\nstatus: planned\ncreated: 2026-11-14\n---\n");
    fs.writeFileSync(path.join(p.changeDir, "plan.md"), planText({ done: 1 }));
    writeReview(p, "plan-review", { verdict: "SOUND" });
    writeReview(p, "impl-review", { verdict: "APPROVED" });
    const time = Date.now() / 1000;
    fs.utimesSync(path.join(p.changeDir, "reviews/plan-review.md"), time + 2, time + 2);
    fs.utimesSync(path.join(p.changeDir, "reviews/impl-review.md"), time + 4, time + 4);
    const { saved, res, meta } = initialize(p, undefined, archive ? ["--archive"] : []);
    assert.equal(res.json.action, archive ? "archive" : "done", res.stdout);
    assert.deepEqual(cleanSuccess(p, saved).left, []);
    assert.equal(fs.existsSync(p.changeDir), false);
    assert.ok(blob(p, meta, "plan.md").includes(Buffer.from("- [x]")));
  });
}
