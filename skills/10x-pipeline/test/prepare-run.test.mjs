// Real pre-init setup, both chains. Fixtures and all Git effects stay in scratch repositories.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { cleanupAll, makeProject, run, git, gitEnv, ROUTE, planText, writeReview } from "./helpers.mjs";
import { PREPARE_RUN, PROJECT_POLICY, REAL_GIT, relChange, fixture, fixtureRemote, setup, wrapper, commitProjectFiles,
  projectTools, launchSetup } from "./prepare-run-helpers.mjs";

after(cleanupAll);
const SCRIPTS = path.dirname(PREPARE_RUN);
const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";

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

// Refusal inside another change's run worktree: names both ids, no runRoot, nothing written.
function assertOtherChange(p, args, started, owner) {
  const before = originalState(p);
  const out = setup(p, { args });
  assert.equal(out.runRoot, null, JSON.stringify(out));
  assert.match(out.reason, new RegExp(`belongs to change ${owner}, not to change ${started}`));
  assert.deepEqual(originalState(p), before);
}

function override(p, value) {
  fs.writeFileSync(path.join(p.root, "context/foundation/agent-smith-policy.json"), JSON.stringify(value));
}

function snapshot(file) {
  const stat = fs.lstatSync(file);
  return { mtime: stat.mtimeMs, mode: stat.mode, bytes: fs.readFileSync(file, "utf8") };
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
    assertOtherChange(current, ["other", "--chain", chain], "other", "demo");
    for (const [branch, id] of [["agent-smith/demo-extra", "demo"], ["agent-smith/demo", "demo-extra"]]) {
      const w = linked(fixture(chain), branch, "other run");
      assertOtherChange(w, [id, "--chain", chain], id, branch.slice("agent-smith/".length));
    }
    const base = linked(fixture(chain), "agent-smith/demo-baseline", "baseline run");
    assert.equal(success(base, "in-run-worktree").branch, "agent-smith/demo-baseline");
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
  fs.writeFileSync(base, JSON.stringify({ isolation: { require: false, branchPrefix: "base/" } }));
  fs.writeFileSync(fragment, JSON.stringify({ isolation: { require: true, branchPrefix: "fragment/" } }));
  override(p, { isolation: {} });
  assert.equal(effectiveIsolation(p, path.dirname(script)), true);
  assert.equal(success(p, "created", { script }).branch, "fragment/demo");
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
    assert.equal(fs.readdirSync(path.join(p.base, ".git")).some((name) => /\.(lock|pending)$/.test(name)), false);
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
});

function setupRecord(p, suffix = "pending") {
  return path.join(p.base, ".git", `agent-smith-setup-agent-smith%2Fdemo.${suffix}`);
}

const dependencyManifest = { dependencies: { fixture: "1.0.0" } };
const dependencyIgnore = "node_modules/\n.pnp.cjs\n.yarn/install-state.gz\n";
const installed = 'fs.mkdirSync("node_modules", { recursive: true }); fs.writeFileSync("node_modules/ready", "installed");';
const hookPolicy = (readiness) => ({ isolation: { require: true }, readiness });

function assertGateRetry(p, out) {
  assert.equal(out.runRoot, null);
  assert.ok(out.reason.includes(p.root), out.reason);
  assert.match(out.reason, /Retry setup from the original project root/);
  assert.equal(fs.existsSync(setupRecord(p, "lock")), false);
  assert.equal(JSON.parse(fs.readFileSync(setupRecord(p), "utf8")).copyComplete, true);
  assert.equal(fs.existsSync(path.join(p.changeDir, "change.md")), true);
}

for (const [chain, lockfile, manager, declared, detected, args] of [
  ["10x", "package-lock.json", "npm", "npm@10.2.0", null, ["ci"]],
  ["openspec", "npm-shrinkwrap.json", "npm", null, null, ["ci"]],
  ["10x", "pnpm-lock.yaml", "pnpm", "pnpm@9.0.0", null, ["install", "--frozen-lockfile"]],
  ["openspec", "yarn.lock", "yarn", null, "1.22.22", ["install", "--frozen-lockfile"]],
  ["10x", "yarn.lock", "yarn", "yarn@4.3.1+sha224.abc", null, ["install", "--immutable"]],
  ["openspec", "bun.lock", "bun", "bun@1.2.0", null, ["install", "--frozen-lockfile"]],
  ["10x", "bun.lockb", "bun", null, null, ["install", "--frozen-lockfile"]],
]) {
  test(`${chain}: fresh setup runs the locked ${manager} command for ${declared ?? detected ?? lockfile} before readiness`, () => {
    const p = fixture(chain);
    const pnp = args[1] === "--immutable";
    const install = pnp
      ? 'fs.writeFileSync(".pnp.cjs", "ready"); fs.mkdirSync(".yarn"); fs.writeFileSync(".yarn/install-state.gz", "ready");'
      : installed;
    const tools = projectTools(p, {
      [manager]: `if (args.includes("--version")) { console.log(${JSON.stringify(detected)}); }
else { ${install} console.log("package stdout"); console.error("package stderr"); }`,
      "verify-ready": `if (!fs.existsSync(${JSON.stringify(pnp ? ".pnp.cjs" : "node_modules/ready")})) process.exit(25);
console.log("hook stdout"); console.error("hook stderr");`,
    });
    commitProjectFiles(p, {
      "package.json": { ...dependencyManifest, ...(declared ? { packageManager: declared } : {}) },
      [lockfile]: "fixture lock",
      [PROJECT_POLICY]: hookPolicy("verify-ready"),
      ".gitignore": dependencyIgnore,
    });
    // A different working-tree hook must not become the committed run command.
    override(p, hookPolicy("not-the-committed-hook"));
    const out = success(p, "created", { env: tools.env });
    assert.equal(out.runRoot, out.worktree);
    assert.equal(out.copied, true);
    assert.deepEqual(tools.calls(), [
      ...(detected ? [{ name: manager, args: ["--version"], cwd: out.runRoot, stdin: "" }] : []),
      { name: manager, args, cwd: out.runRoot, stdin: "" },
      { name: "verify-ready", args: [], cwd: out.runRoot, stdin: "" },
    ]);
    assert.equal(fs.existsSync(path.join(p.root, "node_modules")), false);
    assert.equal(fs.existsSync(setupRecord(p)), false);
    success(p, "reused", { env: tools.env });
    assert.equal(tools.calls().length, detected ? 3 : 2, "prepared runs do not repeat the gates");
  });
}

test("nested projects install at the nearest locked package root but run readiness in the selected root", () => {
  for (const ownLock of [false, true]) {
    const p = fixture("openspec", "apps/[widget]");
    const tools = projectTools(p, {
      npm: installed + ' fs.symlinkSync("../apps/[widget]", "node_modules/widget", "dir");',
      pnpm: installed,
      "verify-ready": `if (!fs.existsSync(${JSON.stringify(ownLock ? "node_modules/ready" : "../../node_modules/ready")})) process.exit(25);`,
    });
    commitProjectFiles({ ...p, root: p.base }, {
      "package.json": { ...dependencyManifest, workspaces: ["apps/*"] },
      "package-lock.json": "parent lock",
      ".gitignore": dependencyIgnore,
    });
    commitProjectFiles(p, {
      "package.json": dependencyManifest,
      ...(ownLock ? { "pnpm-lock.yaml": "local lock" } : {}),
      [PROJECT_POLICY]: hookPolicy("verify-ready"),
    });
    const out = success(p, "created", { env: tools.env });
    assert.deepEqual(tools.calls(), [
      { name: ownLock ? "pnpm" : "npm", args: ownLock ? ["install", "--frozen-lockfile"] : ["ci"],
        cwd: ownLock ? out.runRoot : out.worktree, stdin: "" },
      { name: "verify-ready", args: [], cwd: out.runRoot, stdin: "" },
    ]);
    assert.equal(fs.existsSync(path.join(p.base, "node_modules")), false);
  }
});

test("dependency-free and non-JS projects skip installation and still run committed readiness", () => {
  for (const manifest of [null, { name: "empty", dependencies: {} }]) {
    const p = fixture("10x", "apps/project");
    commitProjectFiles({ ...p, root: p.base }, {
      "package.json": dependencyManifest, ...(manifest ? {} : { "package-lock.json": "parent lock" }),
    });
    commitProjectFiles(p, { [PROJECT_POLICY]: hookPolicy("verify-ready"), ...(manifest ? { "package.json": manifest } : {}) });
    const tools = projectTools(p, { "verify-ready": "" });
    const out = success(p, "created", { env: tools.env });
    assert.deepEqual(tools.calls(), [{ name: "verify-ready", args: [], cwd: out.runRoot, stdin: "" }]);
  }
});

test("setup retries lockfile and manager failures without repeating the copy", () => {
  const p = fixture();
  commitProjectFiles(p, { "package.json": dependencyManifest, ".gitignore": dependencyIgnore });
  const tools = projectTools(p, {});
  const noLock = setup(p, { env: tools.env });
  assertGateRetry(p, noLock);
  assert.match(noLock.reason, /No supported lockfile.*package\.json.*package-lock\.json/);
  assert.equal(noLock.copied, true);
  const { worktree } = noLock;
  const edit = path.join(worktree, relChange(p.chain), "change.md");
  fs.writeFileSync(edit, "retained run edit");
  fs.writeFileSync(path.join(p.changeDir, "change.md"), "original checkout edit");
  fs.writeFileSync(path.join(worktree, "package-lock.json"), "locked");
  fs.writeFileSync(path.join(worktree, "yarn.lock"), "conflicting lock");
  const conflict = setup(p, { env: tools.env });
  assertGateRetry(p, conflict);
  assert.match(conflict.reason, /Conflicting package lockfiles.*package-lock\.json.*yarn\.lock/);
  fs.unlinkSync(path.join(worktree, "yarn.lock"));
  const manifest = path.join(worktree, "package.json");
  fs.writeFileSync(manifest, JSON.stringify({ ...dependencyManifest, packageManager: "yarn@1.0.0" }));
  const wrongManager = setup(p, { env: tools.env });
  assertGateRetry(p, wrongManager);
  assert.match(wrongManager.reason, /npm ci.*Set packageManager.*package\.json.*npm@/);
  assert.deepEqual(tools.calls(), []);
  fs.writeFileSync(manifest, JSON.stringify(dependencyManifest));
  const missing = setup(p, { env: tools.env });
  assertGateRetry(p, missing);
  assert.match(missing.reason, /npm ci.*executable not found on PATH/);
  tools.writeTool("npm", 'console.log("credential in stdout"); console.error("credential in stderr"); process.exit(17);');
  const failedInstall = setup(p, { env: tools.env });
  assertGateRetry(p, failedInstall);
  assert.match(failedInstall.reason, /npm ci.*exited with status 17/);
  assert.doesNotMatch(failedInstall.reason, /credential/);
  tools.writeTool("npm", installed);
  const retried = success(p, "reused", { env: tools.env });
  assert.equal(retried.runRoot, worktree);
  assert.equal(retried.copied, false);
  assert.equal(fs.readFileSync(edit, "utf8"), "retained run edit");
  assert.equal(fs.readFileSync(path.join(p.changeDir, "change.md"), "utf8"), "original checkout edit");
  assert.equal(fs.existsSync(setupRecord(p)), false);
  assert.deepEqual(cleanSuccess(p, retried).left, []);
  assert.equal(fs.readFileSync(path.join(p.changeDir, "change.md"), "utf8"), "original checkout edit");
});

test("setup checks dependency links both after install and before retry, then requires ignored artifacts", () => {
  const p = fixture("openspec");
  const originalDependencies = path.join(p.root, "node_modules");
  fs.mkdirSync(originalDependencies);
  fs.writeFileSync(path.join(originalDependencies, "keep"), "original dependencies");
  commitProjectFiles(p, {
    "package.json": dependencyManifest, "package-lock.json": "locked", [PROJECT_POLICY]: hookPolicy("verify-ready"),
  });
  const tools = projectTools(p, {
    npm: `fs.symlinkSync(${JSON.stringify(originalDependencies)}, "node_modules", "dir");`,
    "verify-ready": "",
  });
  const postInstall = setup(p, { env: tools.env });
  assertGateRetry(p, postInstall);
  assert.match(postInstall.reason, /npm ci.*external dependency link.*node_modules/);
  assert.equal(tools.calls().length, 1);
  const preInstall = setup(p, { env: tools.env });
  assertGateRetry(p, preInstall);
  assert.match(preInstall.reason, /npm ci.*external dependency link.*node_modules/);
  assert.equal(tools.calls().length, 1, "the dependency safety check precedes the installer");
  const link = path.join(postInstall.worktree, "node_modules");
  fs.unlinkSync(link);
  fs.symlinkSync("absent", link, "dir");
  const dangling = setup(p, { env: tools.env });
  assertGateRetry(p, dangling);
  assert.match(dangling.reason, /npm ci.*dangling dependency link.*node_modules/);
  assert.equal(tools.calls().length, 1);
  fs.unlinkSync(link);
  tools.writeTool("npm", installed);
  const unignored = setup(p, { env: tools.env });
  assertGateRetry(p, unignored);
  assert.match(unignored.reason, /node_modules[/\\]ready.*ignore rules/);
  assert.equal(tools.calls().length, 2);
  fs.writeFileSync(path.join(postInstall.worktree, ".gitignore"), dependencyIgnore);
  const retried = success(p, "reused", { env: tools.env });
  assert.equal(retried.copied, false);
  assert.deepEqual(tools.calls().map(({ name }) => name), ["npm", "npm", "npm", "verify-ready"]);
  assert.equal(fs.readFileSync(path.join(originalDependencies, "keep"), "utf8"), "original dependencies");
});

test("setup protects tracked content behind an internal dependency root link", () => {
  const p = fixture();
  commitProjectFiles(p, { "package.json": dependencyManifest, "package-lock.json": "locked",
    "dependencies/keep": "tracked content", ".gitignore": dependencyIgnore, [PROJECT_POLICY]: hookPolicy("verify-ready") });
  const tools = projectTools(p, {});
  const failure = setup(p, { env: tools.env });
  assertGateRetry(p, failure);
  const dependencyLink = path.join(failure.worktree, "node_modules");
  fs.symlinkSync("dependencies", dependencyLink, "dir");
  tools.writeTool("npm", installed);
  const protectedLayout = setup(p, { env: tools.env });
  assertGateRetry(p, protectedLayout);
  assert.match(protectedLayout.reason, /npm ci.*tracked dependency content.*dependencies[/\\]keep/);
  assert.deepEqual(tools.calls(), []);
  assert.equal(fs.readFileSync(path.join(failure.worktree, "dependencies/keep"), "utf8"), "tracked content");
  fs.unlinkSync(dependencyLink);
  tools.writeTool("verify-ready", "");
  success(p, "reused", { env: tools.env });
});

test("setup validates manifest and lockfile links before invoking a package manager", () => {
  const p = fixture();
  commitProjectFiles(p, { "package-lock.json": "locked", "outside.json": dependencyManifest });
  const originalManifest = path.join(p.root, "outside.json");
  fs.symlinkSync(originalManifest, path.join(p.root, "package.json"));
  git(p, ["add", "--", "package.json"]);
  git(p, ["commit", "-qm", "fixture manifest link"]);
  const tools = projectTools(p, { npm: "" });
  const manifestFailure = setup(p, { env: tools.env });
  assertGateRetry(p, manifestFailure);
  assert.match(manifestFailure.reason, /regular package manifest.*package\.json/);
  const root = manifestFailure.worktree;
  fs.unlinkSync(path.join(root, "package.json"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(dependencyManifest));
  const lock = path.join(root, "package-lock.json");
  fs.unlinkSync(lock);
  fs.symlinkSync(path.join(p.root, "package-lock.json"), lock);
  const lockFailure = setup(p, { env: tools.env });
  assertGateRetry(p, lockFailure);
  assert.match(lockFailure.reason, /npm ci.*regular lockfile.*package-lock\.json/);
  assert.deepEqual(tools.calls(), []);
  fs.unlinkSync(lock);
  fs.writeFileSync(lock, "locked");
  success(p, "reused", { env: tools.env });
});

test("readiness must be valid and comes from the retained worktree's committed policy on retry", () => {
  const p = fixture();
  commitProjectFiles(p, {
    "package.json": dependencyManifest, "package-lock.json": "locked",
    [PROJECT_POLICY]: hookPolicy(" "), ".gitignore": dependencyIgnore,
  });
  const tools = projectTools(p, {
    npm: installed,
    "bad-ready": 'console.log("credential in stdout"); console.error("credential in stderr"); process.exit(26);',
    "good-ready": 'if (!fs.existsSync("node_modules/ready")) process.exit(27);',
  });
  const invalid = setup(p, { env: tools.env });
  assertGateRetry(p, invalid);
  assert.match(invalid.reason, /Set readiness to a non-blank command.*HEAD:context\/foundation/);
  assert.deepEqual(tools.calls(), []);
  const run = { ...p, root: invalid.worktree };
  override(run, hookPolicy("good-ready"));
  assert.match(setup(p, { env: tools.env }).reason, /Set readiness to a non-blank command/);
  assert.deepEqual(tools.calls(), []);
  commitProjectFiles(run, { [PROJECT_POLICY]: hookPolicy("bad-ready") });
  const failedHook = setup(p, { env: tools.env });
  assertGateRetry(p, failedHook);
  assert.match(failedHook.reason, /Readiness command "bad-ready".*exited with status 26/);
  assert.doesNotMatch(failedHook.reason, /credential/);
  const retryEdit = path.join(run.root, relChange(p.chain), "change.md");
  fs.writeFileSync(retryEdit, "preserve between gate retries");
  commitProjectFiles(run, { [PROJECT_POLICY]: hookPolicy("good-ready") });
  const out = success(p, "reused", { env: tools.env });
  assert.equal(out.copied, false);
  assert.equal(out.runRoot, run.root);
  assert.equal(fs.readFileSync(retryEdit, "utf8"), "preserve between gate retries");
  assert.deepEqual(tools.calls().map(({ name }) => name), ["npm", "bad-ready", "npm", "good-ready"]);
});

test("setup rejects a committed readiness policy link before manager execution", () => {
  const p = fixture();
  commitProjectFiles(p, { "package.json": dependencyManifest, "package-lock.json": "locked",
    "outside-policy.json": hookPolicy("verify-ready") });
  const policy = path.join(p.root, PROJECT_POLICY);
  fs.unlinkSync(policy);
  fs.symlinkSync(path.join(p.root, "outside-policy.json"), policy);
  git(p, ["add", "--", PROJECT_POLICY]);
  git(p, ["commit", "-qm", "fixture policy link"]);
  const tools = projectTools(p, { npm: "", "verify-ready": "" });
  const failed = setup(p, { env: tools.env });
  assertGateRetry(p, failed);
  assert.match(failed.reason, /regular committed policy file.*HEAD:/);
  assert.deepEqual(tools.calls(), []);
  fs.unlinkSync(path.join(failed.worktree, PROJECT_POLICY));
  commitProjectFiles({ ...p, root: failed.worktree }, { [PROJECT_POLICY]: hookPolicy("verify-ready") });
  success(p, "reused", { env: tools.env });
});

test("copy-complete recovery refuses a pinned start outside worktree HEAD ancestry", () => {
  const p = fixture();
  commitProjectFiles(p, { [PROJECT_POLICY]: hookPolicy("verify-ready") });
  const tools = projectTools(p, { "verify-ready": "process.exit(1);" });
  assertGateRetry(p, setup(p, { env: tools.env }));
  const pendingFile = setupRecord(p);
  const pending = JSON.parse(fs.readFileSync(pendingFile, "utf8"));
  const original = pending.startCommit;
  pending.startCommit = git(p, ["commit-tree", "HEAD^{tree}", "-m", "disjoint fixture start"]);
  assert.notEqual(pending.startCommit, original);
  fs.writeFileSync(pendingFile, JSON.stringify(pending));
  const refused = setup(p, { env: tools.env });
  assert.match(refused.reason, /expected.*ancestor of HEAD.*preserve worktree edits/);
  assert.equal(refused.runRoot, null);
  assert.equal(tools.calls().length, 1);
  pending.startCommit = original;
  fs.writeFileSync(pendingFile, JSON.stringify(pending));
  tools.writeTool("verify-ready", "");
  success(p, "reused", { env: tools.env });
});

function freshnessState(p) {
  return {
    ...originalState(p),
    registrations: git(p, ["worktree", "list", "--porcelain"]),
    exclude: fs.readFileSync(path.join(p.base, ".git/info/exclude")),
    fetchHead: fs.readFileSync(path.join(p.base, ".git/FETCH_HEAD")),
    setupFiles: fs.readdirSync(path.join(p.base, ".git")).filter((name) => name.startsWith("agent-smith-setup-")),
    targetExists: fs.existsSync(path.join(p.root, ".claude/worktrees/agent-smith-demo")),
  };
}

test("fresh setup rejects a stale or divergent start without mutating the checkout", () => {
  for (const diverged of [false, true]) {
    const p = fixture(diverged ? "openspec" : "10x");
    const remote = fixtureRemote(p);
    const start = git(p, ["rev-parse", "HEAD"]);
    git(p, ["update-ref", "refs/remotes/origin/main", start]);
    git(p, ["update-ref", "refs/remotes/origin/release", start]);
    git(p, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
    git(p, ["config", "remote.origin.prune", "true"]);
    remote.advance("first upstream commit");
    const tip = remote.advance("second upstream commit");
    if (diverged) {
      git(p, ["commit", "--allow-empty", "-qm", "local-only commit"]);
      fs.writeFileSync(path.join(p.root, "tracked.txt"), "staged source edit\n");
      git(p, ["add", "tracked.txt"]);
      fs.writeFileSync(path.join(p.root, "tracked.txt"), "working source edit\n");
    }
    const fetchHead = path.join(p.base, ".git/FETCH_HEAD");
    fs.writeFileSync(fetchHead, "preserve existing FETCH_HEAD\n");
    const before = freshnessState(p);

    const out = setup(p);
    assert.deepEqual(out.base, { remote: "origin", branch: "release", behind: 2 });
    assert.match(out.reason, /2 commits behind origin\/release.*Update the original checkout and rerun/);
    assert.equal(out.worktree, null);
    assert.equal(out.excludeAdded, false);
    assert.equal(out.copied, false);
    assert.deepEqual(freshnessState(p), before);
    assert.equal(git(p, ["cat-file", "-t", tip]), "commit");
    if (!diverged) {
      git(p, ["merge", "--ff-only", tip]);
      const retried = success(p, "created");
      assert.deepEqual(retried.base, { remote: "origin", branch: "release", behind: 0 });
      assert.equal(git(p, ["-C", retried.runRoot, "rev-parse", "HEAD"]), tip);
    }
  }
});

test("fresh setup chooses origin or the sole remote and keeps equal and ahead starts pinned", () => {
  for (const [remoteName, ahead] of [["origin", false], ["upstream", true]]) {
    const p = fixture();
    const remote = fixtureRemote(p, remoteName);
    const integrationTip = git(p, ["rev-parse", "HEAD"]);
    if (ahead) git(p, ["commit", "--allow-empty", "-qm", "local-only commit"]);
    else git(p, ["remote", "add", "extra", `${remote.dir}-unreachable`]);
    const expected = git(p, ["rev-parse", "HEAD"]);
    const w = wrapper(p);
    const out = success(p, "created", { env: w.env });
    assert.deepEqual(out.base, { remote: remoteName, branch: "release", behind: 0 });
    assert.equal(git(p, ["-C", out.runRoot, "rev-parse", "HEAD"]), expected);
    const calls = fs.readFileSync(w.log, "utf8").trim().split("\n").map(JSON.parse);
    assert.deepEqual(calls.find(([cmd]) => cmd === "ls-remote"), ["ls-remote", "--symref", "--", remoteName, "HEAD"]);
    const fetch = calls.find(([cmd]) => cmd === "fetch");
    for (const arg of ["--no-tags", "--no-recurse-submodules", "--refmap=", "--no-write-fetch-head"]) assert.ok(fetch.includes(arg), arg);
    assert.deepEqual(fetch.slice(-3), ["--", remoteName, integrationTip]);
    assert.deepEqual(calls.find(([cmd]) => cmd === "rev-list"), ["rev-list", "--left-right", "--count", `${expected}...${integrationTip}`]);
  }
});

test("integrationBranch selects an exact named remote ref and validates active overrides", () => {
  const p = fixture();
  const remote = fixtureRemote(p);
  remote.git(["branch", "team/integration", "HEAD"]);
  remote.advance("named integration change", "team/integration");
  const w = wrapper(p);
  override(p, { isolation: { integrationBranch: "team/integration" } });
  const lagging = setup(p, { env: w.env });
  assert.deepEqual(lagging.base, { remote: "origin", branch: "team/integration", behind: 1 });
  assert.match(lagging.reason, /1 commit behind origin\/team\/integration/);
  const calls = fs.readFileSync(w.log, "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(calls.find(([cmd]) => cmd === "ls-remote"), ["ls-remote", "--refs", "--", "origin", "refs/heads/team/integration"]);

  override(p, { isolation: { integrationBranch: "missing" } });
  assert.match(setup(p).reason, /Remote origin did not advertise a valid commit for integration branch missing/);
  for (const integrationBranch of ["", "  ", 7, ["main"], "release/*", "a..b"]) {
    override(p, { isolation: { integrationBranch } });
    assert.match(setup(p).reason, /isolation\.integrationBranch/);
  }
  assert.equal(fs.existsSync(setupRecord(p)), false);
  override(p, { isolation: { require: false, integrationBranch: 7 } });
  assert.equal(success(p, "opt-out").base, undefined);
});

test("freshness discovery and transport failures keep the original checkout retryable", () => {
  const p = fixture();
  const remote = fixtureRemote(p);
  const fetchHead = path.join(p.base, ".git/FETCH_HEAD");
  fs.writeFileSync(fetchHead, "preserve existing FETCH_HEAD\n");
  for (const [stage, reason] of [["ls-remote", /Read integration branch HEAD from origin/],
    ["fetch", /Fetch integration branch release from origin/], ["rev-list", /Compare original HEAD with origin\/release/]]) {
    const before = freshnessState(p);
    const out = setup(p, { env: wrapper(p, "fail", stage).env });
    assert.match(out.reason, reason);
    assert.match(out.reason, /Git exited 70/);
    assert.doesNotMatch(out.reason, /injected Git failure/);
    assert.equal(out.base, undefined);
    assert.deepEqual(freshnessState(p), before);
  }
  remote.git(["symbolic-ref", "HEAD", "refs/heads/unborn"]);
  assert.match(setup(p).reason, /Remote origin did not advertise a default branch/);
  remote.git(["symbolic-ref", "HEAD", "refs/heads/release"]);
  git(p, ["remote", "set-url", "origin", `${remote.dir}-unreachable`]);
  assert.match(setup(p).reason, /Read integration branch HEAD from origin: Git exited/);
  git(p, ["remote", "set-url", "origin", remote.dir]);
  git(p, ["remote", "rename", "origin", "upstream"]);
  git(p, ["remote", "add", "other", remote.dir]);
  assert.match(setup(p).reason, /several remotes.*none is origin/);
  git(p, ["remote", "rename", "upstream", "origin"]);
  success(p, "created");
});

test("fresh setup refuses shallow history without creating a run", () => {
  const p = fixture();
  fixtureRemote(p);
  git(p, ["fetch", "--depth=1", "origin", "refs/heads/release"]);
  const before = freshnessState(p);
  assert.match(setup(p).reason, /shallow repository.*Unshallow the original checkout/);
  assert.deepEqual(freshnessState(p), before);
});

test("freshness runs only before a new registration, including an unregistered pending retry", () => {
  const local = fixture();
  assert.deepEqual(success(local, "created").base, { skipped: "no-remote" });

  const p = fixture();
  const remote = fixtureRemote(p);
  const file = setupRecord(p);
  const startCommit = git(p, ["rev-parse", "HEAD"]);
  const worktree = path.join(p.root, ".claude/worktrees/agent-smith-demo");
  const pending = JSON.stringify({ root: p.root, worktree, prefix: "", chain: p.chain, startCommit });
  fs.writeFileSync(file, pending);
  const tip = remote.advance("new upstream commit");
  assert.equal(setup(p).base.behind, 1);
  assert.equal(fs.readFileSync(file, "utf8"), pending);
  git(p, ["merge", "--ff-only", tip]);
  const saved = success(p, "created");
  assert.equal(saved.base.behind, 0);
  initialize(p, saved);
  assert.equal(fs.existsSync(file), false);
  remote.advance("a later upstream commit");
  const w = wrapper(p, "fail", "ls-remote");
  assert.equal(success(p, "reused", { env: w.env }).base, undefined);
  assert.equal(success({ ...p, root: saved.runRoot }, "in-run-worktree", { env: w.env }).base, undefined);
  assert.deepEqual(cleanSuccess(p, saved, { env: w.env }).base, saved.base);
  override(p, { isolation: { require: false } });
  assert.equal(success(p, "opt-out", { env: w.env }).base, undefined);
  assert.ok(!fs.readFileSync(w.log, "utf8").trim().split("\n").map(JSON.parse)
    .some(([cmd]) => ["remote", "ls-remote", "fetch"].includes(cmd)));

  const retry = fixture("10x", null, true);
  const retryRemote = fixtureRemote(retry);
  const conflict = copyConflict(retry);
  retryRemote.advance("after registration");
  conflict.fix();
  const recovered = success(retry, "reused", { env: wrapper(retry, "fail", "ls-remote").env });
  assert.equal(recovered.runRoot, conflict.out.worktree);
  assert.equal(recovered.base, undefined);
});

function copyConflict(p) {
  const source = path.join(p.changeDir, "change.md");
  const bytes = fs.readFileSync(source);
  fs.unlinkSync(source);
  fs.mkdirSync(source);
  const out = setup(p);
  assert.equal(out.case, "created");
  assert.equal(out.copied, false);
  assert.match(out.reason, /Copy source and destination types differ/);
  return {
    out,
    fix() {
      fs.rmdirSync(source);
      fs.writeFileSync(source, bytes);
    },
  };
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: failed setup retries the complete copy and initialized reuse preserves both inputs`, () => {
    const p = fixture(chain, "apps/widget", true);
    const inputs = ["change.md", ".inputs/notes.md"];
    fs.mkdirSync(path.join(p.changeDir, ".inputs"));
    fs.writeFileSync(path.join(p.changeDir, inputs[1]), "additional source input");
    const failure = copyConflict(p);
    const pending = setupRecord(p);
    const intent = fs.readFileSync(pending, "utf8");
    const top = failure.out.worktree;
    const runRoot = path.join(top, "apps/widget");
    const destination = path.join(runRoot, relChange(chain), "change.md");
    const before = snapshot(destination);
    assert.deepEqual(JSON.parse(intent), {
      root: p.root, worktree: top, prefix: "apps/widget/", chain, startCommit: git(p, ["rev-parse", "HEAD"]),
    });
    assert.equal(fs.existsSync(setupRecord(p, "lock")), false);

    const stillBroken = setup(p);
    assert.match(stillBroken.reason, /Copy source and destination types differ/);
    assert.equal(stillBroken.copied, false);
    for (const caller of [{ ...p, root: runRoot }, { ...p, root: p.base }, { ...p, chain: chain === "10x" ? "openspec" : "10x" }]) {
      const refused = setup(caller);
      assert.match(refused.reason, /original project root/);
      assert.ok(refused.reason.includes(p.root), refused.reason);
      assert.equal(refused.copied, false);
    }
    assert.deepEqual(snapshot(destination), before);
    assert.equal(fs.readFileSync(pending, "utf8"), intent);

    failure.fix();
    const refs = git(p, ["show-ref"]);
    const registered = git(p, ["worktree", "list", "--porcelain"]);
    const recovered = success(p, "reused");
    assert.equal(recovered.branch, failure.out.branch);
    assert.equal(recovered.runRoot, runRoot);
    assert.equal(recovered.worktree, top);
    assert.equal(recovered.copied, true);
    assert.equal(fs.existsSync(pending), false);
    assert.equal(git(p, ["show-ref"]), refs);
    assert.equal(git(p, ["worktree", "list", "--porcelain"]), registered);
    assert.equal(success(p, "reused").copied, false);
    for (const file of inputs) {
      assert.deepEqual(fs.readFileSync(path.join(runRoot, relChange(chain), file)), fs.readFileSync(path.join(p.changeDir, file)));
    }

    const { res, file } = initialize(p, recovered);
    assert.equal(res.json.action, "run", res.stdout);
    const initialized = snapshot(file);
    fs.writeFileSync(destination, "newer worktree content");
    // A router identity takes precedence if an interrupted setup still has a pending record.
    fs.writeFileSync(pending, intent);
    assert.equal(success(p, "reused").copied, false);
    assert.equal(fs.existsSync(pending), false);
    assert.equal(success(p, "reused").copied, false);
    assert.deepEqual(snapshot(file), initialized);
    assert.equal(fs.readFileSync(destination, "utf8"), "newer worktree content");
    cleanSuccess(p, recovered);
    for (const item of inputs) assert.ok(fs.existsSync(path.join(p.changeDir, item)), item);
  });
}

test("unavailable registered worktrees cannot select a replacement repository", () => {
  const p = fixture("10x", null, true);
  const wt = linked(p);
  fs.renameSync(wt.top, `${wt.top}-moved`);
  const unavailable = setup(p);
  assert.ok(unavailable.reason.includes(wt.top), unavailable.reason);
  assert.match(unavailable.reason, /git worktree prune --dry-run/);
  fs.mkdirSync(wt.top);
  git(p, ["-C", wt.top, "init", "-q"]);
  assert.match(setup(p).reason, /no longer belongs/);
});

test("pending setup refuses to copy into a same-branch replacement repository", () => {
  const p = fixture("10x", null, true);
  const failure = copyConflict(p);
  failure.fix();
  const top = failure.out.worktree;
  fs.renameSync(top, `${top}-moved`);
  assert.match(setup(p).reason, /git worktree prune --dry-run/);
  fs.mkdirSync(top);
  git(p, ["-C", top, "init", "-q"]);
  git(p, ["-C", top, "symbolic-ref", "HEAD", "refs/heads/agent-smith/demo"]);
  const keep = path.join(top, "keep.txt");
  fs.writeFileSync(keep, "replacement worktree contents");
  assert.match(setup(p).reason, /no longer belongs/);
  assert.equal(fs.readFileSync(keep, "utf8"), "replacement worktree contents");
  assert.equal(fs.existsSync(path.join(top, relChange(p.chain))), false);
  assert.ok(fs.existsSync(setupRecord(p)));
});

test("pending setup refuses source changes, ambiguous router state and a changed worktree commit", () => {
  const p = fixture("10x", null, true);
  const failure = copyConflict(p);
  failure.fix();
  const destination = path.join(failure.out.worktree, relChange(p.chain));
  const keep = path.join(destination, "change.md");
  fs.writeFileSync(keep, "preserve destination");
  const before = snapshot(keep);
  const pending = setupRecord(p);
  const intent = fs.readFileSync(pending, "utf8");
  fs.renameSync(p.changeDir, `${p.changeDir}-saved`);
  assert.match(setup(p).reason, /Change folder is missing/);
  fs.renameSync(`${p.changeDir}-saved`, p.changeDir);
  const sourceState = path.join(p.changeDir, "agent-smith");
  fs.mkdirSync(sourceState);
  fs.symlinkSync("missing-log", path.join(sourceState, "run.jsonl"));
  assert.match(setup(p).reason, /source now contains router state/);
  fs.unlinkSync(path.join(sourceState, "run.jsonl"));

  const state = path.join(destination, "agent-smith");
  fs.mkdirSync(state);
  const meta = path.join(state, "meta.json");
  const log = path.join(state, "run.jsonl");
  fs.writeFileSync(meta, "{}");
  assert.match(setup(p).reason, /router state without a saved run identity/);
  assert.equal(fs.readFileSync(meta, "utf8"), "{}");
  fs.writeFileSync(meta, "{");
  assert.match(setup(p).reason, /Cannot read saved run identity/);
  assert.equal(fs.readFileSync(meta, "utf8"), "{");
  fs.unlinkSync(meta);
  fs.symlinkSync("missing-meta", meta);
  assert.match(setup(p).reason, /ambiguous router state/);
  assert.equal(fs.readlinkSync(meta), "missing-meta");
  fs.unlinkSync(meta);
  fs.writeFileSync(log, "existing log");
  assert.match(setup(p).reason, /ambiguous router state/);
  assert.equal(fs.readFileSync(log, "utf8"), "existing log");
  fs.unlinkSync(log);
  git(p, ["-C", failure.out.worktree, "commit", "--allow-empty", "-qm", "advanced worktree"]);
  assert.match(setup(p).reason, /expected commit.*found/);
  assert.deepEqual(snapshot(keep), before);
  assert.equal(fs.readFileSync(pending, "utf8"), intent);
});

test("pending setup without registration requires a fresh branch and readable intent", () => {
  for (const topology of ["fresh", "unregistered", "other registration"]) {
    const p = fixture();
    const worktree = path.join(p.root, ".claude/worktrees/agent-smith-demo");
    const file = setupRecord(p);
    fs.writeFileSync(file, "{");
    assert.match(setup(p).reason, /Cannot read pending setup.*Inspect/);
    assert.equal(fs.readFileSync(file, "utf8"), "{");
    const record = JSON.stringify({ root: p.root, worktree, prefix: "", chain: p.chain, startCommit: git(p, ["rev-parse", "HEAD"]) });
    fs.writeFileSync(file, record);
    if (topology === "unregistered") {
      git(p, ["branch", "agent-smith/demo"]);
      assert.match(setup(p).reason, /no registered worktree.*Inspect git worktree list/);
      assert.equal(fs.existsSync(worktree), false);
      assert.equal(fs.readFileSync(file, "utf8"), record);
    } else if (topology === "other registration") {
      git(p, ["worktree", "add", "-qb", "other-branch", worktree]);
      assert.match(setup(p).reason, /registered to another branch or detached/);
      assert.equal(fs.readFileSync(file, "utf8"), record);
    } else {
      assert.equal(success(p, "created").copied, true);
      assert.equal(fs.existsSync(file), false);
    }
  }
});

test("an incomplete worktree with a committed opt-out points back to the original project", () => {
  const p = fixture("10x", null, true);
  override(p, { isolation: { require: false } });
  git(p, ["add", "context/foundation/agent-smith-policy.json"]);
  git(p, ["commit", "-qm", "opt-out policy"]);
  override(p, { isolation: { require: true } });
  const failure = copyConflict(p);
  const out = setup({ ...p, root: failure.out.worktree });
  assert.match(out.reason, /original project root/);
  assert.ok(out.reason.includes(p.root), out.reason);
  assert.ok(fs.existsSync(setupRecord(p)));
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
    const first = launchSetup(p, w.env);
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

test("interruption after registration can recover a previously untracked nested prefix", async () => {
  const p = fixture();
  const root = path.join(p.base, "untracked/project");
  const changeDir = path.join(root, relChange(p.chain));
  fs.mkdirSync(changeDir, { recursive: true });
  fs.writeFileSync(path.join(changeDir, "change.md"), "untracked project inputs");
  const caller = { ...p, root, changeDir };
  const w = wrapper(p, "pause");
  const first = launchSetup(caller, w.env);
  const stopped = first.done.then(() => false, () => true);
  try {
    await waitFor(w.signal);
    const top = path.join(root, ".claude/worktrees/agent-smith-demo");
    const runRoot = path.join(top, "untracked/project");
    assert.equal(fs.existsSync(runRoot), false);
    assert.equal(JSON.parse(fs.readFileSync(setupRecord(p), "utf8")).worktree, top);
    assert.ok(first.child.kill("SIGKILL"));
    fs.writeFileSync(w.release, "continue");
    assert.equal(await stopped, true);
    const lock = setupRecord(p, "lock");
    assert.equal(fs.readFileSync(lock, "utf8"), `${first.child.pid}\n`);
    assert.match(setup(caller).reason, /Setup lock exists.*inspect/);
    fs.unlinkSync(lock);
    assert.match(setup({ ...p, root: top }).reason, /original project root/);

    const recovered = success(caller, "reused");
    assert.equal(recovered.runRoot, runRoot);
    assert.equal(recovered.copied, true);
    assert.equal(fs.readFileSync(path.join(runRoot, relChange(p.chain), "change.md"), "utf8"), "untracked project inputs");
    assert.equal(fs.existsSync(setupRecord(p)), false);
  } finally {
    fs.writeFileSync(w.release, "continue");
    await stopped;
  }
});

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

function configurePrefix(p, prefix = "codex/", extras = {}) {
  const file = path.join(p.root, "context/foundation/agent-smith-policy.json");
  const policy = JSON.parse(fs.readFileSync(file));
  policy.isolation = { ...policy.isolation, branchPrefix: prefix, ...extras };
  fs.writeFileSync(file, JSON.stringify(policy));
  git(p, ["add", "--", path.relative(p.base, file)]);
  git(p, ["commit", "-qm", "configured run prefix"]);
}

function savedIdentity(p, branch, patch = {}) {
  const dir = path.join(p.root, relChange(p.chain), "agent-smith");
  fs.mkdirSync(dir, { recursive: true });
  const meta = { id: "demo", isolated: true, branch, ...(p.chain === "openspec" ? { chain: "openspec" } : {}), ...patch };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta));
  return path.join(dir, "meta.json");
}

for (const chain of ["10x", "openspec"]) {
  for (const nest of [null, "apps/widget"]) {
    test(`${chain}: configured prefix lifecycle initializes, cleans and resumes (${nest})`, () => {
      const p = fixture(chain, nest);
      configurePrefix(p);
      const { saved, meta, res, file } = initialize(p);
      assert.equal(saved.branch, "codex/demo");
      assert.equal(res.json.action, "run", res.stdout);
      assert.equal(meta.branch, "codex/demo");
      assert.equal(meta.chain ?? "10x", chain);
      const before = snapshot(file);
      const input = fs.readFileSync(path.join(p.changeDir, "change.md"));
      assert.deepEqual(cleanSuccess(p, saved).left, []);
      assert.deepEqual(cleanSuccess(p, saved).left, []);
      assert.deepEqual(blob(p, meta, "change.md"), input);
      assert.equal(fs.existsSync(p.changeDir), false);
      assert.equal(success(p, "reused").runRoot, saved.runRoot);
      assert.equal(success({ ...p, root: saved.runRoot }, "in-run-worktree").branch, "codex/demo");
      assert.deepEqual(snapshot(file), before);
      assert.equal(spawnSync(REAL_GIT, ["show-ref", "--verify", "--quiet", "refs/heads/agent-smith/demo"], { cwd: p.base, env: gitEnv(p) }).status, 1);
    });
  }

  test(`${chain}: configured attachment, custom registration, literal prefix and branch lock`, () => {
    const p = fixture(chain, "apps/widget", true);
    configurePrefix(p, "runs-");
    git(p, ["branch", "runs-demo"]);
    const attached = success(p, "attached");
    assert.equal(attached.branch, "runs-demo");
    assert.equal(success(p, "reused").runRoot, attached.runRoot);
    assertOtherChange({ ...p, root: attached.runRoot }, ["other", "--chain", chain], "other", "demo");
    const q = fixture(chain, "apps/widget", true);
    configurePrefix(q);
    const wt = linked(q, "codex/demo");
    assert.equal(success(q, "reused").runRoot, wt.root);
    const r = fixture(chain);
    configurePrefix(r);
    const lock = path.join(r.base, ".git/agent-smith-setup-codex%2Fdemo.lock");
    fs.writeFileSync(lock, "other setup");
    assert.match(setup(r).reason, /Setup lock exists/);
    assert.equal(fs.readFileSync(lock, "utf8"), "other setup");
    assert.equal(spawnSync(REAL_GIT, ["show-ref", "--verify", "--quiet", "refs/heads/codex/demo"], { cwd: r.base, env: gitEnv(r) }).status, 1);
  });

  test(`${chain}: saved policy conflicts preserve source, run, index and refs before cleanup or replacement`, () => {
    for (const prefix of ["agent-smith/", "codex/"]) {
      const p = fixture(chain);
      configurePrefix(p, prefix);
      const { saved, file } = initialize(p);
      const source = snapshot(path.join(p.changeDir, "change.md"));
      const metadata = snapshot(file);
      override(p, { isolation: { require: true, branchPrefix: "changed/" } });
      const state = originalState(p);
      assert.match(setup(p).reason, /isolation.branchPrefix.*recorded branch/);
      assert.match(cleanup(p, saved).json.reason, /Cleanup roots|branch|prefix/);
      assert.deepEqual(originalState(p), state);
      assert.deepEqual(snapshot(file), metadata);
      assert.deepEqual(snapshot(path.join(p.changeDir, "change.md")), source);
      // The same lookup must work when the original input folder has already gone.
      fs.renameSync(p.changeDir, `${p.changeDir}-saved`);
      assert.match(setup(p).reason, /isolation.branchPrefix.*recorded branch/);
      assert.deepEqual(originalState(p), state);
    }
  });

  test(`${chain}: source-absent custom registered saved runs retain identity through prefix drift`, () => {
    const p = fixture(chain, "apps/widget", true);
    configurePrefix(p);
    const wt = linked(p, "codex/demo", "independent location");
    const file = savedIdentity(wt, "codex/demo");
    fs.renameSync(p.changeDir, `${p.changeDir}-saved`);
    assert.equal(success(p, "reused").runRoot, wt.root);
    const before = snapshot(file);
    override(p, { isolation: { require: true, branchPrefix: "new/" } });
    const state = originalState(p);
    assert.match(setup(p).reason, /codex\/demo.*isolation.branchPrefix|isolation.branchPrefix.*codex\/demo/);
    assert.deepEqual(snapshot(file), before);
    assert.deepEqual(originalState(p), state);
  });

  test(`${chain}: exact configured registration wins and ambiguous baseline fallback refuses in either registration order`, () => {
    const p = fixture(chain, "apps/widget", true);
    configurePrefix(p);
    const baseline = linked(p, "codex/demo-baseline", "baseline");
    savedIdentity(baseline, "codex/demo-baseline");
    const legacy = linked(p, "agent-smith/demo-baseline", "legacy");
    savedIdentity(legacy, "agent-smith/demo-baseline");
    const exact = linked(p, "codex/demo", "selected");
    const exactFile = savedIdentity(exact, "codex/demo");
    fs.renameSync(p.changeDir, `${p.changeDir}-saved`);
    const before = snapshot(exactFile);
    assert.equal(success(p, "reused").runRoot, exact.root);
    assert.equal(success(p, "reused", { env: wrapper(p, "reverse").env }).runRoot, exact.root);
    assert.deepEqual(snapshot(exactFile), before);
    const q = fixture(chain, "apps/widget", true);
    configurePrefix(q);
    for (const [branch, name] of [["codex/demo-a", "first"], ["codex/demo-b", "second"]]) {
      savedIdentity(linked(q, branch, name), branch);
    }
    fs.renameSync(q.changeDir, `${q.changeDir}-saved`);
    const state = originalState(q);
    for (const env of [{}, wrapper(q, "reverse").env]) {
      const out = setup(q, { env });
      assert.match(out.reason, /Ambiguous saved runs/);
      assert.match(out.reason, /codex\/demo-a/);
      assert.match(out.reason, /codex\/demo-b/);
      assert.deepEqual(originalState(q), state);
    }
  });

  test(`${chain}: fallback selection separates nested projects and chain identities`, () => {
    const p = fixture(chain, "apps/widget", true);
    configurePrefix(p);
    const selected = linked(p, "codex/demo-saved", "selected fallback");
    savedIdentity(selected, "codex/demo-saved");
    const other = linked(p, "codex/demo-other", "other chain");
    savedIdentity(other, "codex/demo-other", { chain: chain === "10x" ? "openspec" : "10x" });
    const nested = linked(p, "codex/demo-nested", "other project");
    const elsewhere = { ...nested, root: path.join(nested.top, "another/project") };
    savedIdentity(elsewhere, "codex/demo-nested");
    fs.renameSync(p.changeDir, `${p.changeDir}-saved`);
    assert.equal(success(p, "reused").runRoot, selected.root);
    assert.equal(success(p, "reused", { env: wrapper(p, "reverse").env }).runRoot, selected.root);
  });

  test(`${chain}: invocation and selected saved identity tampering refuses without mutation`, () => {
    const p = fixture(chain, null, true);
    configurePrefix(p);
    const selected = linked(p, "codex/demo");
    for (const patch of [{ id: "wrong" }, { chain: chain === "10x" ? "openspec" : "10x" },
      { branch: "codex/another" }, { isolated: false }, { branch: null }]) {
      const file = savedIdentity(selected, "codex/demo", patch);
      const before = snapshot(file);
      const state = originalState(p);
      assert.ok(setup(p).reason, JSON.stringify(patch));
      assert.deepEqual(originalState(p), state);
      assert.deepEqual(snapshot(file), before);
    }
    for (const partial of [{ id: "demo" }, { chain }, { branch: "codex/demo" }, { isolated: true }]) {
      const file = path.join(selected.root, relChange(chain), "agent-smith/meta.json");
      fs.writeFileSync(file, JSON.stringify(partial));
      const before = snapshot(file);
      assert.ok(setup(p).reason, JSON.stringify(partial));
      assert.deepEqual(snapshot(file), before);
    }
    savedIdentity(selected, "codex/demo");
    const source = savedIdentity(p, "agent-smith/demo");
    const before = snapshot(source);
    assert.match(setup(p).reason, /isolation.branchPrefix/);
    assert.deepEqual(snapshot(source), before);
  });
}

test("active prefixes reject invalid values and default collisions before mutation; opt-out bypasses prefix validation", () => {
  for (const prefix of ["", " ", null, 7, {}, [], "-option/", "bad..ref/", "bad ref/", "refs@{/", "/absolute/"]) {
    const p = fixture();
    configurePrefix(p, prefix);
    const state = originalState(p);
    const exclude = snapshot(path.join(p.base, ".git/info/exclude"));
    assert.match(setup(p).reason, /branchPrefix|Invalid run branch/);
    assert.deepEqual(originalState(p), state);
    assert.deepEqual(snapshot(path.join(p.base, ".git/info/exclude")), exclude);
    override(p, { isolation: { require: false, branchPrefix: prefix } });
    success(p, "opt-out");
  }
  for (const remote of [false, true]) {
    const p = fixture();
    configurePrefix(p, "codex/", remote ? {} : { defaultBranches: ["codex/demo"] });
    if (remote) {
      git(p, ["update-ref", "refs/remotes/origin/codex/demo", "HEAD"]);
      git(p, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/codex/demo"]);
    }
    const state = originalState(p);
    assert.match(setup(p).reason, /default branch/);
    assert.deepEqual(originalState(p), state);
  }
});

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: a real nonisolated main run retains the in-flight setup case after isolation is enabled`, () => {
    const p = fixture(chain);
    override(p, { isolation: { require: false }, score: { minRigor: null } });
    const started = run(p, ["init", "demo", "--goal", GOAL, "--chain", chain], { env: gitEnv(p) });
    assert.equal(started.json?.action, "run", started.stdout + started.stderr);
    const metaFile = path.join(p.changeDir, "agent-smith/meta.json");
    const logFile = path.join(p.changeDir, "agent-smith/run.jsonl");
    const meta = JSON.parse(fs.readFileSync(metaFile));
    assert.equal(meta.id, "demo");
    assert.equal(meta.chain ?? "10x", chain);
    assert.equal(Object.hasOwn(meta, "isolated"), false);
    assert.equal(Object.hasOwn(meta, "branch"), false);
    const beforeMeta = snapshot(metaFile);
    const beforeLog = snapshot(logFile);
    override(p, { isolation: { require: true, branchPrefix: "codex/" }, score: { minRigor: null } });
    const state = originalState(p);
    const out = success(p, "in-flight-main");
    assert.equal(out.runRoot, p.root);
    assert.equal(out.branch, null);
    assert.equal(out.worktree, null);
    assert.deepEqual(originalState(p), state);
    assert.deepEqual(snapshot(metaFile), beforeMeta);
    assert.deepEqual(snapshot(logFile), beforeLog);
    assert.equal(fs.existsSync(path.join(p.root, ".claude")), false);
  });
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: invalid saved-prefix drift names the preserved branch through setup, init and cleanup`, () => {
    const p = fixture(chain, "apps/widget");
    configurePrefix(p);
    const { saved, file } = initialize(p);
    const current = { ...p, root: saved.runRoot };
    const source = snapshot(path.join(p.changeDir, "change.md"));
    const metadata = snapshot(file);
    const runInput = snapshot(path.join(saved.runRoot, relChange(chain), "change.md"));
    const log = snapshot(path.join(saved.runRoot, relChange(chain), "agent-smith/run.jsonl"));
    const indexFile = git(p, ["-C", saved.runRoot, "rev-parse", "--path-format=absolute", "--git-path", "index"]);
    const index = fs.readFileSync(indexFile);
    for (const prefix of [null, "", "bad..ref/"]) {
      override(p, { isolation: { require: true, branchPrefix: prefix } });
      override(current, { isolation: { require: true, branchPrefix: prefix } });
      const state = originalState(p);
      const resumed = run(current, ["init", "demo", "--chain", chain], { env: gitEnv(p) });
      assert.equal(resumed.json?.action, "halt", resumed.stdout);
      for (const reason of [setup(current).reason, setup(p).reason, cleanup(p, saved).json?.reason, resumed.json.reason]) {
        assert.match(reason, /codex\/demo/);
        assert.match(reason, /isolation\.branchPrefix/);
        assert.match(reason, /restore/i);
        assert.match(reason, /resume.*worktree/i);
      }
      assert.deepEqual(originalState(p), state);
      assert.deepEqual(fs.readFileSync(indexFile), index);
      assert.deepEqual(snapshot(file), metadata);
      assert.deepEqual(snapshot(path.join(p.changeDir, "change.md")), source);
      assert.deepEqual(snapshot(path.join(saved.runRoot, relChange(chain), "change.md")), runInput);
      assert.deepEqual(snapshot(path.join(saved.runRoot, relChange(chain), "agent-smith/run.jsonl")), log);
    }
  });

  test(`${chain}: invalid saved-prefix drift discovers a source-absent custom registration without mutation`, () => {
    const p = fixture(chain, "apps/widget", true);
    configurePrefix(p);
    const wt = linked(p, "codex/demo", "preserved custom registration");
    const file = savedIdentity(wt, "codex/demo");
    fs.renameSync(p.changeDir, `${p.changeDir}-saved`);
    const metadata = snapshot(file);
    const input = snapshot(path.join(wt.root, relChange(chain), "change.md"));
    const registration = git(p, ["worktree", "list", "--porcelain", "-z"]);
    for (const prefix of [null, "", "bad..ref/"]) {
      override(p, { isolation: { require: true, branchPrefix: prefix } });
      const state = originalState(p);
      for (const env of [{}, wrapper(p, "reverse").env]) {
        const out = setup(p, { env });
        assert.equal(out.runRoot, null);
        assert.match(out.reason, /codex\/demo/);
        assert.match(out.reason, /isolation\.branchPrefix/);
        assert.match(out.reason, /restore/i);
        assert.match(out.reason, /resume.*worktree/i);
        assert.ok(out.reason.includes(wt.top), out.reason);
      }
      assert.deepEqual(originalState(p), state);
      assert.equal(git(p, ["worktree", "list", "--porcelain", "-z"]), registration);
      assert.deepEqual(snapshot(file), metadata);
      assert.deepEqual(snapshot(path.join(wt.root, relChange(chain), "change.md")), input);
    }
  });
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: cleanup rejects symlinked run roots before reading foreign identity`, () => {
    for (const replacement of ["worktree", "project"]) {
      const p = fixture(chain, "apps/widget");
      configurePrefix(p);
      const { saved, file } = initialize(p);
      const metadata = snapshot(file);
      const source = snapshot(path.join(p.changeDir, "change.md"));
      const replaced = replacement === "worktree" ? saved.worktree : saved.runRoot;
      fs.renameSync(replaced, `${replaced}-saved`);
      const foreign = path.join(p.base, "foreign root");
      const foreignRoot = replacement === "worktree" ? path.join(foreign, "apps/widget") : foreign;
      const foreignMeta = path.join(foreignRoot, relChange(chain), "agent-smith/meta.json");
      fs.mkdirSync(path.dirname(foreignMeta), { recursive: true });
      fs.writeFileSync(foreignMeta, JSON.stringify({ id: "other", isolated: true, branch: "codex/foreign-identity-marker" }));
      fs.symlinkSync(foreign, replaced);
      const foreignBefore = snapshot(foreignMeta);
      const state = originalState(p);
      const out = cleanup(p, saved);
      assert.match(out.json?.reason, /run root is not canonical/);
      assert.doesNotMatch(out.json.reason, /foreign-identity-marker/);
      assert.deepEqual(snapshot(foreignMeta), foreignBefore);
      assert.deepEqual(snapshot(path.join(`${replaced}-saved`, path.relative(replaced, file))), metadata);
      assert.deepEqual(snapshot(path.join(p.changeDir, "change.md")), source);
      assert.deepEqual(originalState(p), state);
    }
  });
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: a safe saved suffix resumes when the canonical run name is a configured or remote default`, () => {
    for (const remote of [false, true]) {
      const p = fixture(chain, "apps/widget", true);
      configurePrefix(p, "codex/", remote ? {} : { defaultBranches: ["codex/demo"] });
      if (remote) {
        git(p, ["update-ref", "refs/remotes/origin/codex/demo", "HEAD"]);
        git(p, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/codex/demo"]);
      }
      const wt = linked(p, "codex/demo-baseline", "safe suffix");
      const file = savedIdentity(wt, "codex/demo-baseline");
      const metadata = snapshot(file);
      const input = snapshot(path.join(wt.root, relChange(chain), "change.md"));
      const indexFile = git(p, ["-C", wt.root, "rev-parse", "--path-format=absolute", "--git-path", "index"]);
      const index = fs.readFileSync(indexFile);
      let state = originalState(p);
      assert.equal(success(wt, "in-run-worktree").branch, "codex/demo-baseline");
      assert.deepEqual(originalState(p), state);
      fs.renameSync(p.changeDir, `${p.changeDir}-saved`);
      state = originalState(p);
      const resumed = success(p, "reused");
      assert.equal(resumed.branch, "codex/demo-baseline");
      assert.equal(resumed.runRoot, wt.root);
      assert.deepEqual(originalState(p), state);
      assert.deepEqual(snapshot(file), metadata);
      assert.deepEqual(snapshot(path.join(wt.root, relChange(chain), "change.md")), input);
      assert.deepEqual(fs.readFileSync(indexFile), index);
      assert.equal(spawnSync(REAL_GIT, ["show-ref", "--verify", "--quiet", "refs/heads/codex/demo"], { cwd: p.base, env: gitEnv(p) }).status, 1);
      // Protect the selected saved branch itself, including when the canonical name is also a default.
      override(p, { isolation: { require: true, branchPrefix: "codex/", defaultBranches: ["codex/demo", "codex/demo-baseline"] } });
      state = originalState(p);
      assert.match(setup(p).reason, /codex\/demo-baseline is a default branch/);
      assert.deepEqual(originalState(p), state);
      assert.deepEqual(snapshot(file), metadata);
    }
  });
}
