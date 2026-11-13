// Content check of skills/openspec-pipeline/SKILL.md (ADR-013): frontmatter, the shared router path, --chain openspec on
// every router call, the anti-stall section copied from the 10x skill, no model alias, effort level or tier word, and
// the os- templates of policy.json resolving to prompt files. OPENSPEC_SKILL_PATH overrides the file, for the
// deliberate-break check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OS_SKILL_DIR = path.resolve(SKILL_DIR, "../openspec-pipeline");
const skill = fs.readFileSync(process.env.OPENSPEC_SKILL_PATH || path.join(OS_SKILL_DIR, "SKILL.md"), "utf8");
const lines = skill.split("\n");
const tenx = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf8").split("\n");
const POLICY = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));

const HEADING = "## Anti-stall rules";

// A section: from its heading to the next `## ` heading.
function section(all, heading) {
  const start = all.findIndex((l) => l === heading);
  assert.ok(start >= 0, `no ${heading} section`);
  let end = start + 1;
  while (end < all.length && !all[end].startsWith("## ")) end++;
  return all.slice(start, end);
}

// A loop branch: from the line starting `- **`<name>`**` to the next line that starts with `- **` or `## `.
function branch(name) {
  const start = lines.findIndex((l) => l.startsWith(`- **\`${name}\`**`));
  assert.ok(start >= 0, `no ${name} branch`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("- **") && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n");
}

// The fields of the first --- block; a `>` value takes the indented lines after it.
function frontmatter() {
  assert.equal(lines[0], "---", "frontmatter opens on line 1");
  const end = lines.indexOf("---", 1);
  assert.ok(end > 0, "frontmatter closes");
  const fields = {};
  let key = null;
  for (const line of lines.slice(1, end)) {
    const m = line.match(/^([a-z-]+):\s*(.*)$/);
    if (m) { key = m[1]; fields[key] = m[2] === ">" ? "" : m[2]; continue; }
    if (key && /^\s+/.test(line)) fields[key] = `${fields[key]} ${line.trim()}`.trim();
  }
  return fields;
}

// Rule form (ADR-004), as rules.test.mjs checks it: GIVEN, WHEN, THEN in order and one bold keyword after THEN.
const BOLD_KEYWORD = /\*\*(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY)\*\*/g;
function ruleProblems(line) {
  const problems = [];
  const given = line.indexOf("**GIVEN**");
  const when = line.indexOf("**WHEN**");
  const then = line.indexOf("**THEN**");
  if (!(given >= 0 && given < when && when < then)) problems.push("GIVEN, WHEN, THEN missing or out of order");
  const keywords = [...line.matchAll(BOLD_KEYWORD)];
  if (keywords.length !== 1) problems.push(`${keywords.length} bold keywords, expected 1`);
  else if (keywords[0].index < then) problems.push("keyword before THEN");
  const bare = line.replace(/\*\*[^*]+\*\*/g, " ").match(/\b(MUST|SHOULD|MAY|SHALL|REQUIRED|RECOMMENDED|OPTIONAL)\b/);
  if (bare) problems.push(`unbolded keyword ${bare[1]}`);
  return problems;
}

test("frontmatter names the skill openspec-pipeline with its argument hint", () => {
  const fields = frontmatter();
  assert.equal(fields.name, "openspec-pipeline");
  assert.equal(fields["argument-hint"], "<change-name> [goal text] [--archive] [--rigor <level>] [--pr-comment]");
  assert.match(fields.description, /OpenSpec/);
});

test("the router is the shared 10x-pipeline route.mjs, and it exists next to the skill folder", () => {
  const router = lines.filter((l) => l.startsWith("Router: "));
  assert.equal(router.length, 1);
  assert.ok(router[0].includes('`ROUTER="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/route.mjs"`'), router[0]);
  assert.ok(fs.statSync(path.resolve(OS_SKILL_DIR, "../10x-pipeline/scripts/route.mjs")).isFile());
  const pr = lines.find((l) => l.startsWith("PR comment script: "));
  assert.ok(pr && pr.includes('`PR_COMMENT="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/pr-comment.mjs"`'), pr);
  assert.ok(fs.statSync(path.resolve(OS_SKILL_DIR, "../10x-pipeline/scripts/pr-comment.mjs")).isFile());
  // No copy of the router in the skill folder (ADR-013 D1).
  assert.equal(fs.existsSync(path.join(OS_SKILL_DIR, "scripts")), false);
});

test("the old base-directory placeholder is gone and Tuning names policy.json through ${CLAUDE_SKILL_DIR}", () => {
  assert.equal(skill.includes("<this skill's base directory>"), false);
  const tuning = lines.find((l) => l.includes("policy.json` holds the defaults"));
  assert.ok(tuning && tuning.startsWith("- `${CLAUDE_SKILL_DIR}/../10x-pipeline/policy.json`"), tuning);
});

test("every router command line carries --chain openspec", () => {
  const calls = lines.filter((l) => l.includes("node $ROUTER"));
  assert.ok(calls.length >= 8, `expected the router calls, found ${calls.length}`);
  for (const line of calls) {
    // Each `node $ROUTER` occurrence on the line is followed by --chain openspec before the closing backtick.
    for (const m of line.matchAll(/node \$ROUTER[^`]*/g)) assert.match(m[0], /--chain openspec/, line);
  }
  for (const cmd of ["init", "next", "status", "usage", "verify-archive"]) {
    assert.ok(calls.some((l) => l.includes(`node $ROUTER ${cmd} `)), `no ${cmd} call`);
  }
  assert.ok(calls.some((l) => /verify-archive <change-name> --chain openspec --path <archivePath>/.test(l)), "verify-archive with --path");
});

test("the anti-stall section equals the one of the 10x skill and follows the rule form", () => {
  assert.deepEqual(section(lines, HEADING), section(tenx, HEADING));
  const rules = section(lines, HEADING).filter((l) => l.includes("**GIVEN**"));
  assert.equal(rules.length, 6);
  assert.equal(lines.filter((l) => l.includes("**GIVEN**")).length, 6, "no other **GIVEN** line in the skill");
  for (const rule of rules) assert.deepEqual(ruleProblems(rule), [], rule);
});

test("the anti-stall section lies between ## Loop and ## PR comment (opt-in), and the steps it names exist", () => {
  const a = lines.indexOf("## Loop");
  const b = lines.indexOf(HEADING);
  const c = lines.indexOf("## PR comment (opt-in)");
  assert.ok(a >= 0 && a < b && b < c, "section is not between Loop and PR comment");
  for (const name of ["run", "done", "archive", "halt"]) {
    assert.ok(!branch(name).includes("**GIVEN**"), `${name} branch holds a rule line`);
  }
  assert.ok(branch("run").includes("anti-stall rules"));
  // Rule 1 continues the Loop at step 3 of `run` and at step 4 of `archive`.
  assert.match(branch("run"), /\n {2}3\. Find the last line of the subagent's reply that starts with `RESULT:`/);
  assert.match(branch("archive"), /\n {2}4\. Write no result file and do not call `next`/);
});

test("the skill names no model alias, effort level or tier word", () => {
  const models = [...new Set(POLICY.ladder.map((rung) => rung.model))];
  const efforts = [...new Set(POLICY.ladder.map((rung) => rung.effort))];
  assert.ok(models.length >= 3 && efforts.length >= 3);
  for (const word of [...models, "fable", ...efforts, "tier", "tiers"]) {
    assert.doesNotMatch(skill, new RegExp(`\\b${word}\\b`, "i"), word);
  }
  // The dispatch passes the router's values; no literal is hard-coded.
  assert.ok(lines.some((l) => l.includes("`model: <model>`, `effort: <effort>`")));
});

test("every os- step has a template, and every os- template resolves to existing prompt files", () => {
  const steps = Object.keys(POLICY.steps).filter((k) => k.startsWith("os-"));
  assert.deepEqual(steps.sort(), ["os-apply", "os-archive", "os-propose", "os-verify"]);
  const templates = Object.keys(POLICY.prompts).filter((k) => k.startsWith("os-"));
  for (const step of steps) assert.ok(templates.includes(step), `no template ${step}`);
  assert.ok(templates.includes("os-apply-fix"));
  for (const name of templates) {
    const parts = Array.isArray(POLICY.prompts[name]) ? POLICY.prompts[name] : [POLICY.prompts[name]];
    const refs = parts.map((part) => String(part).match(/^@prompts\/([A-Za-z0-9._-]+\.md)$/)).filter(Boolean);
    assert.ok(refs.length >= 1, `${name} references no prompt file`);
    for (const [, file] of refs) assert.ok(fs.statSync(path.join(SKILL_DIR, "prompts", file)).isFile(), `${name}: ${file}`);
  }
  assert.ok(POLICY.prompts["os-apply-fix"].join("\n").includes("{findings}"));
});

// ---- Pull request (always), ADR-017 ---------------------------------------------------------

const PR_HEADING = "## Pull request (always)";

test("the OPEN_PR line points at the shared open-pr script, which exists", () => {
  const line = lines.find((l) => l.startsWith("Pull request script: "));
  assert.ok(line && line.includes('`OPEN_PR="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/open-pr.mjs"`'), line);
  assert.ok(fs.statSync(path.resolve(OS_SKILL_DIR, "../10x-pipeline/scripts/open-pr.mjs")).isFile());
  // The PR comment line keeps its shape.
  assert.ok(lines.some((l) => l.startsWith("PR comment script: ")));
});

test("the pull request section follows ## PR comment (opt-in) and calls the script with --chain openspec", () => {
  const c = lines.indexOf("## PR comment (opt-in)");
  const p = lines.indexOf(PR_HEADING);
  assert.ok(c >= 0 && p > c, "pull request section is not after the PR comment section");
  const text = section(lines, PR_HEADING).join("\n");
  assert.match(text, /`cd "<run root>" && node \$OPEN_PR <change-name> --chain openspec`/);
  for (const m of skill.matchAll(/node \$OPEN_PR[^`]*/g)) assert.match(m[0], /--chain openspec/, m[0]);
  assert.match(text, /Pull request: NOT pushed, <reason>\. Branch agent-smith\/<change-name> is local only: <manual>/);
  assert.match(text, /never merges/);
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
  const step5 = archive.slice(archive.indexOf("\n  5. "));
  assert.ok(step5.indexOf("do the pull request step") >= 0, "the pull request step is not in step 5");
  assert.ok(step5.indexOf("do the pull request step") < step5.indexOf("On `archived: false`"), "pull request step after the STOP of archived: false");
  assert.ok(!archive.slice(0, archive.indexOf("\n  5. ")).includes("PR comment step"), "the PR comment step is still before the move");
  assert.match(branch("halt"), /Before you STOP, do the pull request step\. Then, when the output has `prComment: true`, do the PR comment step\./);
});

test("done, halt and archive call usage with --chain openspec before the pull request step or the archive subagent launch", () => {
  const call = "node $ROUTER usage <change-name> <n> --tokens N --tool-uses N --duration-ms N --chain openspec";
  for (const name of ["done", "halt"]) {
    const text = branch(name);
    assert.ok(text.includes(call), `${name} has no usage call`);
    assert.ok(text.indexOf(call) < text.indexOf("do the pull request step"), `${name}: usage call after the pull request step`);
  }
  const done = branch("done");
  assert.ok(done.indexOf(call) < done.indexOf("node $ROUTER status"), "done: usage call after status");
  const archive = branch("archive");
  assert.ok(archive.includes(call), "archive has no usage call");
  assert.ok(archive.indexOf(call) < archive.indexOf("\n  3. Call the Agent tool"), "usage call after the archive subagent launch");
  assert.match(archive, /A figure that arrives after step 3 has launched the archive subagent is dropped\./);
});

test("the argument hint and Start step 1 name --rigor with its value and the goal text", () => {
  assert.ok(lines.some((l) => l.startsWith("argument-hint:") && l.includes("[--rigor <level>]")));
  const step = lines.find((l) => l.startsWith("1. Parse the arguments"));
  assert.ok(step, "no Start step 1");
  const sentence = step.split(". ").find((s) => s.includes("--rigor"));
  assert.ok(sentence, "no --rigor sentence in step 1");
  for (const w of ["--rigor=<level>", "goal text", "lean", "standard", "thorough"]) assert.ok(sentence.includes(w), w);
});

test("the Bash timeout line names the three scripts and `timeout: 600000`, outside the anti-stall section, equal to the 10x copy", () => {
  const hits = lines.filter((l) => l.startsWith("Bash timeout: "));
  assert.equal(hits.length, 1, "exactly one Bash timeout line");
  for (const needle of ["route.mjs", "open-pr.mjs", "pr-comment.mjs", "`timeout: 600000`"]) {
    assert.ok(hits[0].includes(needle), `Bash timeout line names ${needle}`);
  }
  assert.equal(lines.indexOf(hits[0]), lines.findIndex((l) => l.startsWith("Pull request script: ")) + 1);
  assert.ok(!section(lines, HEADING).includes(hits[0]), "not inside the anti-stall section");
  assert.equal(hits[0], tenx.find((l) => l.startsWith("Bash timeout: ")));
});
