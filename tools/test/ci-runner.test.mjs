// ci-runner: ci.yml runs on the TrueNAS runner with a fork fallback (ADR-020); release.yml stays hosted.
// The first step of job `test` refuses uid 0 (ADR-020 D4); the tests pin its place and run its command.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { removeTree } from "../../skills/10x-pipeline/scripts/remove-tree.mjs";

const read = (name) => fs.readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8");
const EXPECTED =
  "runs-on: ${{ (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository) && 'ubuntu-latest' || fromJSON('[\"self-hosted\",\"linux\",\"truenas\"]') }}";

test("every job of ci.yml uses the self-hosted labels with the fork fallback", () => {
  const ci = read("ci.yml");
  const runsOn = ci.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("runs-on:"));
  const jobs = ci.slice(ci.indexOf("\njobs:")).split("\n").filter((l) => /^ {2}[\w-]+:\s*$/.test(l)).length;
  assert.equal(jobs, 2);
  assert.equal(runsOn.length, jobs);
  for (const line of runsOn) assert.equal(line, EXPECTED);
});

test("every job of ci.yml stops after 15 minutes", () => {
  const ci = read("ci.yml");
  const body = ci.slice(ci.indexOf("\njobs:"));
  const blocks = body.split(/\n(?= {2}[\w-]+:\s*\n)/).slice(1);
  assert.equal(blocks.length, 2);
  for (const block of blocks) assert.equal(block.match(/^ {4}timeout-minutes: 15$/gm)?.length, 1);
});

test("the job of pr-title.yml stops after 15 minutes", () => {
  assert.equal(read("pr-title.yml").match(/^ {4}timeout-minutes: 15$/gm)?.length, 1);
});

test("release.yml stays off self-hosted runners", () => {
  assert.doesNotMatch(read("release.yml"), /self-hosted/);
});

const testJob = () => {
  const ci = read("ci.yml");
  return ci.slice(ci.indexOf("\n  test:"), ci.indexOf("\n  commits:"));
};

test("the suite step uses the runner temporary directory", () => {
  const suite = testJob().split(/\n(?= {6}- )/).find((step) => step.startsWith("      - name: Test suite\n"));
  assert.ok(suite, "the test job contains the suite step");
  assert.match(suite, /^ {8}env:\n(?: {10}[^\n]*\n)*? {10}TMPDIR: \$\{\{ runner\.temp \}\}$/m);
});

test("the first step of job test is the uid guard, before the suite", () => {
  const job = testJob();
  const first = job.split("\n").find((l) => l.trimStart().startsWith("- "));
  assert.match(first, /name: Refuse to run as root \(ADR-020\)/);
  assert.ok(job.indexOf('test "$(id -u)" -ne 0') < job.indexOf("node --test"));
});

test("the uid guard command fails for uid 0 and passes for another uid", { skip: process.platform === "win32" }, () => {
  const line = testJob().split("\n").find((l) => l.includes('test "$(id -u)" -ne 0'));
  const cmd = line.slice(line.indexOf("run:") + 4).trim();
  const run = (uid) => spawnSync("sh", ["-c", `id() { echo ${uid}; }; ${cmd}`], { encoding: "utf8" });
  const root = run(0);
  assert.equal(root.status, 1);
  assert.match(root.stdout, /::error::/);
  assert.equal(run(1000).status, 0);
});

test("pr-title.yml has one runs-on line equal to the ci.yml expression", () => {
  const runsOn = read("pr-title.yml").split("\n").map((l) => l.trim()).filter((l) => l.startsWith("runs-on:"));
  assert.deepEqual(runsOn, [EXPECTED]);
});

test("the first step of pr-title.yml is the uid guard, before the commit-lint step", () => {
  const wf = read("pr-title.yml");
  const first = wf.split("\n").find((l) => l.trimStart().startsWith("- "));
  assert.match(first, /name: Refuse to run as root \(ADR-020\)/);
  assert.ok(wf.indexOf('test "$(id -u)" -ne 0') < wf.indexOf("commit-lint"));
});

const ROOT = new URL("../../", import.meta.url);
const HELPERS = new URL("../../skills/10x-pipeline/test/helpers.mjs", import.meta.url).href;
const CONTRACT = "skills/openspec-pipeline/test/openspec-contract.test.mjs";
const CONTRACT_NAMES = [
  "an empty change", "a proposal only", "proposal, specs and tasks without design",
  "all four files with mixed ticks", "rows in every list form and marker",
].map((name) => `status --chain openspec matches openspec instructions apply: ${name}`);

// Instrument only the availability boundary; real router subprocesses still read each fixture.
const PROBE_STUB = `
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
const original = childProcess.spawnSync;
let fixture = 0;
childProcess.spawnSync = (command, args, options) => {
  const selected = process.env.PROBE_TOOL === "git" ? "git" : process.env.OPENSPEC_BIN;
  if (command !== selected) return original(command, args, options);
  if (args[0] === "--version") {
    assert.deepEqual(args, ["--version"]);
    assert.equal(options.timeout, process.env.PROBE_TOOL === "git" ? 120000 : 20000);
    const result = { status: 0, signal: null, stdout: "1.16.1\\n", stderr: "" };
    switch (process.env.PROBE_RESULT) {
      case "missing": return original(command, args, options);
      case "exit": return { ...result, status: 17 };
      case "signal": return { ...result, status: null, signal: "SIGTERM" };
      case "timeout": return { ...result, status: null, signal: "SIGTERM", error: { code: "ETIMEDOUT" } };
      case "spawn": return { ...result, status: null, error: { code: "EACCES", message: "EACCES" } };
      case "ok": return result;
      default: throw new Error("unknown probe result");
    }
  }
  assert.deepEqual(args, ["instructions", "apply", "--change", "demo", "--json"]);
  const [state, total, complete] = [
    ["blocked", 0, 0], ["blocked", 0, 0], ["ready", 3, 0], ["ready", 3, 1], ["ready", 8, 2],
  ][fixture++];
  return { status: 0, stdout: JSON.stringify({ state, progress: { total, complete } }), stderr: "" };
};
syncBuiltinESMExports();
`;

function childEnv(overrides) {
  const env = { ...process.env, ...overrides };
  delete env.NODE_TEST_CONTEXT;
  if (overrides.CI === undefined) delete env.CI;
  return env;
}

for (const tool of ["git", "openspec"]) {
  test(`${tool} availability preserves local skips and requires successful probes in CI`, { timeout: 120000 }, () => {
    const parent = { ...process.env };
    const scratch = fs.mkdtempSync(new URL(".as-ci-probe-", ROOT));
    try {
      const preload = `${scratch}/probe.mjs`;
      fs.writeFileSync(preload, PROBE_STUB);
      for (const ci of [undefined, "", "1", "false"]) {
        for (const outcome of ["ok", "missing", "exit", "signal", "timeout", "spawn"]) {
          const selected = `${scratch}/selected-openspec`;
          const env = childEnv({ CI: ci, PROBE_TOOL: tool, PROBE_RESULT: outcome,
            OPENSPEC_BIN: selected, PATH: outcome === "missing" ? scratch : parent.PATH });
          const args = tool === "git"
            ? ["--import", preload, "--input-type=module", "-e",
              `import { gitAvailable } from ${JSON.stringify(HELPERS)}; console.log(gitAvailable());`]
            : ["--import", preload, "--test", "--test-reporter=tap", CONTRACT];
          const result = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: "utf8", timeout: 15000 });
          const output = `${result.stdout}\n${result.stderr}`;
          const label = `${tool}, CI=${ci}, ${outcome}\n${output}`;
          assert.equal(result.error, undefined, label);
          assert.equal(result.signal, null, label);
          const fails = Boolean(ci) && outcome !== "ok";
          if (fails) {
            assert.notEqual(result.status, 0, label);
            assert.ok(output.includes(tool === "git" ? "git --version" : selected), label);
          } else {
            assert.equal(result.status, 0, label);
            if (tool === "git") assert.equal(result.stdout.trim(), String(outcome === "ok"), label);
            else {
              for (const name of CONTRACT_NAMES) {
                const line = result.stdout.split("\n").find((line) => /^ok \d+ - /.test(line) && line.includes(name));
                assert.ok(line, label);
                assert.equal(line.includes("# SKIP"), outcome !== "ok", label);
              }
              assert.match(output, /# tests 5\b/, label);
            }
          }
          if (outcome !== "ok" && (fails || tool === "openspec")) {
            const diagnostic = { missing: /ENOENT/, exit: /exited 17/, signal: /SIGTERM/,
              timeout: tool === "git" ? /timed out after 120000 ms/ : /ETIMEDOUT/, spawn: /EACCES/ }[outcome];
            assert.match(output, diagnostic, label);
          }
        }
      }
      assert.deepEqual({ ...process.env }, parent);
    } finally {
      removeTree(scratch);
    }
  });
}
