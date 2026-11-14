// OpenSpec chain contract (ADR-013): what the router reads from an OpenSpec change folder must match what the
// OpenSpec CLI reports for it. For each fixture, `status --chain openspec` is compared with
// `openspec instructions apply --change <id> --json`: planningComplete equals `state !== "blocked"`, and the task
// counts equal progress.total and progress.complete. Only this test runs the CLI; the router never does.
// The binary is OPENSPEC_BIN or `openspec`; every test skips when it does not start.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cleanupAll, run } from "../../10x-pipeline/test/helpers.mjs";
import { makeOpenspecProject } from "./openspec-helpers.mjs";

after(cleanupAll);

const BIN = process.env.OPENSPEC_BIN ?? "openspec";

function probe() {
  const res = spawnSync(BIN, ["--version"], { encoding: "utf8", timeout: 20000 });
  if (res.error) return `${BIN} does not start (${res.error.code ?? res.error.message})`;
  if (res.status !== 0) return `${BIN} --version exited ${res.status}`;
  return false;
}
const skip = probe();

// The CLI's JSON answer for the change, run in the project with HOME in the scratch folder so it writes nothing
// outside it. The JSON starts at the first `{` (the CLI can print a notice before it).
function cliApply(project) {
  const res = spawnSync(BIN, ["instructions", "apply", "--change", project.id, "--json"], {
    cwd: project.root,
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, HOME: project.base, OPENSPEC_TELEMETRY: "0", DO_NOT_TRACK: "1" },
  });
  assert.equal(res.error, undefined, String(res.error));
  const start = res.stdout.indexOf("{");
  assert.ok(start >= 0, `no JSON from ${BIN}: ${res.stdout}${res.stderr}`);
  return JSON.parse(res.stdout.slice(start));
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
    const cli = cliApply(project);
    assert.ok(["blocked", "ready", "all_done"].includes(cli.state), `unknown state ${cli.state}`);
    assert.equal(ours.planningComplete, cli.state !== "blocked", `state ${cli.state}`);
    const total = cli.progress?.total ?? 0;
    const complete = cli.progress?.complete ?? 0;
    assert.equal(ours.tasks.total, total);
    assert.equal(ours.tasks.complete, complete);
  });
}
