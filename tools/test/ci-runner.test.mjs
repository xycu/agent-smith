// ci-runner: ci.yml runs on the TrueNAS runner with a fork fallback (ADR-020); release.yml stays hosted.
// The first step of job `test` refuses uid 0 (ADR-020 D4); the tests pin its place and run its command.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

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

test("release.yml stays off self-hosted runners", () => {
  assert.doesNotMatch(read("release.yml"), /self-hosted/);
});

const testJob = () => {
  const ci = read("ci.yml");
  return ci.slice(ci.indexOf("\n  test:"), ci.indexOf("\n  commits:"));
};

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
