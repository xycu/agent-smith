// Real router dispatch and recoverable file lifecycle; providers are fake, never live agents.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, init, next, run, writeOverride, writeResult, readLogEntries,
  readMetaFile, planText, gitInit, git, gitEnv, writeLog, entry,
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
    if (failure !== "intake") assert.equal(pending(p).result.status, "done");
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
        writeLog(p, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")]);
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
