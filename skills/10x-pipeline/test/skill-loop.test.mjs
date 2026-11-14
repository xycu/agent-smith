// Content check of the `## Anti-stall rules` section of SKILL.md. Its rule form is checked in rules.test.mjs.
// It also pins the `## Pull request (always)` section and its place in the done, archive and halt branches (ADR-017).
// SKILL_PATH overrides the file, for the deliberate-break check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../SKILL.md");
const skill = fs.readFileSync(process.env.SKILL_PATH || DEFAULT_PATH, "utf8");
const lines = skill.split("\n");

const HEADING = "## Anti-stall rules";

// The section: from its heading to the next `## ` heading.
function section() {
  const start = lines.findIndex((l) => l === HEADING);
  assert.ok(start >= 0, `no ${HEADING} section`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end);
}

// A SKILL.md loop branch: from the line starting `- **`<name>`**` to the next line that starts with `- **` or `## `.
// Local copy of the helper in pr-comment.test.mjs, which is not exported.
function branch(name, sourceLines = lines) {
  const start = sourceLines.findIndex((l) => l.startsWith(`- **\`${name}\`**`));
  assert.ok(start >= 0, `no ${name} branch`);
  let end = start + 1;
  while (end < sourceLines.length && !sourceLines[end].startsWith("- **") && !sourceLines[end].startsWith("## ")) end++;
  return sourceLines.slice(start, end).join("\n");
}

const NEEDLES = [
  ["launch notice instead of a final report", "end its turn", "Loop at step 3"],
  ["without `usage`", "`next`", "same turn"],
  ["**MUST**", "`usage`", "result file", "drop"],
  ["done", "archive", "halt", "still running"],
  ["tool output", "nothing is running"],
  ["did not launch", "**MUST NOT**", "result file", "`next`", "own report"],
];

test("the section holds exactly six rule lines, and SKILL.md has no other **GIVEN** line", () => {
  const rules = section().filter((l) => l.includes("**GIVEN**"));
  assert.equal(rules.length, 6);
  assert.equal(lines.filter((l) => l.includes("**GIVEN**")).length, 6);
});

test("rule line k holds the needles of behavior k", () => {
  const rules = section().filter((l) => l.includes("**GIVEN**"));
  NEEDLES.forEach((needles, k) => {
    for (const needle of needles) {
      assert.ok(rules[k] && rules[k].includes(needle), `rule ${k + 1} lacks "${needle}"`);
    }
  });
});

test("the section lies between ## Loop and ## PR comment (opt-in), outside every Loop branch", () => {
  const a = lines.indexOf("## Loop");
  const b = lines.indexOf(HEADING);
  const c = lines.indexOf("## PR comment (opt-in)");
  assert.ok(a >= 0 && a < b && b < c, "section is not between Loop and PR comment");
  for (const name of ["run", "done", "archive", "halt"]) {
    assert.ok(!branch(name).includes("**GIVEN**"), `${name} branch holds a rule line`);
  }
});

test("the run branch points at the anti-stall rules", () => {
  assert.ok(branch("run").includes("anti-stall rules"));
});

test("the section names no model, effort or tier", () => {
  assert.doesNotMatch(section().join("\n"), /\b(sonnet|opus|haiku|fable|effort|tier|model)\b/i);
});

// ---- Pull request (always), ADR-017 ---------------------------------------------------------

const PR_HEADING = "## Pull request (always)";

// A section by heading: from it to the next `## ` heading.
function sectionOf(heading) {
  const start = lines.findIndex((l) => l === heading);
  assert.ok(start >= 0, `no ${heading} section`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n");
}

test("the OPEN_PR line points at the open-pr script, which exists", () => {
  const line = lines.find((l) => l.startsWith("Pull request script: "));
  assert.ok(line && line.includes('`OPEN_PR="${CLAUDE_SKILL_DIR}/scripts/open-pr.mjs"`'), line);
  assert.ok(fs.statSync(path.resolve(path.dirname(DEFAULT_PATH), "scripts/open-pr.mjs")).isFile());
});

test("every script path names ${CLAUDE_SKILL_DIR}, and the old placeholder is gone", () => {
  assert.equal(skill.includes("<this skill's base directory>"), false);
  const dir = "${CLAUDE_SKILL_DIR}/";
  const router = lines.find((l) => l.startsWith("Router: "));
  assert.ok(router && router.includes('`ROUTER="' + dir + 'scripts/route.mjs"`'), router);
  const pr = lines.find((l) => l.startsWith("PR comment script: "));
  assert.ok(pr && pr.includes('`PR_COMMENT="' + dir + 'scripts/pr-comment.mjs"`'), pr);
  const tuning = lines.find((l) => l.includes("policy.json` holds the defaults"));
  assert.ok(tuning && tuning.startsWith("- `" + dir + "policy.json`"), tuning);
});

test("the pull request section follows ## PR comment (opt-in) and runs the script from the run root", () => {
  const c = lines.indexOf("## PR comment (opt-in)");
  const p = lines.indexOf(PR_HEADING);
  assert.ok(c >= 0 && p > c, "pull request section is not after the PR comment section");
  const text = sectionOf(PR_HEADING);
  assert.match(text, /`cd "<run root>" && node \$OPEN_PR <change-id>`/);
  assert.match(text, /Pull request: NOT pushed, <reason>\. Branch agent-smith\/<change-id> is local only: <manual>/);
  assert.match(text, /never merges/);
  assert.match(text, /isolation\.require: false/);
  assert.doesNotMatch(text, /\b(sonnet|opus|haiku|fable|effort|tier|tiers|model|low|medium|high|xhigh|max)\b/i);
  assert.ok(!text.includes("**GIVEN**"));
});

test("done, archive and halt run the pull request step before the PR comment step and before any STOP", () => {
  for (const name of ["done", "archive", "halt"]) {
    const text = branch(name);
    const pr = text.indexOf("do the pull request step");
    const comment = text.indexOf("do the PR comment step");
    assert.ok(pr >= 0, `${name} has no pull request step`);
    assert.ok(comment > pr, `${name}: the PR comment step is not after the pull request step`);
  }
  const archive = branch("archive");
  assert.match(archive, /\n {2}4\. Write no result file and do not call `next`/);
  assert.match(archive, /\n {2}5\. Run `cd "<run root>" && node \$ROUTER verify-archive/);
  const step5 = archive.slice(archive.indexOf("\n  5. "));
  assert.ok(step5.indexOf("do the pull request step") >= 0, "the pull request step is not in step 5");
  assert.ok(step5.indexOf("do the pull request step") < step5.indexOf("On `archived: false`"), "pull request step after the STOP of archived: false");
  assert.ok(!archive.slice(0, archive.indexOf("\n  5. ")).includes("PR comment step"), "the PR comment step is still before the move");
  const halt = branch("halt");
  assert.match(halt, /Before you STOP, do the pull request step\. When the terminal action has `prComment: true`/);
});

// ---- Late usage figure (ADR-019) -------------------------------------------------------------

test("done and halt call usage before the pull request step, and archive step 1 calls it before the subagent launch", () => {
  for (const name of ["done", "halt"]) {
    const text = branch(name);
    const call = text.indexOf("node $ROUTER usage <change-id> <n> --tokens N --tool-uses N --duration-ms N");
    assert.ok(call >= 0, `${name} has no usage call`);
    assert.ok(call < text.indexOf("do the pull request step"), `${name}: the usage call is not before the pull request step`);
    assert.match(text, /Usage: step <n> <attached\|not attached>/);
    assert.match(text, /no `orchestrator-error` result/);
  }
  const done = branch("done");
  assert.ok(done.indexOf("node $ROUTER usage <change-id> <n>") < done.indexOf("node $ROUTER status"), "done: the usage call is not before status");
  const archive = branch("archive");
  const call = archive.indexOf("node $ROUTER usage <change-id> <n> --tokens N");
  assert.ok(call >= 0, "archive has no usage call");
  assert.ok(call < archive.indexOf("node $ROUTER status"), "the usage call is not before status");
  assert.ok(call < archive.indexOf("\n  3. Call the Agent tool"), "the usage call is not before the archive subagent launch");
  assert.match(archive, /A figure that arrives after step 3 has launched the archive subagent is dropped\./);
});

test("the run branch points at rule 3 for a figure that arrives after next, and the Rules name usage as the one way in", () => {
  assert.match(branch("run"), /rule 3 of the anti-stall rules covers one that arrives after `next`/);
  assert.match(sectionOf("## Rules"), /`usage` command is the only way to add a usage figure to a logged step/);
});

test("the argument hint and Start step 1 name --rigor with its value and the goal text", () => {
  assert.ok(lines.some((l) => l.startsWith("argument-hint:") && l.includes("[--rigor <level>]")));
  const step = lines.find((l) => l.startsWith("1. Parse the arguments"));
  assert.ok(step, "no Start step 1");
  const sentence = step.split(". ").find((s) => s.includes("--rigor"));
  assert.ok(sentence, "no --rigor sentence in step 1");
  for (const w of ["--rigor=<level>", "goal text", "lean", "standard", "thorough"]) assert.ok(sentence.includes(w), w);
});

test("the Bash timeout line names the three scripts and `timeout: 600000`, outside the anti-stall section", () => {
  const hits = lines.filter((l) => l.startsWith("Bash timeout: "));
  assert.equal(hits.length, 1, "exactly one Bash timeout line");
  for (const needle of ["route.mjs", "open-pr.mjs", "pr-comment.mjs", "`timeout: 600000`"]) {
    assert.ok(hits[0].includes(needle), `Bash timeout line names ${needle}`);
  }
  assert.equal(lines.indexOf(hits[0]), lines.findIndex((l) => l.startsWith("Pull request script: ")) + 1);
  assert.ok(!section().includes(hits[0]), "not inside the anti-stall section");
});

// Written contracts only; live notification acceptance remains a Manual criterion.
for (const [chain, text, id] of [
  ["10x", skill, "change-id"],
  ["openspec", fs.readFileSync(process.env.OPENSPEC_SKILL_PATH || path.resolve(path.dirname(DEFAULT_PATH), "../openspec-pipeline/SKILL.md"), "utf8"), "change-name"],
]) {
  const dispatch = text.slice(text.indexOf("  2. For `provider:"), text.indexOf("     For `provider:"));
  const rules = text.slice(text.indexOf(HEADING), text.indexOf("## PR comment")).split("\n").filter((l) => l.includes("**GIVEN**"));
  test(`${chain}: numbered description and archive override record separate retry invocations`, () => {
    assert.ok(dispatch.includes(`description: "agent-smith <${id}> step <n> <step>"`));
    assert.ok(dispatch.includes(`override the description with \`agent-smith <${id}> archive\``));
    for (const needle of ["Record each invocation separately", "exact description, router `change`, `n` and `step`", "associate any returned agent id", "actual `n` for retries, including neutral retries", "preserve prior launch records even when descriptions repeat"]) assert.ok(dispatch.includes(needle), needle);
  });
  test(`${chain}: background flag is selected from the exposed schema before calling`, () => {
    assert.match(dispatch, /Inspect the exposed Agent schema before calling: when it declares `run_in_background`, set it to `false`; otherwise omit `run_in_background`/);
    assert.ok(dispatch.indexOf("Inspect the exposed Agent schema") < dispatch.indexOf("Call the Agent tool"));
    assert.doesNotMatch(dispatch, /`run_in_background: false`/);
  });
  test(`${chain}: rule 1 handles launch notices independently of the background flag`, () => {
    assert.match(rules[0], /Agent tool returns a launch notice instead of a final report \*\*THEN\*\*/);
    assert.match(rules[0], /end its turn and continue the Loop at step 3/);
    assert.match(rules[0], /existing process handle until it closes, without relaunching it/);
    assert.doesNotMatch(rules[0], /run_in_background/);
    assert.match(text, /archive subagent.*step 4/);
  });
  test(`${chain}: rule 6 rejects foreign, conflicting and superseded completion identities`, () => {
    for (const needle of [
      "direct result of the awaited Agent invocation", "notification matched to that invocation's recorded identity",
      "a known agent id selects its launch and any supplied description must agree",
      "otherwise the exact description must identify one recorded launch uniquely, with no conflict against its known id",
      "associate a newly supplied id when that unique launch has no recorded id",
      "another change", "earlier numbered step", "archive agent",
      "superseded invocation even when a neutral retry reuses its description",
      "ambiguous description-only notification matches no invocation",
      "writes no result file", "does not call `next`", "own report as the only result",
    ]) assert.ok(rules[5].includes(needle), needle);
  });
  test(`${chain}: on-time usage excludes earlier and foreign notifications without delaying next`, () => {
    for (const needle of [
      "Usage ownership in Loop step 4 follows the identity check in rule 6",
      "only from the current invocation's result or its matched notification",
      "earlier numbered step follows the late-usage path, even if already present when the current report arrives",
      "Leave unmatched or ambiguous figures unattached",
      "current report has no matched figure, omit `usage` and run `next` in the same turn under rule 2",
    ]) assert.ok(dispatch.includes(needle), needle);
    assert.match(rules[1], /without `usage`.*`next`.*same turn/);
  });
  for (const name of ["done", "archive", "halt"]) {
    test(`${chain}: ${name} late usage recovers the earlier numbered launch, not the latest repeated step`, () => {
      const paragraph = branch(name, text.split("\n"));
      for (const needle of [
        "Recover `<n>` from the earlier launch matched by rule 6",
        "a known agent id selects its launch and any supplied description must agree",
        "otherwise the exact description must identify one recorded launch uniquely, with no conflict against its known id",
        "associating a newly supplied id if that launch has none",
        "full router `change`, `n` and `step` identity against the recorded description",
        "printed `Step <n>` line is corroborating context",
        "never a guess from the latest step or a repeated step name",
        "Leave unmatched or ambiguous figures unattached", "Archive-agent usage belongs only in the final message",
        "once, as a call of its own, omitting a flag whose figure is missing", "A refusal exits 1",
      ]) assert.ok(paragraph.includes(needle), needle);
    });
  }
}
