// release-gate: a release needs a green CI run of main, and no push to main loses its CI result (ADR-008, Amendment 1).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Comment lines are dropped: the header comments name the words under test (`push`).
const read = (name) =>
  fs
    .readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");
const release = read("release.yml");
const ci = read("ci.yml");

test("release.yml has no push or pull_request trigger", () => {
  assert.doesNotMatch(release, /^\s*push:/m);
  assert.doesNotMatch(release, /^\s*pull_request/m);
});

test("release.yml starts from a completed CI run of main", () => {
  const on = release.slice(release.indexOf("\non:"), release.indexOf("\npermissions:"));
  assert.match(on, /^ {2}workflow_run:/m);
  assert.match(on, /^\s+workflows: \[CI\]\s*$/m);
  assert.match(on, /^\s+types: \[completed\]\s*$/m);
  assert.match(on, /^\s+branches: \[main\]\s*$/m);
});

test("the release-please job runs only for a green CI run of a push that is still the head of main", () => {
  const job = release.slice(release.indexOf("\njobs:"));
  const cond = job.match(/^ {4}if:([\s\S]*?)^ {4}\S/m); // folded scalar: runs to the next job key
  assert.ok(cond, "the job needs an if:");
  for (const part of [
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.head_sha == github.sha",
  ]) assert.ok(cond[1].includes(part), `if: lacks ${part}`);
});

test("release.yml keeps its write permissions and a queueing concurrency group", () => {
  assert.match(release, /^permissions:\n {2}contents: write\n {2}pull-requests: write$/m);
  assert.match(release, /^\s+group: release-please\s*$/m);
  assert.match(release, /^\s+cancel-in-progress: false\s*$/m);
});

test("ci.yml still runs on pull requests and on pushes to main", () => {
  const on = ci.slice(ci.indexOf("\non:"), ci.indexOf("\npermissions:"));
  assert.match(on, /^ {2}pull_request:/m);
  assert.match(on, /^ {2}push:\n {4}branches: \[main\]$/m);
});

test("ci.yml cancels only superseded pull request runs and gives each push its own group", () => {
  assert.match(ci, /^\s+cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}\s*$/m);
  assert.match(ci, /^\s+group: ci-\$\{\{ github\.event_name == 'pull_request' && github\.ref \|\| github\.sha \}\}\s*$/m);
});

test("the workflow name release.yml waits for is the name of ci.yml", () => {
  const name = ci.match(/^name: (.+)$/m)[1].trim();
  const waits = release.match(/^\s+workflows: \[(.+)\]\s*$/m)[1].trim();
  assert.equal(waits, name);
});
