// ci-runner: ci.yml runs on the TrueNAS runner with a fork fallback (ADR-020); release.yml stays hosted.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

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
