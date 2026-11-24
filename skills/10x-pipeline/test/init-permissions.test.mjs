import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CAPTURE_ENV } from "../scripts/claude-capture-data.mjs";
import { CODEX_USAGE_FLOOR } from "../scripts/codex-usage.mjs";
import {
  cleanupAll, makeProject, git, gitEnv, gitAvailable, run, writeMetaFile, writeOverride, writeResult, seedRun, entry,
} from "./helpers.mjs";
import { makeOpenspecProject } from "../../openspec-pipeline/test/openspec-helpers.mjs";

after(cleanupAll);

const MISSING_TABLE = 'Error: default_permissions requires a `[permissions]` table';
const undefinedProfile = name => `Error: default_permissions refers to undefined profile \`${name}\``;
const CLAUDE_WARNING = /Warning: .*Claude sandbox write.list/;
const CODEX_WARNING = /Warning: Codex could not resolve its default_permissions profile/;
const permissionStderr = stderr => stderr.replace(/^Warning: Usage capture preflight\.[^\n]*\n/gm, "");

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function launch(project, env, flags = []) {
  return run(project, ["init", project.id, "--chain", project.chain ?? "10x", "--goal", "fix typo", ...flags], { env });
}

function assertRun(result) {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).action, "run");
  return result.json;
}

function codex(project) {
  const home = path.join(project.base, "codex-home");
  const log = path.join(home, "calls.jsonl");
  const versionLog = path.join(home, "version-calls.jsonl");
  const mode = write(path.join(home, "mode.json"), "{}");
  const executable = write(path.join(project.base, "init-bin", "codex"), `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const home = process.env.CODEX_HOME;
const args = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(path.join(home, "mode.json"), "utf8"));
const scrubbed = !Object.keys(process.env).some(name => /^(GH|GITHUB)_([A-Z0-9]+_)*TOKEN$/i.test(name));
const version = args[0] === "--version";
fs.appendFileSync(path.join(home, version ? "version-calls.jsonl" : "calls.jsonl"), JSON.stringify({
  args, cwd: process.cwd(), scrubbed, keep: process.env.CODEX_TEST_KEEP,
}) + "\\n");
if (version) {
  console.log("codex-cli ${CODEX_USAGE_FLOOR}");
} else {
  const message = args.includes("permissions={}") ? config.retry : config.message;
  if (config.timeout) {
    if (message) process.stderr.write(message + "\\n");
    setInterval(() => {}, 1000);
  } else {
    if (message) process.stderr.write(message + "\\n");
    process.exitCode = config.status ?? (message ? 1 : 0);
  }
}
`);
  fs.chmodSync(executable, 0o755);
  const calls = file => fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").map(JSON.parse) : [];
  return {
    env: {
      ...gitEnv(project),
      PATH: path.dirname(executable) + path.delimiter + process.env.PATH,
      CODEX_HOME: home,
      CLAUDE_CONFIG_DIR: path.join(project.base, "claude-user"),
      [CAPTURE_ENV]: "",
      GH_TOKEN: "fixture-token",
      GITHUB_ENTERPRISE_TOKEN: "fixture-token",
      CODEX_TEST_KEEP: "retained",
    },
    setMode(value) { fs.writeFileSync(mode, JSON.stringify(value)); },
    calls() { return calls(log); },
    versionCalls() { return calls(versionLog); },
  };
}

function linkedProject(chain = "10x", separateGitDir = false) {
  const make = chain === "openspec" ? makeOpenspecProject : makeProject;
  const main = make();
  const common = separateGitDir ? path.join(main.base, 'shared "Git" directory') : path.join(main.base, ".git");
  git(main, ["init", "-q", ...(separateGitDir ? ["--separate-git-dir", common] : [])]);
  git(main, ["add", "--", "context", ...(chain === "openspec" ? ["openspec"] : [])]);
  git(main, ["commit", "-m", "chore: seed init fixture"]);
  const root = path.join(main.base, "work tree");
  git(main, ["worktree", "add", "-b", "init-fixture", root]);
  const changeDir = path.join(root, path.relative(main.root, main.changeDir));
  const worktree = { ...main, chain, root, changeDir, agentDir: path.join(changeDir, "agent-smith") };
  return { main, worktree, common: fs.realpathSync(common) };
}

function allow(file, ...entries) {
  return write(file, JSON.stringify({ sandbox: { filesystem: { allowWrite: entries } } }));
}

test("passes the selected Codex overlay and scrubbed environment to a model-free run-root probe", () => {
  const profile = 'try "overlay"';
  const project = makeProject({ policy: { codex: { profile } } });
  const fixture = codex(project);
  const config = write(path.join(project.root, ".codex/config.toml"), 'default_permissions = "a-profile"\n');
  const before = fs.readFileSync(config);
  const name = 'custom."quoted"\\name';
  fixture.setMode({ message: undefinedProfile(name) });
  const warning = launch(project, fixture.env, ["--provider-mode", "codex"]);
  const action = assertRun(warning);
  assert.equal(action.provider, "openai");
  assert.equal(action.profile, profile);
  assert.match(warning.stderr, CODEX_WARNING);
  assert.ok(warning.stderr.includes(`active -p overlay ${JSON.stringify(profile)}`));
  assert.ok(warning.stderr.includes(`[permissions.${JSON.stringify(name)}]\nextends = ":workspace"`));
  assert.match(warning.stderr, /trusted \.codex\/config\.toml/);
  assert.doesNotMatch(warning.stderr, /\.filesystem\]/);
  assert.deepEqual(fixture.calls(), [{
    args: ["sandbox", "-p", profile, "--", process.execPath, "-e", ""],
    cwd: project.root,
    scrubbed: true,
    keep: "retained",
  }]);
  assert.deepEqual(fixture.versionCalls(), [{
    args: ["--version"], cwd: project.root, scrubbed: true, keep: "retained",
  }]);
  assert.deepEqual(fs.readFileSync(config), before);
});

test("recovers a missing table's selector once or uses a placeholder", () => {
  for (const retry of [undefinedProfile("from-default"), "Error: unrelated configuration failure"]) {
    const project = makeProject();
    const fixture = codex(project);
    fixture.setMode({ message: MISSING_TABLE, retry });
    const result = launch(project, fixture.env, ["--host", "codex"]);
    assertRun(result);
    assert.match(result.stderr, CODEX_WARNING);
    assert.deepEqual(fixture.calls().map(call => call.args.slice(0, call.args.indexOf("--"))),
      [["sandbox"], ["sandbox", "-c", "permissions={}"]]);
    if (retry.startsWith("Error: default_permissions")) {
      assert.match(result.stderr, /\[permissions\."from-default"\]/);
    } else {
      assert.match(result.stderr, /Replace "<default_permissions>" with the selected default_permissions value/);
      assert.match(result.stderr, /\[permissions\."<default_permissions>"\]/);
      assert.doesNotMatch(result.stderr, /unrelated/);
    }
  }
});

test("fails advisory profile detection conservatively on unrelated, oversized and timed-out starts", () => {
  const diagnostic = undefinedProfile("ignored");
  const cases = [
    {},
    { message: diagnostic, status: 0 },
    { message: "Error: sandbox startup rejected" },
    { message: "Error: permissions profile `valid` extends undefined profile `base`" },
    { message: "Error: failed parsing config\n" + diagnostic },
    { message: diagnostic + "\n" + "x".repeat(32 * 1024) },
    { message: diagnostic, timeout: true },
  ];
  for (const mode of cases) {
    const project = makeProject();
    const fixture = codex(project);
    fixture.setMode(mode);
    const result = launch(project, fixture.env, ["--provider-mode=codex"]);
    assertRun(result);
    assert.equal(result.stderr, "", JSON.stringify(mode).slice(0, 100));
    assert.equal(fixture.calls().length, 1);
  }
  const project = makeProject();
  const missing = launch(project, { ...gitEnv(project), PATH: path.join(project.base, "missing") }, ["--host", "codex"]);
  assertRun(missing);
  assert.equal(permissionStderr(missing.stderr), "");
});

test("substitutes unsafe text in a recognized profile diagnostic", () => {
  const project = makeProject();
  const fixture = codex(project);
  fixture.setMode({ message: undefinedProfile("bad\x1bname") });
  const result = launch(project, fixture.env, ["--host", "codex"]);
  assertRun(result);
  assert.match(result.stderr, /\[permissions\."<default_permissions>"\]/);
  assert.doesNotMatch(result.stderr, /\x1b|bad/);
});

test("split init on both chains warns about the real shared Git directory without changing refs or config", { skip: !gitAvailable() }, () => {
  for (const chain of ["10x", "openspec"]) {
    const { main, worktree, common } = linkedProject(chain, true);
    const fixture = codex(worktree);
    fixture.setMode({ message: undefinedProfile("custom") });
    const codexConfig = write(path.join(worktree.root, ".codex/config.toml"), 'default_permissions = "custom"\n');
    const claudeConfig = allow(path.join(worktree.root, ".claude/settings.json"), "./unrelated");
    const paths = [codexConfig, claudeConfig, path.join(common, "config")];
    const contentsBefore = paths.map(file => fs.readFileSync(file));
    const refsBefore = git(main, ["show-ref"]);
    const warned = launch(worktree, fixture.env, ["--provider-mode", "split"]);
    const action = assertRun(warned);
    assert.equal(action.chain, chain);
    assert.equal(action.providerMode, "split");
    assert.deepEqual(new Set(Object.values(action.providersByStep)), new Set(["claude", "openai"]));
    assert.match(warned.stderr, CODEX_WARNING);
    assert.match(warned.stderr, CLAUDE_WARNING);
    assert.ok(warned.stderr.includes(`[permissions."custom".filesystem]\n${JSON.stringify(common)} = "write"`));
    assert.ok(warned.stderr.includes(JSON.stringify({ sandbox: { filesystem: { allowWrite: [common] } } }, null, 2)));
    assert.match(warned.stderr, /access automatically.*sandboxed Git writes fail/);
    assert.deepEqual(paths.map(file => fs.readFileSync(file)), contentsBefore);
    assert.equal(git(main, ["show-ref"]), refsBefore);
    assert.equal(fixture.calls().length, 1);

    // Neutral replay returns the same action while repaired provider settings clear both warnings.
    fixture.setMode({});
    allow(claudeConfig, common);
    writeResult(worktree, { status: "orchestrator-error", note: "no child started" });
    const repaired = launch(worktree, fixture.env);
    assert.deepEqual(assertRun(repaired), { ...action, neutralRetry: { count: 1, cap: 2 } });
    assert.equal(permissionStderr(repaired.stderr), "");
    assert.equal(fixture.calls().length, 2);
    assert.deepEqual(fs.readFileSync(codexConfig), contentsBefore[0]);
    assert.equal(git(main, ["show-ref"]), refsBefore);
  }
});

test("checks Claude's explicit user, project and local write entries with each scope's path anchor", { skip: !gitAvailable() }, () => {
  const cases = [
    ["project", ({ common }) => [common + path.sep]],
    ["project", () => ["../.git/**/"]],
    ["mainLocal", () => ["../.git"]],
    ["worktreeLocal", () => ["../.git"]],
    ["user", () => ["../.git"]],
    ["user", () => ["~/.git"]],
    ["project", () => [".."]],
    ["project", ({ main }) => {
      const alias = path.join(main.root, "git alias");
      fs.symlinkSync(".git", alias, "dir");
      return [alias];
    }],
    ["project", ({ common }) => ["//" + common.slice(1)]],
  ];
  for (const [scope, entries] of cases) {
    const linked = linkedProject();
    const { main, worktree } = linked;
    const fixture = codex(worktree);
    const file = allow({
      project: path.join(worktree.root, ".claude/settings.json"),
      worktreeLocal: path.join(worktree.root, ".claude/settings.local.json"),
      mainLocal: path.join(main.root, ".claude/settings.local.json"),
      user: path.join(fixture.env.CLAUDE_CONFIG_DIR, "settings.json"),
    }[scope], ...entries(linked));
    const before = fs.readFileSync(file);
    fixture.setMode({ message: undefinedProfile("must-not-probe") });
    const result = launch(worktree, fixture.env);
    assert.equal(assertRun(result).provider, "claude");
    assert.equal(permissionStderr(result.stderr), "", `${scope}: ${before}`);
    assert.deepEqual(fixture.calls(), []);
    assert.deepEqual(fs.readFileSync(file), before);
  }
});

test("Claude reports a clear missing entry only for resolved and uncovered lists", { skip: !gitAvailable() }, () => {
  for (const settings of ["sibling", "wildcard", "invalid"]) {
    const { main, worktree, common } = linkedProject();
    const fixture = codex(worktree);
    const file = path.join(worktree.root, ".claude/settings.json");
    const sibling = common + "-backup";
    fs.mkdirSync(sibling);
    if (settings === "invalid") write(file, "{");
    else allow(file, settings === "sibling" ? sibling : common + "*");
    const result = launch(worktree, fixture.env);
    assertRun(result);
    assert.match(result.stderr, CLAUDE_WARNING);
    if (settings === "sibling") assert.match(result.stderr, /have no explicit entry/);
    else {
      assert.match(result.stderr, /Could not verify an explicit/);
      assert.doesNotMatch(result.stderr, /have no explicit entry/);
    }
    const mainResult = launch(main, fixture.env);
    assertRun(mainResult);
    assert.equal(permissionStderr(mainResult.stderr), "");
  }
});

test("invalid init never probes and a Codex-only run omits the Claude advisory", { skip: !gitAvailable() }, () => {
  const { worktree } = linkedProject();
  const fixture = codex(worktree);
  fixture.setMode({ message: undefinedProfile("custom") });
  const invalid = launch(worktree, fixture.env, ["--host", "codex", "--unknown"]);
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).action, "halt");
  assert.equal(invalid.stderr, "");
  assert.deepEqual(fixture.calls(), []);
  assert.deepEqual(fixture.versionCalls(), []);
  assert.equal(fs.existsSync(worktree.agentDir), false);

  const valid = launch(worktree, fixture.env, ["--host", "codex"]);
  assert.equal(assertRun(valid).provider, "openai");
  assert.match(valid.stderr, CODEX_WARNING);
  assert.doesNotMatch(valid.stderr, CLAUDE_WARNING);
});

test("legacy ladder arrays include both advisory providers", { skip: !gitAvailable() }, () => {
  const { worktree } = linkedProject();
  const { ladder } = JSON.parse(fs.readFileSync(new URL("../policy.json", import.meta.url), "utf8"));
  ladder.at(-1).provider = "openai";
  writeOverride(worktree, { ladder });
  writeMetaFile(worktree, { host: "claude" });
  const fixture = codex(worktree);
  fixture.setMode({ message: undefinedProfile("custom") });
  const result = launch(worktree, fixture.env);
  const action = assertRun(result);
  assert.equal(action.providerMode, "legacy");
  assert.deepEqual(action.providersByStep.plan, ["claude", "openai"]);
  assert.match(result.stderr, CODEX_WARNING);
  assert.match(result.stderr, CLAUDE_WARNING);
  assert.equal(fixture.calls().length, 1);
});

test("neutral init uses the exact OpenAI overlay even if its legacy provider is no longer assigned", () => {
  for (const profile of [null, "retained-overlay"]) {
    const project = makeProject({ policy: { codex: { profile: "edited-overlay" } } });
    seedRun(project, [entry(1, "plan", {
      provider: "openai", profile, model: "retained-model", effort: "high", result: undefined, pendingPrompt: "retained prompt",
    })], { providerMode: undefined });
    writeResult(project, { status: "orchestrator-error", note: "no child started" });
    const fixture = codex(project);
    fixture.setMode({ message: undefinedProfile("custom") });
    const result = launch(project, fixture.env);
    const action = assertRun(result);
    assert.equal(action.providerMode, "legacy");
    assert.equal(action.provider, "openai");
    assert.equal(action.profile, profile);
    assert.match(result.stderr, CODEX_WARNING);
    assert.deepEqual(fixture.calls().map(call => call.args.slice(0, call.args.indexOf("--"))),
      [profile === null ? ["sandbox"] : ["sandbox", "-p", profile]]);
  }

  const project = makeProject({ policy: { codex: { profile: "original" } } });
  const fixture = codex(project);
  const initial = assertRun(launch(project, fixture.env, ["--host", "codex"]));
  writeOverride(project, { codex: { profile: "edited" } });
  writeResult(project, { status: "orchestrator-error", note: "no child started" });
  assert.deepEqual(assertRun(launch(project, fixture.env)), { ...initial, neutralRetry: { count: 1, cap: 2 } });
  assert.deepEqual(fixture.calls().map(call => call.args.slice(0, call.args.indexOf("--"))),
    [["sandbox", "-p", "original"], ["sandbox", "-p", "original"]]);
});

test("both skill entry points display init stderr before dispatch and parse stdout independently", () => {
  for (const skill of ["../SKILL.md", "../../openspec-pipeline/SKILL.md"]) {
    const markdown = fs.readFileSync(new URL(skill, import.meta.url), "utf8");
    const init = markdown.split("\n").find(line => line.includes('node "$ROUTER" init'));
    assert.match(init, /Parse one JSON action from stdout/);
    assert.match(init, /Show init .* before dispatch, alongside any warnings from stderr/);
  }
});
