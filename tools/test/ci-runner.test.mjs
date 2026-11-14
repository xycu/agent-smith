// ci-runner: ci.yml runs on the TrueNAS runner with a fork fallback (ADR-020); release.yml stays hosted.
// The first step of job `test` refuses uid 0 (ADR-020 D4); the tests pin its place and run its command.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
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

const installStep = () => testJob().split(/\n(?= {6}- )/)
  .find((step) => step.startsWith("      - name: Install OpenSpec contract CLI\n"));

test("CI installs and selects the pinned contract CLI between Node setup and the suite", () => {
  const job = testJob();
  const step = installStep();
  assert.ok(step);
  assert.ok(job.indexOf("uses: actions/setup-node@") < job.indexOf("- name: Install OpenSpec contract CLI"));
  assert.ok(job.indexOf("- name: Install OpenSpec contract CLI") < job.indexOf("- name: Test suite"));
  assert.match(step, /shell: bash/);
  assert.match(step, /OPENSPEC_TELEMETRY: "0"/);
  assert.match(step, /DO_NOT_TRACK: "1"/);
  assert.match(step, /git --version/);
  assert.match(step, /mktemp -d "\$RUNNER_TEMP\/openspec\.XXXXXX"/);
  assert.match(step, /npm_config_cache="\$prefix\/npm-cache"/);
  assert.match(step, /npm_config_userconfig="\$prefix\/npmrc"/);
  assert.match(step, /npm install --prefix "\$prefix" --no-save --package-lock=false @fission-ai\/openspec@1\.16\.1\n/);
  assert.match(step, /openspec="\$prefix\/node_modules\/\.bin\/openspec"/);
  assert.match(step, /version="\$\("\$openspec" --version\)"/);
  assert.match(step, /test "\$version" = "1\.16\.1"/);
  assert.match(step, /echo "OPENSPEC_BIN=\$openspec" >> "\$GITHUB_ENV"/);
});

test("the CI install step propagates failures and exports its own verified executable", { skip: process.platform === "win32" }, () => {
  const scratch = fs.mkdtempSync(new URL(".as-ci-install-", ROOT));
  try {
    const cli = `${scratch}/installed-cli`;
    fs.writeFileSync(cli, `#!/bin/sh\nprintf "%s\\n" "$STUB_VERSION"\nexit "$STUB_VERSION_EXIT"\n`, { mode: 0o755 });
    const ambient = `${scratch}/openspec`;
    fs.writeFileSync(ambient, `#!/bin/sh\necho ambient > "$AMBIENT_LOG"\necho 99.0.0\n`, { mode: 0o755 });
    const command = installStep().split("        run: |\n")[1].split("\n")
      .filter((line) => line.startsWith("          ")).map((line) => line.slice(10)).join("\n");
    const stubs = `
git() { test "$*" = "--version"; return "$STUB_GIT_EXIT"; }
npm() {
  printf '%s\\n' "$@" > "$NPM_LOG"
  test "$npm_config_cache" = "$3/npm-cache"
  test "$npm_config_userconfig" = "$3/npmrc"
  if test "$STUB_INSTALL_EXIT" != 0; then return "$STUB_INSTALL_EXIT"; fi
  mkdir -p "$3/node_modules/.bin"
  cp "$STUB_CLI" "$3/node_modules/.bin/openspec"
}
`;
    const exported = [];
    for (const [name, gitExit, installExit, versionExit, version, expected] of [
      ["git-fails", "3", "0", "0", "1.16.1", 3],
      ["install-fails", "0", "19", "0", "1.16.1", 19],
      ["version-fails", "0", "0", "7", "1.16.1", 7],
      ["wrong-version", "0", "0", "0", "2.0.0", 1],
      ["success", "0", "0", "0", "1.16.1", 0],
      ["fresh-prefix", "0", "0", "0", "1.16.1", 0],
    ]) {
      const envFile = `${scratch}/${name}.env`;
      const npmLog = `${scratch}/${name}.npm`;
      const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", stubs + command], {
        cwd: ROOT, encoding: "utf8", timeout: 15000,
        env: childEnv({ RUNNER_TEMP: scratch, GITHUB_ENV: envFile, NPM_LOG: npmLog,
          STUB_CLI: cli, STUB_GIT_EXIT: gitExit, STUB_INSTALL_EXIT: installExit,
          STUB_VERSION_EXIT: versionExit, STUB_VERSION: version,
          AMBIENT_LOG: `${scratch}/ambient.log`, PATH: `${scratch}:${process.env.PATH}` }),
      });
      assert.equal(result.error, undefined, `${name}: ${result.error}`);
      assert.equal(result.status, expected, `${name}: ${result.stdout}${result.stderr}`);
      assert.equal(fs.existsSync(`${scratch}/ambient.log`), false, name);
      if (expected === 0) {
        const selected = fs.readFileSync(envFile, "utf8").trim();
        assert.ok(selected.startsWith(`OPENSPEC_BIN=${scratch}/openspec.`), selected);
        assert.ok(selected.endsWith("/node_modules/.bin/openspec"), selected);
        assert.ok(fs.existsSync(selected.slice("OPENSPEC_BIN=".length)));
        assert.match(result.stdout, /OpenSpec 1\.16\.1/);
        const prefix = selected.slice("OPENSPEC_BIN=".length, -"/node_modules/.bin/openspec".length);
        assert.deepEqual(fs.readFileSync(npmLog, "utf8").trim().split("\n"),
          ["install", "--prefix", prefix, "--no-save", "--package-lock=false", "@fission-ai/openspec@1.16.1"]);
        exported.push(selected);
      } else {
        assert.equal(fs.existsSync(envFile), false, `${name}: failed setup must not publish a binary`);
        if (name === "git-fails") assert.equal(fs.existsSync(npmLog), false);
      }
    }
    assert.notEqual(exported[0], exported[1], "every setup uses a fresh prefix");
  } finally {
    removeTree(scratch);
  }
});

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
      const preloadUrl = pathToFileURL(preload).href;
      for (const ci of [undefined, "", "1", "false"]) {
        for (const outcome of ["ok", "missing", "exit", "signal", "timeout", "spawn"]) {
          const selected = `${scratch}/selected-openspec`;
          const env = childEnv({ CI: ci, PROBE_TOOL: tool, PROBE_RESULT: outcome,
            OPENSPEC_BIN: selected, PATH: outcome === "missing" ? scratch : parent.PATH });
          const args = tool === "git"
            ? ["--import", preloadUrl, "--input-type=module", "-e",
              `import { gitAvailable } from ${JSON.stringify(HELPERS)}; console.log(gitAvailable());`]
            : ["--import", preloadUrl, "--test", "--test-reporter=tap", CONTRACT];
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
