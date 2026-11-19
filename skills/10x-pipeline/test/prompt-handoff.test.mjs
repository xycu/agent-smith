// Real router dispatch and recoverable file lifecycle; providers are fake, never live agents.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { removeTree } from "../scripts/remove-tree.mjs";
import {
  cleanupAll, makeProject, init, next, run, writeOverride, writeResult, readLogEntries,
  readMetaFile, planText, gitInit, git, gitEnv, seedRun, writeLog, entry,
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";
import { makeOpenspecProject, initOpenspec, writeArtifacts } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { codexFixture, execute, calls } from "./codex-helpers.mjs";
import { buildPlan } from "./phase-helpers.mjs";
import { pluginPolicy, policyProblems } from "../scripts/state.mjs";
import { checkPrompts } from "../scripts/flow.mjs";

after(cleanupAll);
const ON = { prompts: { byFile: true } };
const FAULT = { status: "orchestrator-error", note: "dispatch unavailable" };
const taskPath = p => path.join(p.agentDir, "prompt.md");
const pending = p => readLogEntries(p).filter(e => !e.skipped).at(-1);
const preset = JSON.parse(fs.readFileSync(new URL("../codex-policy.json", import.meta.url)));
const bytes = value => Buffer.byteLength(value);
const measure = (p, action, label) => ({
  label, chain: action.chain, provider: action.provider, step: action.step,
  rootBytes: bytes(action.root), idBytes: bytes(action.change),
  actionBytes: bytes(JSON.stringify(action, null, 2) + "\n"),
  wrapperBytes: bytes(action.prompt), taskBytes: bytes(pending(p).pendingPrompt),
  neutralRetry: action.neutralRetry ?? null,
});

function canonical(p, action) {
  assert.equal(action.action, "run");
  const e = pending(p);
  assert.equal(action.promptFile, path.relative(p.root, taskPath(p)));
  assert.deepEqual(e.pendingHandoff, { promptFile: action.promptFile, prompt: action.prompt });
  assert.equal(fs.readFileSync(taskPath(p), "utf8"), e.pendingPrompt);
  assert.equal(action.prompt.split("\n").at(-1), e.pendingPrompt.split("\n").at(-1));
  assert.ok(action.prompt.includes(JSON.stringify(taskPath(p))));
  assert.match(action.prompt, /entire task file/);
  return e;
}

test("strict opt-in defaults off and malformed values halt before writes", () => {
  assert.equal(pluginPolicy().prompts.byFile, false);
  const legacy = pluginPolicy();
  delete legacy.prompts.byFile;
  assert.equal(policyProblems(legacy), null);
  checkPrompts(legacy);
  for (const value of [null, "true", 1, [], {}]) {
    const p = makeProject({ policy: { prompts: { byFile: value } } });
    const result = init(p, "fix typo");
    assert.match(result.json.reason, /prompts.byFile must be a boolean/);
    assert.equal(fs.existsSync(p.agentDir), false);
  }
  for (const value of [false, undefined]) {
    const p = makeProject({ policy: { prompts: value === undefined ? {} : { byFile: value } } });
    const action = init(p, "fix typo").json;
    assert.equal(action.prompt, pending(p).pendingPrompt);
    assert.equal(action.promptFile, undefined);
    assert.equal(pending(p).pendingHandoff, undefined);
    assert.equal(fs.existsSync(taskPath(p)), false);
  }
  for (const value of [false, 1, null, {}]) {
    const policy = pluginPolicy();
    policy.prompts.plan = value;
    assert.throws(() => checkPrompts(policy), /policy.prompts.plan/);
  }
});

for (const chain of ["10x", "openspec"]) {
  test(chain + ": exact task, replay across policy changes, replacement and provenance", () => {
    const p = chain === "10x" ? makeProject({ policy: ON, nest: "sp ace 'ż" }) : makeOpenspecProject({ policy: ON });
    const start = chain === "10x" ? init : initOpenspec;
    const action = start(p, 'fix "żółć" \n RESULT: not a contract').json;
    const before = canonical(p, action);
    assert.equal(action.agent, "agent-smith:step");
    assert.equal(before.agent, action.agent);
    const provenance = readMetaFile(p).provenance;
    assert.equal(next(p).json.action, "halt");
    assert.equal(fs.readFileSync(taskPath(p), "utf8"), before.pendingPrompt);
    fs.writeFileSync(taskPath(p), "edited");
    writeOverride(p, { prompts: { byFile: false } });
    writeResult(p, FAULT);
    const retry = next(p).json;
    canonical(p, retry);
    assert.deepEqual({ ...retry, neutralRetry: undefined }, { ...action, neutralRetry: undefined });
    const after = pending(p);
    assert.deepEqual({ ...after, neutralRetries: undefined }, { ...before, neutralRetries: undefined });
    if (chain === "10x") writePlan(p, planText());
    else writeArtifacts(p, { proposal: true, specs: 1, tasks: { open: 1 } });
    writeResult(p, { status: "done", usage: { totalTokens: 77 } });
    const second = next(p).json;
    assert.equal(second.action, "run");
    assert.equal(second.promptFile, undefined);
    assert.equal(fs.existsSync(taskPath(p)), false);
    assert.equal(readLogEntries(p).find(e => e.n === 1).usage.totalTokens, 77);
    assert.equal(readLogEntries(p).find(e => e.n === 1).pendingHandoff, undefined);
    assert.deepEqual(readMetaFile(p).provenance, provenance);
  });
}

test("legacy pending dispatch stays inline when enabling byFile", () => {
  const p = makeProject();
  const first = init(p, "fix typo").json;
  writeOverride(p, ON);
  writeResult(p, FAULT);
  const retry = next(p).json;
  assert.equal(retry.prompt, first.prompt);
  assert.equal(retry.promptFile, undefined);
  assert.equal(fs.existsSync(taskPath(p)), false);
});

test("restricted score and advisor tasks retain full rendered instructions", () => {
  for (const policy of [
    { ...ON, score: { minRigor: "standard" }, agents: { restricted: true } },
    { ...ON, advisor: { enabled: true } },
  ]) {
    const p = makeProject({ policy });
    const action = init(p, "fix typo", ["--rigor", "standard"]).json;
    const e = canonical(p, action);
    if (e.step === "score") {
      assert.equal(action.agent, "agent-smith:score");
      assert.match(fs.readFileSync(new URL("../../../agents/score.md", import.meta.url), "utf8"), /Read/);
    } else assert.equal(e.advisor, true);
  }
});

test("collision, file and parent redirects preserve unrelated content", () => {
  for (const kind of ["file", "symlink", "directory", "parent"]) {
    const p = makeProject({ policy: ON });
    fs.mkdirSync(p.agentDir);
    const other = path.join(p.root, "other");
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, "prompt.md"), "untouched");
    fs.writeFileSync(path.join(other, "prompt.md.12345.tmp"), "unrelated redirected temp");
    if (kind === "file") fs.writeFileSync(taskPath(p), "untouched");
    if (kind === "symlink") fs.symlinkSync(path.join(other, "prompt.md"), taskPath(p));
    if (kind === "directory") fs.mkdirSync(taskPath(p));
    if (kind === "parent") {
      fs.rmdirSync(p.agentDir);
      fs.symlinkSync(other, p.agentDir);
    }
    assert.equal(init(p, "fix typo").json.action, "halt", kind);
    assert.equal(fs.readFileSync(path.join(other, "prompt.md"), "utf8"), "untouched");
    assert.equal(fs.readFileSync(path.join(other, "prompt.md.12345.tmp"), "utf8"), "unrelated redirected temp");
    if (kind === "file") assert.equal(fs.readFileSync(taskPath(p), "utf8"), "untouched");
  }
});

test("neutral cap removes task and raised cap restores original handoff", () => {
  const p = makeProject({ policy: ON });
  const first = init(p, "fix typo").json;
  for (let i = 0; i < 3; i++) { writeResult(p, FAULT); next(p); }
  assert.equal(fs.existsSync(taskPath(p)), false);
  assert.equal(readMetaFile(p).outcome.action, "halt");
  writeOverride(p, { prompts: { byFile: false }, limits: { maxNeutralRetries: 3 } });
  writeResult(p, FAULT);
  const retry = next(p).json;
  canonical(p, retry);
  assert.equal(retry.prompt, first.prompt);
});

// Inject errors at actual filesystem boundaries in the child CLI, without changing production APIs.
function injected(p, source, args = ["next", p.id]) {
  const hook = path.join(p.root, "fault.mjs");
  fs.writeFileSync(hook, 'import fs from "node:fs";\n' + source);
  return run(p, args, { env: { NODE_OPTIONS: "--import=" + hook } });
}

test("publication and log failures never return unusable dispatch; neutral retry recovers", () => {
  for (const target of ["prompt.md", "run.jsonl"]) {
    const p = makeProject({ policy: ON });
    const result = injected(p, `
const rename = fs.renameSync;
fs.renameSync = (from, to) => {
  if (String(to).endsWith("/${target}")) throw new Error("injected publication failure");
  return rename(from, to);
};`, ["init", p.id, "--goal", "fix typo"]);
    assert.equal(result.json.action, "halt");
    assert.equal(fs.existsSync(taskPath(p)), false);
    if (target === "prompt.md") {
      assert.ok(pending(p).pendingHandoff);
      writeResult(p, FAULT);
      canonical(p, next(p).json);
    } else canonical(p, init(p, "fix typo").json);
  }
});

test("durable result and cleanup marker survive delete and post-delete log failures", () => {
  for (const failure of ["delete", "log", "intake"]) {
    const p = makeProject({ policy: ON });
    init(p, "fix typo");
    writePlan(p, planText());
    writeResult(p, { status: "done" });
    const script = failure === "delete" ? `
const unlink = fs.unlinkSync;
fs.unlinkSync = file => {
  if (String(file).endsWith("/prompt.md")) throw new Error("injected delete failure");
  return unlink(file);
};` : `
const rename = fs.renameSync;
let logs = 0;
fs.renameSync = (from, to) => {
  if (String(to).endsWith("/run.jsonl") && ++logs === ${failure === "log" ? 2 : 1}) throw new Error("injected log failure");
  return rename(from, to);
};`;
    const result = injected(p, script);
    assert.equal(result.json.action, "halt");
    assert.ok(pending(p).pendingHandoff);
    if (failure !== "intake") {
      assert.equal(pending(p).result.status, "done");
      assert.equal(fs.existsSync(path.join(p.agentDir, "last-result.json")), false);
    }
    else assert.equal(fs.existsSync(path.join(p.agentDir, "last-result.json")), true);
    const recovered = next(p).json;
    canonical(p, recovered);
    assert.equal(recovered.step, "plan-review");
    assert.equal(readLogEntries(p).find(e => e.n === 1).pendingHandoff, undefined);
  }
});

for (const chain of ["10x", "openspec"]) {
  test(chain + ": Codex accepts exact compact prompt and rejects forged dispatch/files", () => {
    const w = codexFixture(chain, { policy: { ...preset, ...ON } });
    canonical(w.project, w.action);
    for (const change of [
      { prompt: w.action.prompt + "extra" }, { promptFile: "../other.md" }, { n: 99 },
      { chain: chain === "10x" ? "openspec" : "10x" }, { root: w.tmp },
    ]) {
      assert.equal(execute(w, { ...w.action, ...change }).json.launched, false);
    }
    const file = taskPath(w.project);
    const text = fs.readFileSync(file);
    fs.writeFileSync(file, "modified");
    assert.equal(execute(w).json.launched, false);
    fs.unlinkSync(file);
    assert.equal(execute(w).json.launched, false);
    const other = path.join(w.project.root, "other.md");
    fs.writeFileSync(other, text);
    fs.symlinkSync(other, file);
    assert.equal(execute(w).json.launched, false);
    fs.unlinkSync(file);
    fs.writeFileSync(file, text);
    assert.equal(calls(w.fixture).length, 0);
    const result = execute(w).json;
    assert.equal(result.completed, true, result.reason);
    assert.equal(result.result.usage.totalTokens, 110);
    assert.equal(calls(w.fixture).at(-1).input, w.action.prompt);
    assert.equal(pending(w.project).result, undefined);
  });
}

test("isolated success and rollback commits exclude consumed prompt and exact owned temps", () => {
  for (const failed of [false, true]) {
    const main = makeProject({ policy: { ...ON, isolation: { require: true } } });
    gitInit(main);
    git(main, ["add", "--", "context"]);
    git(main, ["commit", "-qm", "test: project"]);
    const root = path.join(main.base, ".claude/worktrees/agent-smith-demo");
    git(main, ["worktree", "add", "-qb", "agent-smith/demo", root]);
    const changeDir = path.join(root, "context/changes/demo");
    const p = { ...main, root, changeDir, agentDir: path.join(changeDir, "agent-smith"), planFile: path.join(changeDir, "plan.md") };
    const cli = args => run(p, args, { env: gitEnv(p) });
    canonical(p, cli(["init", p.id, "--goal", "fix typo"]).json);
    writePlan(p, planText());
    fs.writeFileSync(path.join(p.agentDir, "prompt.md.12345.tmp"), "owned");
    fs.writeFileSync(path.join(p.agentDir, "prompt.md.user.tmp"), "unrelated");
    writeResult(p, { status: failed ? "failed" : "done" });
    const second = cli(["next", p.id]).json;
    canonical(p, second);
    const first = readLogEntries(p).find(e => e.n === 1);
    const ref = failed ? first.rolledBack : first.commit;
    assert.ok(ref);
    const files = git(main, ["-C", root, "ls-tree", "-r", "--name-only", ref]);
    assert.doesNotMatch(files, /agent-smith\/prompt\.md(?:\n|$|\.12345\.tmp)/);
    assert.match(files, /prompt\.md\.user\.tmp/);
  }
});

test("terminal completion and pre-archive commit clean task; archive remains inline", () => {
  for (const archive of [false, true]) {
    const p = makeOpenspecProject({ policy: ON, proposal: true, specs: 1, tasks: { done: 1 } });
    gitInit(p);
    git(p, ["add", "--", "context", "openspec"]);
    git(p, ["commit", "-qm", "test: project"]);
    const first = run(p, ["init", p.id, "--chain", "openspec", "--goal", "fix typo", ...(archive ? ["--archive"] : [])], { env: gitEnv(p) });
    assert.equal(first.json.step, "os-verify", first.stdout);
    canonical(p, first.json);
    writeArtifacts(p, { verify: "Verdict: PASS\nCritical: 0\nWarnings: 0\n" });
    writeResult(p, { status: "done" });
    const result = run(p, ["next", p.id, "--chain", "openspec"], { env: gitEnv(p) }).json;
    assert.equal(result.action, archive ? "archive" : "done", result.reason);
    assert.equal(fs.existsSync(taskPath(p)), false);
    assert.equal(result.promptFile, undefined);
    assert.equal(pending(p).pendingHandoff, undefined);
    if (archive) assert.doesNotMatch(git(p, ["ls-tree", "-r", "--name-only", "HEAD"]), /agent-smith\/prompt\.md/);
  }
});

test("both providers keep manual variants byte-identical to inline rendering", () => {
  for (const provider of ["claude", "openai"]) {
    for (const chrome of [true, false]) {
      const actions = [];
      for (const byFile of [false, true]) {
        const p = makeProject({
          plan: buildPlan([{ auto: [{ text: "implemented", done: true }], manual: ["Browser displays saved result"] }]),
          policy: { ...(provider === "openai" ? preset : {}), prompts: { byFile }, manualVerify: { minRigor: "lean" } },
        });
        writeReview(p, "plan-review", { verdict: "SOUND" });
        seedRun(p, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")], { providerMode: provider === "openai" ? "codex" : "claude" });
        const action = init(p, "fix typo", ["--chrome", String(chrome)]).json;
        assert.equal(action.step, "manual-verify");
        actions.push(pending(p).pendingPrompt);
        if (byFile) {
          canonical(p, action);
        }
      }
      assert.equal(actions[0], actions[1]);
    }
  }
});

test("Codex rechecks task after permission probe and inline actions reject promptFile", () => {
  const w = codexFixture("10x", { policy: { ...preset, ...ON } });
  const bin = path.join(w.fixture, "bin/codex");
  const source = fs.readFileSync(bin, "utf8");
  fs.writeFileSync(bin, source.replace('if (args[0] === "sandbox") {',
    'if (args[0] === "sandbox") { fs.writeFileSync(' + JSON.stringify(taskPath(w.project)) + ', "changed during preflight");'));
  const result = execute(w).json;
  assert.equal(result.launched, false);
  assert.match(result.reason, /task bytes/);
  assert.equal(calls(w.fixture).length, 1);
  const inline = codexFixture();
  assert.equal(execute(inline, { ...inline.action, promptFile: "forged.md" }).json.launched, false);
  assert.equal(calls(inline.fixture).length, 0);
});

test("unreadable task and owned-temp cleanup errors halt without consuming pending result", () => {
  const p = makeProject({ policy: ON });
  init(p, "fix typo");
  fs.unlinkSync(taskPath(p));
  fs.mkdirSync(taskPath(p));
  writeResult(p, FAULT);
  assert.equal(next(p).json.action, "halt");
  assert.equal(pending(p).neutralRetries, undefined);
  assert.equal(fs.existsSync(path.join(p.agentDir, "last-result.json")), true);
  fs.rmdirSync(taskPath(p));
  canonical(p, next(p).json);
  fs.writeFileSync(path.join(p.agentDir, "prompt.md.12345.tmp"), "owned");
  writeResult(p, { status: "done" });
  const refused = injected(p, `
const unlink = fs.unlinkSync;
fs.unlinkSync = file => {
  if (String(file).endsWith("/prompt.md.12345.tmp")) throw new Error("injected temp cleanup failure");
  return unlink(file);
};`);
  assert.equal(refused.json.action, "halt");
  assert.equal(pending(p).result, undefined);
  assert.equal(fs.existsSync(path.join(p.agentDir, "last-result.json")), true);
});

test("ended OpenAI archive rejects file fields without a model launch", () => {
  const p = makeOpenspecProject({ policy: { ...preset, ...ON }, proposal: true, specs: 1, tasks: { done: 1 } });
  gitInit(p);
  git(p, ["add", "--", "context", "openspec"]);
  git(p, ["commit", "-qm", "test: project"]);
  const w = codexFixture("openspec", { project: p });
  // Resume with archive enabled, then supply the existing verification step's result.
  run(p, ["init", p.id, "--chain", "openspec", "--archive"], { env: w.env });
  writeArtifacts(p, { verify: "Verdict: PASS\nCritical: 0\nWarnings: 0\n" });
  writeResult(p, { status: "done" });
  const action = run(p, ["next", p.id, "--chain", "openspec"], { env: w.env }).json;
  assert.equal(action.action, "archive", action.reason);
  for (const fields of [{ promptFile: "forged.md" }, { pendingHandoff: {} }]) {
    const refused = execute(w, { ...action, ...fields }).json;
    assert.equal(refused.launched, false);
    assert.match(refused.reason, /Archive action/);
  }
  assert.equal(calls(w.fixture).length, 0);
});

test("failed neutral-result deletion does not spend a retry", () => {
  const p = makeProject({ policy: ON });
  const first = init(p, "fix typo").json;
  writeResult(p, FAULT);
  const result = injected(p, `
const rm = fs.rmSync;
fs.rmSync = file => {
  if (String(file).endsWith("/last-result.json")) throw new Error("injected neutral delete failure");
  return rm(file);
};`);
  assert.equal(result.json.action, "halt");
  assert.equal(pending(p).neutralRetries, undefined);
  const retry = next(p).json;
  assert.equal(retry.prompt, first.prompt);
  assert.equal(retry.neutralRetry.count, 1);
});

test("actual emitted sizes fit normal roots and quantify long path/reason overhead", () => {
  const repo = fileURLToPath(new URL("../../../", import.meta.url));
  const shortRoot = path.join(repo, "p");
  const cases = [
    { label: "10x-claude", chain: "10x" },
    { label: "10x-openai", chain: "10x", openai: true },
    { label: "openspec-claude", chain: "openspec" },
    { label: "openspec-openai", chain: "openspec", openai: true },
    { label: "advisor", chain: "10x", advisor: { enabled: true } },
    { label: "manual-claude", chain: "10x", manual: true },
    { label: "manual-openai", chain: "10x", manual: true, openai: true },
  ];
  const rows = [];
  function record(p, result, label, policy) {
    const action = result.json;
    canonical(p, action);
    const row = { ...measure(p, action, label), policy };
    assert.equal(row.actionBytes, bytes(result.stdout), "measure actual pretty-printed CLI bytes");
    if (row.rootBytes <= 100) assert.ok(row.actionBytes <= 1280, JSON.stringify(row));
    rows.push(row);
  }
  for (const c of cases) {
    const policy = { ...(c.openai ? preset : {}), ...ON,
      ...(c.advisor ? { advisor: c.advisor } : {}),
      ...(c.manual ? { manualVerify: { minRigor: "lean" } } : {}),
    };
    const p = c.chain === "openspec" ? makeOpenspecProject({ policy }) : makeProject({ policy });
    // A short real root permits the normal-fixture budget even when TMPDIR is inside a long checkout.
    fs.mkdirSync(shortRoot);
    try {
      fs.cpSync(p.root, shortRoot, { recursive: true });
      const remap = value => path.join(shortRoot, path.relative(p.root, value));
      const q = { ...p, base: shortRoot, root: shortRoot, changeDir: remap(p.changeDir), agentDir: remap(p.agentDir),
        planFile: p.planFile ? remap(p.planFile) : null };
      if (c.manual) {
        writePlan(q, buildPlan([{ auto: [{ text: "implemented", done: true }], manual: ["Browser displays saved result"] }]));
        writeReview(q, "plan-review", { verdict: "SOUND" });
        seedRun(q, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")], { providerMode: c.openai ? "codex" : "claude" });
      }
      const first = run(q, ["init", q.id, "--chain", c.chain, "--goal", "fix typo"]);
      record(q, first, c.label + "-initial", policy);
      writeResult(q, FAULT);
      record(q, next(q), c.label + "-retry", policy);
      if (!c.manual) {
        if (c.chain === "10x") writePlan(q, planText());
        else writeArtifacts(q, { proposal: true, specs: 1, tasks: { open: 1 } });
        writeResult(q, { status: "done" });
        record(q, next(q), c.label + "-next", policy);
      }
    } finally { removeTree(shortRoot); }
  }
  const long = makeProject({ policy: ON, nest: "long-root-".repeat(12) });
  record(long, init(long, "fix typo"), "long-path", ON);
  const entries = readLogEntries(long);
  entries.at(-1).reason += "; " + "long explanation ".repeat(40);
  writeLog(long, entries);
  writeResult(long, FAULT);
  record(long, next(long), "long-path-and-reason", ON);
  assert.ok(rows.at(-1).actionBytes > rows.at(-2).actionBytes + 600);
  const evidence = {
    kind: "synthetic real CLI fixtures; bytes are UTF-8, not tokens",
    revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
    sourceState: "working tree; final phase commit records the test source",
    node: process.version,
    command: 'TMPDIR="$PWD/.agent-smith-test-tmp" HANDOFF_MEASUREMENTS=context/changes/step-prompt-by-file/evidence/size-measurements.json node --test --test-name-pattern="actual emitted sizes" skills/10x-pipeline/test/prompt-handoff.test.mjs',
    goal: "fix typo", id: "demo", normalCeilingBytes: 1280, normalRootLimitBytes: 100,
    archive: "excluded; inline by contract", livePairs: 0,
    fixtureDefaults: { score: { minRigor: null }, isolation: { require: false }, manualVerify: { minRigor: null } },
    rows,
  };
  if (process.env.HANDOFF_MEASUREMENTS) {
    const output = path.resolve(process.env.HANDOFF_MEASUREMENTS);
    assert.ok(output.startsWith(path.join(repo, "context/changes/step-prompt-by-file/evidence") + path.sep));
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
  }
});

for (const chain of ["10x", "openspec"]) {
  for (const byFile of [false, true]) {
    for (const flat of [false, true]) {
      test(`${chain}: saved ${flat ? "flat" : "delegated"} ${byFile ? "file" : "inline"} dispatch survives settings drift exactly`, () => {
        const w = codexFixture(chain, { policy: { ...preset, prompts: { byFile } } });
        const p = w.project;
        if (flat) {
          const entries = readLogEntries(p);
          const saved = entries.filter(e => !e.skipped).at(-1);
          saved.pendingPrompt = "Historical flat dispatch: do all work yourself; never start a subagent.\n"
            + saved.pendingPrompt.slice(saved.pendingPrompt.lastIndexOf("\nRESULT:"));
          writeLog(p, entries);
          if (byFile) fs.writeFileSync(taskPath(p), saved.pendingPrompt);
          else w.action.prompt = saved.pendingPrompt;
        }
        const saved = pending(p);
        assert.equal(saved.pendingPrompt.includes("one native child layer"), !flat);
        const prompt = saved.pendingPrompt;
        const first = w.action;
        fs.mkdirSync(path.join(p.root, ".claude"), { recursive: true });
        fs.writeFileSync(path.join(p.root, ".claude/settings.json"), JSON.stringify({ env: { CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "2" } }));
        writeOverride(p, { ...preset, codex: { profile: "changed-profile" }, prompts: { byFile: !byFile } });
        writeResult(p, FAULT);
        const retry = run(p, ["next", p.id, "--chain", chain], { env: w.env }).json;
        assert.ok(retry.neutralRetry);
        for (const key of ["n", "step", "agent", "provider", "model", "effort", "profile", "prompt", "promptFile"]) {
          assert.equal(retry[key], first[key], key);
          assert.equal(Object.hasOwn(retry, key), Object.hasOwn(first, key), key);
        }
        assert.equal(pending(p).pendingPrompt, prompt);
        assert.deepEqual(pending(p).pendingHandoff, saved.pendingHandoff);
        if (byFile) assert.equal(fs.readFileSync(taskPath(p), "utf8"), prompt);
        const result = execute(w, retry);
        assert.equal(result.json.completed, true, result.stdout);
        const model = calls(w.fixture).find(call => call.args[0] === "exec");
        assert.equal(model.input, first.prompt);
        assert.ok(model.args.includes("agents.enabled=true"), "effective launch, not old prompt text, owns native capability");
        assert.equal(model.args.includes("--ephemeral"), false);
      });
    }
  }
}
