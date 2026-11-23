import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pluginPolicy } from "../scripts/state.mjs";
import { promptText, ruleTail } from "../scripts/flow.mjs";
import {
  cleanupAll, makeProject, init, run, planText, writeReview, writeLog, writeMetaFile, entry,
  gitInit, git, gitEnv, commitFiles,
} from "./helpers.mjs";
import { makeOpenspecProject, initOpenspec } from "../../openspec-pipeline/test/openspec-helpers.mjs";

after(cleanupAll);
const policy = pluginPolicy();
const invariants = [
  "git reset --hard", "git checkout -- <path>", "git restore", "git restore --staged", "git clean",
  "git stash drop", "git stash clear", "working-copy and staged-only", "preserve every affected version in a commit or ref",
  "refs/agent-smith/", "run.jsonl", "meta.json", "force-push", "rewrite pushed history", "--no-verify",
  "branch, tag, ref or worktree", "reachable from nowhere else", "repository, release, tag, issue or comment",
  "repository settings or branch protection", "merge the run pull request", "push", "call `gh`",
  "create or edit a pull request", "post PR/report comments", "equivalent APIs", "open-pr.mjs", "pr-comment.mjs",
  "orchestrator alone", "existing comment authorization", "local commit", "stricter step restrictions",
  // Never execute recursive deletion fixtures. These strings pin the prohibition itself.
  "rm -rf", "rm -r", "rm -R", "rm --recursive", "rim" + "raf", "find ... -delete", // Never execute these prohibited command fixtures.
  "fs.rm", "fs.rmSync", "fs.rmdir", "fs.rmdirSync", "recursive: true", "removeTree",
  "list its files", "check the list", "one by one", "deepest first",
  "one native child layer", "agent-smith:step", "delegated leaf", "no further delegation",
  "all applicable always-true, chain and step safety rules", "collect every launched child",
  "disjoint write ownership", "last-result.json", "signals.needsHuman",
];
function safety(prompt) {
  const end = prompt.lastIndexOf("\nRESULT:");
  assert.ok(end > 0);
  for (const text of invariants) {
    assert.ok(prompt.includes(text), `missing safety invariant ${text}`);
    assert.ok(prompt.indexOf(text) < end, text);
  }
  assert.match(prompt.split("\n").at(-1), /^RESULT: /);
}

for (const step of Object.keys(policy.steps)) {
  test(`${step} carries every shared safety invariant`, () => {
    safety(ruleTail(policy, { chain: step.startsWith("os-") ? "openspec" : "10x", step }));
  });
}

for (const [step, templates] of [
  ["plan", ["plan", "plan-revise", "plan-replan", "plan-rejected"]],
  ["plan-review", ["plan-review", "plan-review-confirm"]],
  ["os-propose", ["os-propose"]],
]) {
  for (const template of templates) {
    test(`${template} carries pre-publication planning acceptance`, () => {
      const text = promptText(policy, template) + "\n\n" + ruleTail(policy, {
        chain: step === "os-propose" ? "openspec" : "10x", step,
      });
      for (const phrase of ["before", "publication", "pushed branch", "open PR", "PR CI", "external PR comment", "Manual", "local fake Git/GitHub"]) {
        assert.ok(text.includes(phrase), `${template}: ${phrase}`);
      }
      if (step === "plan-review") {
        for (const phrase of ["phase Success Criteria", "canonical Progress", "move the row intact", "id, title and tick state", "plan brief", "distinct claim", "immutable", "signals.needsHuman"]) {
          assert.ok(text.includes(phrase), phrase);
        }
      }
    });
  }
}

for (const chain of ["10x", "openspec"]) {
  for (const byFile of [false, true]) {
    test(`${chain} real dispatch retains safety and planning rules under overrides, byFile=${byFile}`, () => {
      const step = chain === "10x" ? "plan" : "os-propose";
      const options = { policy: { prompts: { byFile, suffix: "Replaced suffix.", [step]: "Replaced planning template." } } };
      const p = chain === "10x" ? makeProject(options) : makeOpenspecProject(options);
      const action = (chain === "10x" ? init : initOpenspec)(p, "fix typo").json;
      assert.equal(action.action, "run", action.reason);
      assert.equal(action.step, step);
      const text = byFile ? fs.readFileSync(path.join(p.root, action.promptFile), "utf8") : action.prompt;
      safety(text);
      assert.match(text, /Replaced planning template/);
      assert.match(text, /local fake Git\/GitHub/);
      assert.match(text, /PR CI/);
    });
  }
  test(`${chain} real archive action retains safety under overrides`, () => {
    const policy = { agents: { restricted: true, steps: { archive: "custom:archive", "os-archive": "custom:archive" } } };
    const p = chain === "10x" ? makeProject({ policy, plan: planText({ done: 1 }) })
      : makeOpenspecProject({ policy, proposal: true, specs: 1, tasks: { done: 2, open: 0 }, verify: "Verdict: PASS\nCritical: 0\nWarnings: 0\n" });
    if (chain === "10x") {
      fs.writeFileSync(path.join(p.changeDir, "change.md"), "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
      writeReview(p, "plan-review", { verdict: "SOUND" });
      writeReview(p, "impl-review", { verdict: "APPROVED" });
      writeLog(p, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
    } else {
      writeLog(p, [entry(1, "os-apply", { template: "os-apply" }), entry(2, "os-verify", { review: { verdict: "PASS", critical: 0, warnings: 0 } })]);
    }
    writeMetaFile(p, { id: "demo", goal: "fix typo", chain, archive: true });
    gitInit(p);
    commitFiles(p, ["README.md"]);
    const action = run(p, ["next", p.id, "--chain", chain], { env: gitEnv(p) }).json;
    assert.equal(action.action, "archive", action.reason);
    assert.equal(action.agent, "agent-smith:step");
    safety(action.prompt);
  });
}

test("real isolated run carries safety before its final RESULT", () => {
  const main = makeProject({ policy: { isolation: { require: true } } });
  gitInit(main);
  git(main, ["add", "--", "context"]);
  git(main, ["commit", "-qm", "test: project"]);
  const root = path.join(main.base, ".claude/worktrees/agent-smith-demo");
  git(main, ["worktree", "add", "-qb", "agent-smith/demo", root]);
  const p = { ...main, root };
  const action = run(p, ["init", p.id, "--goal", "fix typo"], { env: gitEnv(p) }).json;
  assert.equal(action.action, "run", action.reason);
  safety(action.prompt);
  assert.ok(action.prompt.includes(root));
});
