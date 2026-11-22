// The Codex rule file refuses publication forms. An in-test evaluator mirrors prefix_rule matching;
// when `codex execpolicy check` is installed the same table runs through it, so the evaluator cannot drift.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RULES = fileURLToPath(new URL("../../../.codex/rules/project.rules", import.meta.url));
const STRICTNESS = { allow: 0, prompt: 1, forbidden: 2 };

// Parses a pattern list: strings and nested alternation lists, e.g. ["git", "push", ["-f", "--force"]].
function parsePattern(text) {
  const tokens = [...text.matchAll(/\[([^\]]*)\]|"([^"]*)"/g)];
  return tokens.map(m => (m[1] === undefined ? m[2] : [...m[1].matchAll(/"([^"]*)"/g)].map(x => x[1])));
}

function loadRules(file = RULES) {
  const rules = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^prefix_rule\(pattern = \[(.*)\], decision = "(allow|prompt|forbidden)"/.exec(line);
    if (m) rules.push({ pattern: parsePattern(m[1]), decision: m[2] });
  }
  return rules;
}

function decide(rules, command) {
  let best = null;
  for (const { pattern, decision } of rules) {
    if (pattern.length > command.length) continue;
    const hit = pattern.every((p, i) => (Array.isArray(p) ? p.includes(command[i]) : p === command[i]));
    if (hit && (best === null || STRICTNESS[decision] > STRICTNESS[best])) best = decision;
  }
  return best;
}

const TABLE = [
  ["git push", "forbidden"],
  ["git push origin main", "forbidden"],
  ["git push origin main --force", "forbidden"],
  ["gh pr create", "forbidden"],
  ["gh pr merge 1", "forbidden"],
  ["gh pr view 1", "forbidden"],
  ["gh api repos/x/y", "forbidden"],
  ["gh release create v1", "forbidden"],
  ["gh repo create", "forbidden"],
  ["gh issue comment 1", "forbidden"],
  ["gh auth token", "forbidden"],
  ["gh workflow run x", "forbidden"],
  ["gh run list", "forbidden"],
  ["gh gist create", "forbidden"],
  ["gh secret set X", "forbidden"],
  ["gh --version", "forbidden"],
  ["gh -R a/b pr create", "forbidden"],
  ["git status", "allow"],
  ["git add -A", "allow"],
  ["git commit -m x", "allow"],
  ["git log", "allow"],
];

test("rule file has no allow for gh or git push", () => {
  const text = fs.readFileSync(RULES, "utf8");
  assert.doesNotMatch(text, /pattern = \["gh"\], decision = "allow"/);
  assert.doesNotMatch(text, /pattern = \["git", "push"\], decision = "allow"/);
  for (const { pattern, decision } of loadRules()) {
    if (decision === "allow") assert.notEqual(pattern[0], "gh");
  }
});

test("evaluator decides the publication table", () => {
  const rules = loadRules();
  for (const [command, expected] of TABLE) assert.equal(decide(rules, command.split(" ")), expected, command);
});

test("codex execpolicy check agrees with the table when Codex is installed", t => {
  const probe = spawnSync("codex", ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) return t.skip("codex is not installed");
  for (const [command, expected] of TABLE) {
    const r = spawnSync("codex", ["execpolicy", "check", "--rules", RULES, ...command.split(" ")], { encoding: "utf8" });
    assert.equal(r.status, 0, command + r.stderr);
    assert.equal(JSON.parse(r.stdout).decision, expected, command);
  }
});
