// Real pre-init setup, both chains. Fixtures and all Git effects stay in scratch repositories.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cleanupAll, makeProject, run, git, gitEnv, gitInit, ROUTE } from "./helpers.mjs";

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
function wrapper(p, mode = "", match = "") {
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
const allowed = ["rev-parse", "symbolic-ref", "show-ref", "status", "check-ignore", "worktree"];
if (!allowed.includes(command) || (command === "worktree" && !["add", "list"].includes(args[1]))) process.exit(99);
const matched = args.join(" ").includes(${JSON.stringify(match)});
if (${JSON.stringify(mode)} === "fail" && matched) { process.stderr.write("injected Git failure"); process.exit(70); }
if (${JSON.stringify(mode)} === "timeout" && matched) {
  process.on("SIGTERM", () => { fs.writeFileSync(${JSON.stringify(signal)}, "terminated"); process.exit(0); });
  setTimeout(() => process.exit(71), 130000);
} else {
  const res = spawnSync(${JSON.stringify(REAL_GIT)}, args, { env: process.env, encoding: "utf8" });
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
  fs.renameSync(`${missing.changeDir}-saved`, missing.changeDir);
  const resumed = success(missing, "reused");
  assert.equal(fs.existsSync(path.join(resumed.runRoot, relChange("10x"), "change.md")), false);
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
