// OpenSpec chain contract (ADR-013): what the router reads from an OpenSpec change folder must match what the
// OpenSpec CLI reports for it. For each fixture, `status --chain openspec` is compared with
// `openspec instructions apply --change <id> --json`: planningComplete equals `state !== "blocked"`, and the task
// counts equal progress.total and progress.complete. Only this test runs the CLI; the router never does.
// Failed probes skip locally and fail CI. Successful probes require exactly OpenSpec 2.0.0.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { cleanEnv, cleanupAll, git, gitAvailable, gitEnv, gitInit, run } from "../../10x-pipeline/test/helpers.mjs";
import { removeTree } from "../../10x-pipeline/scripts/remove-tree.mjs";
import { makeOpenspecProject } from "./openspec-helpers.mjs";

after(cleanupAll);

const BIN = process.env.OPENSPEC_BIN ?? "openspec";

function probe() {
  const res = spawnSync(BIN, ["--version"], { encoding: "utf8", timeout: 20000 });
  let reason = false;
  if (res.error) reason = `${BIN} does not start (${res.error.code ?? res.error.message})`;
  else if (res.signal) reason = `${BIN} --version was killed by ${res.signal}`;
  else if (res.status !== 0) reason = `${BIN} --version exited ${res.status}`;
  if (!reason && res.stdout.trim() !== "2.0.0") {
    throw new Error(`${BIN}: expected OpenSpec 2.0.0, got ${JSON.stringify(res.stdout.trim())}`);
  }
  if (reason && process.env.CI) throw new Error(reason);
  return reason;
}
const skip = probe();

// The CLI's JSON answer for the change, run in the project with HOME in the scratch folder so it writes nothing
// outside it. The JSON starts at the first `{` (the CLI can print a notice before it).
function cli(project, args, expected = 0) {
  const env = cleanEnv();
  delete env.CODEX_HOME;
  const fixtureHome = path.join(project.base, "home");
  const res = spawnSync(BIN, args, {
    cwd: project.root,
    encoding: "utf8",
    timeout: 30000,
    env: { ...env, HOME: fixtureHome, USERPROFILE: fixtureHome,
      XDG_CONFIG_HOME: path.join(project.base, "xdg-config"),
      XDG_DATA_HOME: path.join(project.base, "xdg-data"),
      XDG_CACHE_HOME: path.join(project.base, "xdg-cache"),
      OPENSPEC_TELEMETRY: "0", DO_NOT_TRACK: "1", OPENSPEC_NO_UPDATE_CHECK: "1" },
  });
  assert.equal(res.error, undefined, String(res.error));
  assert.equal(res.signal, null, `${BIN} ${args.join(" ")}: ${res.signal}`);
  assert.equal(res.status, expected, `${BIN} ${args.join(" ")}: ${res.stdout}${res.stderr}`);
  return res.stdout;
}

function cliJson(project, args, expected = 0) {
  const output = cli(project, args, expected);
  const start = output.indexOf("{");
  assert.ok(start >= 0, `no JSON from ${BIN}: ${output}`);
  return JSON.parse(output.slice(start));
}

const FIXTURES = [
  ["an empty change", {}],
  ["a proposal only", { proposal: true }],
  ["proposal, specs and tasks without design", { proposal: true, specs: 1, tasks: { done: 0, open: 3 } }],
  ["all four files with mixed ticks", { proposal: true, design: true, specs: 1, tasks: { done: 1, open: 2 } }],
  ["rows in every list form and marker", {
    proposal: true,
    specs: 1,
    tasks: "## 1. Work\n\n- [x] 1.1 Done\n* [ ] 1.2 Star\n+ [ ] 1.3 Plus\n1. [ ] 1.4 Numbered\n2) [x] 1.5 Paren\n- [~] 1.6 Tilde\n- [] 1.7 Empty\n  - [ ] 1.8 Nested\n- [Some doc](./doc.md)\n",
  }],
];

for (const [name, artifacts] of FIXTURES) {
  test(`status --chain openspec matches openspec instructions apply: ${name}`, { skip }, () => {
    const project = makeOpenspecProject(artifacts);
    const status = run(project, ["status", project.id, "--chain", "openspec"]);
    assert.equal(status.status, 0, status.stdout + status.stderr);
    const ours = status.json.openspec;
    const cli = cliJson(project, ["instructions", "apply", "--change", project.id, "--json"]);
    assert.ok(["blocked", "ready", "all_done"].includes(cli.state), `unknown state ${cli.state}`);
    assert.equal(ours.planningComplete, cli.state !== "blocked", `state ${cli.state}`);
    const total = cli.progress?.total ?? 0;
    const complete = cli.progress?.complete ?? 0;
    assert.equal(ours.tasks.total, total);
    assert.equal(ours.tasks.complete, complete);
  });
}

const WORKFLOWS = {
  propose: "openspec-propose", explore: "openspec-explore", new: "openspec-new-change",
  continue: "openspec-continue-change", apply: "openspec-apply-change", update: "openspec-update-change",
  ff: "openspec-ff-change", sync: "openspec-sync-specs", archive: "openspec-archive-change",
  "bulk-archive": "openspec-bulk-archive-change", verify: "openspec-verify-change", onboard: "openspec-onboard",
};

function selectWorkflows(project, workflows) {
  cli(project, ["config", "set", "profile", "custom"]);
  cli(project, ["config", "set", "workflows", JSON.stringify(workflows)]);
}

function assertSharedSkills(root, workflows) {
  for (const workflow of workflows) {
    const name = WORKFLOWS[workflow];
    const canonical = path.join(root, ".agents/skills", name);
    const text = fs.readFileSync(path.join(canonical, "SKILL.md"), "utf8");
    assert.match(text, /generatedBy: "2\.0\.0"/);
    assert.match(text, /license: MIT/);
    const link = path.join(root, ".claude/skills", name);
    assert.ok(fs.lstatSync(link).isSymbolicLink(), `${name} is a Claude link`);
    assert.equal(path.isAbsolute(fs.readlinkSync(link)), false);
    assert.equal(fs.realpathSync(link), fs.realpathSync(canonical));
    assert.ok(fs.realpathSync(link).startsWith(fs.realpathSync(root) + path.sep));
  }
}

// Snapshot bytes and links without following links. Directory entries expose unexpected writes too.
function snapshot(dir) {
  const entries = {};
  function visit(current, relative) {
    for (const name of fs.readdirSync(current).sort()) {
      if (name === ".git") continue;
      const file = path.join(current, name);
      const key = path.join(relative, name);
      const st = fs.lstatSync(file);
      if (st.isSymbolicLink()) entries[key] = { link: fs.readlinkSync(file) };
      else if (st.isDirectory()) {
        entries[key] = { directory: true };
        visit(file, key);
      } else entries[key] = { bytes: fs.readFileSync(file).toString("base64") };
    }
  }
  visit(dir, "");
  return entries;
}

test("OpenSpec 2.0.0 custom setup supplies propose/apply/verify and core omits verify", { skip }, () => {
  const custom = makeOpenspecProject({ change: false });
  selectWorkflows(custom, ["propose", "apply", "verify"]);
  cli(custom, ["init", "--tools", "claude,codex", "--profile", "custom", "--no-animation"]);
  assertSharedSkills(custom.root, ["propose", "apply", "verify"]);
  assert.deepEqual(fs.readdirSync(path.join(custom.root, ".agents/skills")).filter((name) => name.startsWith("openspec-")).sort(),
    ["openspec-propose", "openspec-apply-change", "openspec-verify-change"].sort());

  const core = makeOpenspecProject({ change: false });
  cli(core, ["init", "--tools", "claude,codex", "--profile", "core", "--no-animation"]);
  assertSharedSkills(core.root, ["propose", "explore", "apply", "update", "sync", "archive"]);
  assert.equal(fs.existsSync(path.join(core.root, ".agents/skills/openspec-verify-change")), false);
});

test("OpenSpec 2.0.0 upgrades twelve legacy workflows, preserves inputs and tracks fresh-checkout links", { skip: skip || (!gitAvailable() && "git unavailable") }, () => {
  assert.ok(gitAvailable(), "the tracked-checkout contract requires Git");
  const project = makeOpenspecProject({ proposal: true, design: true, specs: 1, tasks: { done: 1, open: 1 } });
  const inputs = [
    "openspec/config.yaml", "openspec/changes/demo/.openspec.yaml", "openspec/changes/demo/proposal.md",
    "openspec/changes/demo/design.md", "openspec/changes/demo/tasks.md", "openspec/changes/demo/specs/cap-1/spec.md",
    "openspec/specs/existing/spec.md", "context/foundation/agent-smith-policy.json",
  ];
  fs.mkdirSync(path.join(project.root, "openspec/specs/existing"), { recursive: true });
  fs.writeFileSync(path.join(project.root, "openspec/specs/existing/spec.md"), "# Existing capability\n\n## Requirements\n\n### Requirement: Existing behavior\nThe system SHALL preserve existing behavior.\n");
  fs.appendFileSync(path.join(project.root, "openspec/config.yaml"), "context: |\n  Preserve the project context.\nrules:\n  proposal:\n    - Preserve project rules.\n");
  fs.mkdirSync(project.agentDir, { recursive: true });
  fs.writeFileSync(path.join(project.agentDir, "evidence.txt"), "existing run evidence\n");
  inputs.push("openspec/changes/demo/agent-smith/evidence.txt");
  const before = inputs.map((file) => fs.readFileSync(path.join(project.root, file)));

  // Representative legacy headers and customized bodies exercise upstream's preservation branch.
  const legacy = [];
  for (const [workflow, name] of Object.entries(WORKFLOWS)) {
    const dir = path.join(project.root, ".claude/skills", name);
    fs.mkdirSync(dir, { recursive: true });
    const skill = `---\nname: ${name}\nlicense: MIT\nmetadata:\n  generatedBy: "1.16.1"\n---\n\nProject instruction for ${workflow}.\n`;
    fs.writeFileSync(path.join(dir, "SKILL.md"), skill);
    const command = path.join(project.root, ".claude/commands/opsx", `${workflow}.md`);
    fs.mkdirSync(path.dirname(command), { recursive: true });
    const text = `---\nname: "OPSX: ${workflow}"\n---\n\nProject command for ${workflow}.\n`;
    fs.writeFileSync(command, text);
    legacy.push({ dir, skill, command, text });
  }
  selectWorkflows(project, Object.keys(WORKFLOWS));
  const dryBefore = snapshot(project.root);
  const preview = cliJson(project, ["update", "--dry-run", "--json"]);
  assert.equal(preview.failures.length, 0);
  assert.ok(preview.changes.some((change) => change.path === ".agents/skills/openspec-verify-change/SKILL.md"));
  assert.deepEqual(snapshot(project.root), dryBefore, "dry-run writes nothing, including global configuration");
  cli(project, ["update"]);
  for (const item of legacy) {
    assert.equal(fs.readFileSync(path.join(item.dir, "SKILL.md"), "utf8"), item.skill);
    assert.equal(fs.readFileSync(item.command, "utf8"), item.text);
  }
  inputs.forEach((file, index) => assert.deepEqual(fs.readFileSync(path.join(project.root, file)), before[index], file));

  // Preserve customized material in a separately named project skill before removing old copies.
  const retained = path.join(project.root, ".agents/skills/project-context");
  fs.mkdirSync(retained, { recursive: true });
  const retainedText = legacy.map((item) => item.skill + "\n" + item.text).join("\n");
  fs.writeFileSync(path.join(retained, "SKILL.md"), retainedText);
  for (const item of legacy) {
    assert.deepEqual(fs.readdirSync(item.dir), ["SKILL.md"]);
    removeTree(item.dir);
    assert.equal(fs.readFileSync(item.command, "utf8"), item.text);
    fs.unlinkSync(item.command);
  }
  fs.rmdirSync(path.join(project.root, ".claude/commands/opsx"));
  fs.rmdirSync(path.join(project.root, ".claude/commands"));
  // Removing legacy discovery inputs requires selecting the tools again explicitly.
  cli(project, ["init", "--tools", "claude,codex", "--profile", "custom", "--no-animation"]);
  assertSharedSkills(project.root, Object.keys(WORKFLOWS));
  assert.equal(fs.readFileSync(path.join(retained, "SKILL.md"), "utf8"), retainedText);
  inputs.forEach((file, index) => assert.deepEqual(fs.readFileSync(path.join(project.root, file)), before[index], file));

  const stable = snapshot(project.root);
  assert.deepEqual(cliJson(project, ["update", "--dry-run", "--json"]).changes, []);
  cli(project, ["update"]);
  assert.deepEqual(snapshot(project.root), stable, "repeat update is idempotent");

  gitInit(project);
  git(project, ["add", "--", ".agents", ".claude", "openspec/config.yaml"]);
  git(project, ["commit", "-q", "-m", "test: preserve shared skills and links"]);
  const checkout = path.join(project.base, "fresh-checkout");
  const clone = spawnSync("git", ["clone", "--quiet", "--no-local", project.root, checkout], {
    cwd: project.root, env: gitEnv(project), encoding: "utf8", timeout: 30000,
  });
  assert.equal(clone.error, undefined, String(clone.error));
  assert.equal(clone.status, 0, clone.stderr);
  assertSharedSkills(checkout, Object.keys(WORKFLOWS));
});

const VALID_SPEC = "## ADDED Requirements\n\n### Requirement: Thing\n\nThe system SHALL do it.\n\n#### Scenario: Thing works\n- **WHEN** a thing is requested\n- **THEN** the system does it\n";

function validProject(id = "demo") {
  const project = makeOpenspecProject({ id, proposal: true, design: true, specs: 1, tasks: { done: 1 } });
  fs.writeFileSync(path.join(project.changeDir, "specs/cap-1/spec.md"), VALID_SPEC);
  fs.mkdirSync(project.agentDir, { recursive: true });
  fs.writeFileSync(path.join(project.agentDir, "evidence.txt"), "preserved run evidence\n");
  return project;
}

test("OpenSpec 2.0.0 validates artifacts and archives specs with the complete change directory", { skip }, () => {
  for (const id of ["demo", "2026-01-01-dated-demo"]) {
    const project = validProject(id);
    const validation = cliJson(project, ["validate", id, "--json"]);
    assert.equal(validation.items[0].valid, true);
    const original = snapshot(project.changeDir);
    const earliest = new Date().toLocaleDateString("en-CA");
    const archived = cliJson(project, ["archive", id, "--yes", "--json"]);
    const latest = new Date().toLocaleDateString("en-CA");
    assert.equal((archived.status ?? []).some((item) => item.severity === "error"), false);
    const names = id.startsWith("2026-") ? [id] : [`${earliest}-${id}`, `${latest}-${id}`];
    assert.ok(names.includes(archived.archive.archivedAs), archived.archive.archivedAs);
    const archiveDir = path.join(project.root, "openspec/changes/archive", archived.archive.archivedAs);
    assert.equal(path.resolve(project.root, archived.archive.path), archiveDir);
    assert.equal(fs.existsSync(project.changeDir), false);
    assert.deepEqual(snapshot(archiveDir), original);
    assert.match(fs.readFileSync(path.join(project.root, "openspec/specs/cap-1/spec.md"), "utf8"), /Requirement: Thing/);
    assert.equal(fs.readFileSync(path.join(archiveDir, "agent-smith/evidence.txt"), "utf8"), "preserved run evidence\n");
  }
});

test("OpenSpec 2.0.0 validation and archive collision failures preserve inputs and expose diagnostics", { skip }, () => {
  const invalid = makeOpenspecProject({ proposal: true, design: true, specs: 1, tasks: { done: 1 } });
  const before = snapshot(path.join(invalid.root, "openspec"));
  const validation = cliJson(invalid, ["validate", invalid.id, "--json"], 1);
  assert.equal(validation.items[0].valid, false);
  assert.ok(validation.items[0].issues.some((issue) => issue.level === "ERROR" && issue.message.includes("scenario")));
  const failure = cliJson(invalid, ["archive", invalid.id, "--yes", "--json"], 1);
  assert.equal(failure.archive, null);
  assert.ok(failure.status.some((item) => item.severity === "error" && item.code === "archive_validation_failed" && item.message));
  assert.deepEqual(snapshot(path.join(invalid.root, "openspec")), before);

  const collision = validProject("2026-01-01-collision");
  const target = path.join(collision.root, "openspec/changes/archive", collision.id);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "retained.txt"), "previous archive\n");
  const collisionBefore = snapshot(path.join(collision.root, "openspec"));
  const failed = cliJson(collision, ["archive", collision.id, "--yes", "--json"], 1);
  assert.equal(failed.archive, null);
  const diagnostic = failed.status.find((item) => item.code === "archive_target_exists");
  assert.equal(diagnostic?.severity, "error");
  assert.equal(typeof diagnostic.message, "string");
  assert.equal(Object.hasOwn(diagnostic, "fix"), false, "collision diagnostics can omit fix");
  assert.deepEqual(snapshot(path.join(collision.root, "openspec")), collisionBefore);
});
