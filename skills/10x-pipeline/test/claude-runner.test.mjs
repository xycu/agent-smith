import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  cleanupAll, makeProject, run, writeResult, readLogEntries, writeLog, entry, readMetaFile, writeMetaFile,
  writePlan, planText, writeReview, readReportFile, gitEnv, gitInit, commitFiles,
} from "./helpers.mjs";
import { makeOpenspecProject, writeArtifacts } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { waitForFile } from "./codex-helpers.mjs";

after(cleanupAll);
const runner = fileURLToPath(new URL("../scripts/run-claude.mjs", import.meta.url));
const peer = fileURLToPath(new URL("fake-claude.mjs", import.meta.url));
const shell = path => "'" + path.replaceAll("'", "'\\''") + "'";

function fixture(chain = "10x", policy = {}, mode = {}) {
  const p = chain === "10x" ? makeProject({ policy }) : makeOpenspecProject({ policy });
  gitInit(p);
  commitFiles(p, ["README.md"]);
  const dir = makeProject().root;
  const tmp = path.join(dir, "tmp");
  fs.mkdirSync(tmp);
  fs.writeFileSync(path.join(dir, "claude"), "#!/bin/sh\nexec " + shell(process.execPath) + " " + shell(peer) + ' "$@"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, "openspec"), '#!/bin/sh\n[ "$1" = "--version" ] && echo 2.0.0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, "SKILL.md"), "# Fixture skill");
  const env = { ...gitEnv(p), CLAUDE_FIXTURE_DIR: dir, TMPDIR: tmp, PATH: dir + path.delimiter + process.env.PATH };
  const call = args => run(p, [...args, "--chain", chain], { env });
  const action = call(["init", p.id, "--goal", "fix typo", "--host", "codex", "--provider-mode", "claude", "--rigor", "standard"]).json;
  assert.equal(action.action, "run", JSON.stringify(action));
  assert.equal(action.provider, "claude");
  const setMode = value => fs.writeFileSync(path.join(dir, "mode.json"), JSON.stringify({ chain, ...value }));
  setMode(mode);
  const execute = (input = action) => {
    const result = spawnSync(process.execPath, [runner, p.id, "--chain", chain], { cwd: p.root, env,
      encoding: "utf8", input: JSON.stringify(input), timeout: 15000 });
    assert.equal(result.error, undefined, result.error?.message);
    return JSON.parse(result.stdout);
  };
  return { p, action, execute, env, call, dir, tmp, setMode };
}

function archiveFixture(chain) {
  const w = fixture(chain);
  const { p } = w;
  if (chain === "10x") {
    writePlan(p, planText({ done: 1 }));
    fs.writeFileSync(path.join(p.changeDir, "change.md"), "---\nchange_id: demo\nstatus: impl_reviewed\ncreated: 2026-01-01\n---\n");
    writeReview(p, "plan-review", { verdict: "SOUND" });
    writeReview(p, "impl-review", { verdict: "APPROVED" });
  } else {
    writeArtifacts(p, { proposal: true, design: true, specs: 1, tasks: { done: 1 }, verify: "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n" });
  }
  writeLog(p, [entry(1, chain === "10x" ? "implement" : "os-apply"), entry(2, chain === "10x" ? "impl-review" : "os-verify")]);
  writeMetaFile(p, { ...readMetaFile(p), archive: true });
  const archive = w.call(["next", p.id]).json;
  assert.equal(archive.action, "archive", JSON.stringify(archive));
  return { w, p, archive };
}

for (const chain of ["10x", "openspec"]) {
  for (const byFile of [false, true]) test(`${chain}: headless Claude exact ${byFile ? "file" : "inline"} action, foreground leaves and unavailable accounting`, () => {
    const w = fixture(chain, { prompts: { byFile } }, { leaf: true });
    for (const field of ["root","change","chain","host","model","effort","agent","n","resultFile","prompt","provider"]) {
      assert.equal(w.execute({ ...w.action, [field]: "wrong" }).launched, false, field);
    }
    if (byFile) assert.equal(w.execute({ ...w.action, promptFile: "wrong" }).launched, false);
    const result = w.execute();
    assert.equal(result.completed, true, result.reason);
    assert.equal(result.launched, true);
    assert.equal(fs.readFileSync(path.join(w.dir, "work.txt"), "utf8"), w.action.prompt);
    const args = JSON.parse(fs.readFileSync(path.join(w.dir, "args.json")));
    for (const key of ["model","effort","agent"]) assert.equal(args[args.indexOf("--" + key) + 1], w.action[key]);
    assert.equal(result.usageEvidence.status, "unavailable");
    assert.equal(result.usageEvidence.invocation, undefined);
    assert.equal(result.result.usage.totalTokens, undefined);
    assert.ok(result.result.usage.durationMs >= 0);
    assert.deepEqual(fs.readdirSync(w.tmp), []);
    writeResult(w.p, result.result);
    w.call(["next", w.p.id]);
    const status = w.call(["status", w.p.id, "--report"]).json;
    assert.equal(status.usageCoverage.unavailable, 1);
    assert.equal(status.tokens.stepsWithFigures, 0);
    assert.match(readReportFile(w.p), /incomplete-capture/);
    const pair = w.call(["compare", w.p.id, "--baseline", w.p.root, "--routed", w.p.root, "--unpinned"]).json;
    assert.equal(pair.routed.usageCoverage.unavailable, 1);
    assert.doesNotMatch(JSON.stringify(pair), /987654/);
  });

  test(`${chain}: archive validates exact prompt, agent and target before moving with the original lock`, () => {
    const { w, p, archive } = archiveFixture(chain);
    for (const key of ["agent","prompt","archivePath"]) {
      const invalid = w.execute({ ...archive, [key]: "other" });
      assert.equal(invalid.launched, false);
      assert.match(invalid.reason, new RegExp(key));
    }
    const moveTo = path.join(p.root, archive.archivePath);
    fs.mkdirSync(path.dirname(moveTo), { recursive: true });
    w.setMode({ skill: chain === "10x" ? "10x-archive" : null, moveFrom: p.changeDir, moveTo });
    const result = w.execute(archive);
    assert.equal(result.completed, true, result.reason);
    assert.match(result.reply, /^RESULT:/);
    assert.equal(fs.existsSync(p.changeDir), false);
    assert.deepEqual(fs.readdirSync(w.tmp), []);
  });

  for (const outcome of ["cli-error", "malformed", "invalid-status", "blocked", "failed"]) {
    test(`${chain}: archive ${outcome} reports the reply and lock disposition`, () => {
      const { w, p, archive } = archiveFixture(chain);
      const settled = outcome === "blocked" || outcome === "failed";
      const reply = outcome === "malformed" ? "RESULT: {" : "RESULT: " + JSON.stringify({ status: outcome === "cli-error" ? "done" : outcome });
      const terminal = outcome === "cli-error" ? { subtype: "error_max_turns", is_error: true } : undefined;
      w.setMode({ skill: chain === "10x" ? "10x-archive" : null, reply, terminal });
      const result = w.execute(archive);
      assert.equal(result.launched, true, result.reason);
      assert.equal(result.completed, settled, result.reason);
      if (settled) {
        assert.equal(result.reply, reply);
        assert.equal(result.result.status, outcome);
        assert.deepEqual(fs.readdirSync(w.tmp), []);
      } else {
        assert.equal(result.reply, undefined);
        assert.equal(result.result, null);
        assert.match(result.reason, /^Execution suspended: native ownership unresolved/);
        assert.match(result.reason, outcome === "cli-error" ? /archive did not complete/ : /invalid (JSON|status)/);
        assert.match(w.call(["next", p.id]).json.reason, /native ownership unresolved/);
      }
    });
  }
}

test("incompatible handshake, toolkit, privilege set or changed handoff refuses before work and allows retry", () => {
  const w = fixture("10x", { prompts: { byFile: true } });
  for (const mode of [{ missingHandshake: true }, { badHandshake: true }, { foreignAgent: true }, { missingSkill: true }, { disabledHooks: true },
    { changeHandoff: path.join(w.p.root, w.action.promptFile) }]) {
    w.setMode(mode);
    const refused = w.execute();
    assert.equal(refused.launched, false, JSON.stringify(mode));
    assert.equal(refused.completed, false);
    assert.match(refused.reason, /startup imports/i);
    assert.equal(fs.existsSync(path.join(w.dir, "work.txt")), false);
    assert.deepEqual(fs.readdirSync(w.tmp), []);
  }
  const meta = readMetaFile(w.p);
  meta.provenance.sections.hookFiles = "different-revision";
  writeMetaFile(w.p, meta);
  assert.match(w.execute().reason, /revision differs/);
});

test("scorer gets its four effective tools and rejects a broader pool, custom mappings or a native advisor", () => {
  const restricted = { score: { minRigor: "standard" }, agents: { restricted: true } };
  const w = fixture("10x", restricted, { scorerCall: true });
  assert.equal(w.action.agent, "agent-smith:score");
  assert.equal(w.execute().completed, true);
  w.setMode({ extraTool: true });
  assert.equal(w.execute().launched, false);
  for (const policy of [{ agents: { restricted: true, steps: { plan: "custom:step" } } },
    { advisor: { enabled: true, templates: ["plan"] } }]) {
    const other = fixture("10x", policy);
    assert.match(other.execute().reason, /agent mapping or native advisor/);
    assert.equal(fs.existsSync(path.join(other.dir, "args.json")), false);
  }
});

test("a discovered skill without its invocation tool refuses the work turn", () => {
  const w = fixture("10x", {}, { missingTool: "Skill" });
  const result = w.execute();
  assert.equal(result.launched, false);
  assert.match(result.reason, /required effective tools/);
  assert.equal(fs.existsSync(path.join(w.dir, "work.txt")), false);
  assert.deepEqual(fs.readdirSync(w.tmp), []);
});

test("headless manual verification refuses either native advisor opt-in before spawning Claude", () => {
  for (const template of ["manual-verify", "manual-verify-headless"]) {
    const w = fixture("10x", { manualVerify: { minRigor: "lean" }, advisor: { enabled: true, templates: [template] } });
    writePlan(w.p, planText({ done: 1 }));
    writeReview(w.p, "plan-review", { verdict: "SOUND" });
    writeLog(w.p, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")]);
    const action = w.call(["next", w.p.id]).json;
    assert.equal(action.step, "manual-verify");
    const pending = readLogEntries(w.p).at(-1);
    assert.equal(pending.template, "manual-verify-headless");
    assert.equal(pending.advisor, true);
    const result = w.execute(action);
    assert.equal(result.launched, false);
    assert.match(result.reason, /native advisor requirement/);
    assert.equal(fs.existsSync(path.join(w.dir, "args.json")), false);
  }
});

test("executor preflight requires the skill stored with the actual pending template", () => {
  for (const executor of ["tdd","e2e"]) {
    const w = fixture();
    const log = readLogEntries(w.p);
    const pending = log.at(-1);
    Object.assign(pending, { step: "implement", template: "implement-" + executor, skill: "10x-" + executor });
    writeLog(w.p, log);
    const action = { ...w.action, step: "implement" };
    const mismatch = w.execute(action);
    assert.equal(mismatch.launched, false);
    assert.match(mismatch.reason, new RegExp("10x-" + executor));
    w.setMode({ skill: pending.skill });
    const ok = w.execute(action);
    assert.equal(ok.completed, true, ok.reason);
  }
});

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: verified unsuccessful results and settled malformed replies release ownership`, () => {
    for (const status of ["failed", "blocked", "malformed", "cli-error"]) {
      const reply = status === "malformed" ? "RESULT: {" : "RESULT: " + JSON.stringify({ status: status === "cli-error" ? "done" : status });
      const terminal = status === "cli-error" ? { subtype: "error_max_turns", is_error: true } : undefined;
      const w = fixture(chain, {}, { reply, terminal });
      const result = w.execute();
      assert.equal(result.launched, true, result.reason);
      assert.deepEqual(fs.readdirSync(w.tmp), []);
      assert.equal(result.completed, ["failed", "blocked"].includes(status));
      if (result.completed) {
        assert.equal(result.result.status, status);
        continue;
      }
      assert.equal(result.result, null);
      assert.match(result.reason, status === "malformed" ? /invalid JSON/ : /exited unsuccessfully/);
      writeResult(w.p, { status: "unknown", note: result.reason, usage: result.usage, usageEvidence: result.usageEvidence });
      w.call(["next", w.p.id]);
      const row = readLogEntries(w.p).find(e => e.n === w.action.n);
      assert.equal(row.result.status, "unknown");
      assert.ok(Number.isSafeInteger(row.usage.durationMs) && row.usage.durationMs >= 0);
      assert.deepEqual(row.usage, result.usage);
      assert.equal(row.usageEvidence.status, "unavailable");
      assert.deepEqual(row.usageEvidence, result.usageEvidence);
      assert.equal(w.call(["usage", w.p.id, String(row.n), "--tokens", "1"]).json.attached, false);
    }
  });
}

test("unmatched lifecycle before work, missing leaf collection and conflicting output retain native ownership", () => {
  for (const mode of [{ earlyLeaf: true }, { leaf: true, uncollected: true }, { mismatch: true },
    { trailingAssistant: true }, { terminal: {} }, { terminal: { subtype: "success" } }, { terminal: { subtype: "success", is_error: "false" } },
    { terminal: { subtype: "error_max_turns", is_error: false } },
    { terminal: { subtype: "interrupted", is_error: true } }]) {
    const w = fixture("10x", {}, mode);
    const result = w.execute();
    assert.equal(result.completed, false);
    assert.equal(result.launched, !mode.earlyLeaf);
    assert.match(result.reason, /^Execution suspended: native ownership unresolved .*Claude session/);
    const file = path.join(w.tmp, fs.readdirSync(w.tmp).find(name => name.endsWith(".lock")));
    const owner = JSON.parse(fs.readFileSync(file));
    assert.equal(owner.native.host, "claude");
    assert.match(owner.native.claudeSessionId, /^[a-f\d-]{36}$/);
    // The preceding reader checks the presence of "native" before PID/group liveness.
    assert.ok(Object.hasOwn(owner, "native"));
    fs.writeFileSync(file, JSON.stringify({ ...owner, pid: 2147483000, childPid: 2147483001 }));
    assert.match(w.call(["next", w.p.id]).json.reason, /native ownership unresolved/);
    assert.equal(w.execute().launched, false);
  }
});

test("cancelling guarded work suspends before intake or relaunch", async () => {
  const w = fixture("10x", {}, { hold: true });
  const child = spawn(process.execPath, [runner, w.p.id], { cwd: w.p.root, env: w.env, stdio: ["pipe","pipe","pipe"] });
  const closed = once(child, "close");
  let stdout = "";
  child.stdout.on("data", chunk => stdout += chunk);
  child.stderr.resume();
  child.stdin.end(JSON.stringify(w.action));
  try {
    await waitForFile(path.join(w.dir, "work.txt"));
    child.kill("SIGTERM");
    await closed;
    const result = JSON.parse(stdout);
    assert.match(result.reason, /Execution suspended.*cancelled/);
    assert.equal(result.result, null);
    assert.match(w.call(["next", w.p.id]).json.reason, /native ownership unresolved/);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await closed;
  }
});
