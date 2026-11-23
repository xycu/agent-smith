// Content check of the `## Anti-stall rules` section of SKILL.md. Its rule form is checked in rules.test.mjs.
// It also pins the `## Pull request (always)` section and its place in the done, archive and halt branches (ADR-017).
// SKILL_PATH and OPENSPEC_SKILL_PATH override the files for deliberate-break checks.
import test from "node:test";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { removeTree } from "../scripts/remove-tree.mjs";
import { createHash } from "node:crypto";
import { pluginPolicy } from "../scripts/state.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../SKILL.md");
const skill = fs.readFileSync(process.env.SKILL_PATH || DEFAULT_PATH, "utf8");
const lines = skill.split("\n");

test("frontmatter requires explicit invocation and preserves user invocation", () => {
  assert.equal(lines[0], "---", "frontmatter opens on line 1");
  const end = lines.indexOf("---", 1);
  assert.ok(end > 0, "frontmatter closes");
  const block = lines.slice(1, end).join("\n");
  assert.equal([...block.matchAll(/^disable-model-invocation:/gm)].length, 1);
  assert.match(block, /^disable-model-invocation: true$/m);
  assert.doesNotMatch(block, /^user-invocable:/m);
  assert.match(block, /^name: 10x-pipeline$/m);
  const description = block.match(/^description: >\n((?:[ \t]+[^\n]*\n?)+)/m)?.[1];
  assert.ok(description, "folded description exists");
  assert.match(description, /10xDevs/);
  assert.match(description, /explicit.*\/agent-smith:10x-pipeline/s);
});

const REPO_ROOT = path.resolve(path.dirname(DEFAULT_PATH), "../..");
const readme = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");

test("plugin descriptions agree on the explicit pipeline entry point", () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, ".claude-plugin/plugin.json"), "utf8"));
  const marketplace = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, ".claude-plugin/marketplace.json"), "utf8"));
  assert.equal(plugin.description, marketplace.plugins[0].description);
  for (const pattern of [/10xDevs/, /OpenSpec/, /explicit slash commands/, /model and effort/]) {
    assert.match(plugin.description, pattern);
  }
});

test("README records Claude Code invocation compatibility and acceptance limits", () => {
  const start = readme.indexOf("### Claude Code invocation");
  assert.ok(start >= 0, "invocation guidance exists");
  const guidance = readme.slice(start, readme.indexOf("\n## ", start));
  for (const text of [
    "/agent-smith:10x-pipeline", "/agent-smith:openspec-pipeline",
    "disable-model-invocation: true", "pipeline this change", "claude -p", "/loop",
    "plain text", "Skill tool", "current user message", "after prose",
    "background work", "idle ceiling", "historical", "unverified", "pending",
    "https://code.claude.com/docs/en/skills#control-who-invokes-a-skill",
    "https://code.claude.com/docs/en/skills#where-you-write-the-skills-name",
    "https://code.claude.com/docs/en/headless#background-tasks-at-exit",
    "https://code.claude.com/docs/en/scheduled-tasks#run-a-prompt-repeatedly-with-loop",
  ]) assert.ok(guidance.includes(text), text);
});

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
  assert.match(text, /`cd "<run root>" && node "\$OPEN_PR" <change-id>`/);
  assert.match(text, /Pull request: NOT pushed, <reason>\. Branch <branch> is local only: <manual>/);
  assert.match(text, /never merges/);
  assert.match(text, /isolation\.require: false/);
  assert.doesNotMatch(text, /\b(sonnet|opus|haiku|fable|effort|tier|tiers|model|low|medium|high|xhigh|max)\b/i);
  assert.ok(!text.includes("**GIVEN**"));
});

test("done, archive and halt reach publication before STOP, with comments owned by publication", () => {
  for (const name of ["done", "archive", "halt"]) {
    const text = branch(name);
    assert.ok(text.includes("do the pull request step"), `${name}: publication reachable`);
    assert.ok(!text.includes("do the PR comment step"), `${name}: comment selection has one owner`);
    assert.ok(!text.includes("prComment: true"));
  }
  const archive = branch("archive");
  assert.match(archive, /\n {2}4\. Write no result file and do not call `next`/);
  assert.match(archive, /\n {2}5\. Run `cd "<run root>" && node "\$ROUTER" verify-archive/);
  const step5 = archive.slice(archive.indexOf("\n  5. "));
  assert.ok(step5.includes("do the pull request step"));
  assert.ok(step5.indexOf("do the pull request step") < step5.indexOf("On `archived: false`"));
  assert.match(branch("halt"), /Before you STOP, do the pull request step/);
  const publication = sectionOf(PR_HEADING);
  const open = publication.indexOf('node "$OPEN_PR"');
  const comment = publication.indexOf("do the PR comment step");
  assert.ok(open >= 0 && comment >= 0 && open < comment);
  assert.match(publication, /saved terminal intent applies even when publication skips or fails/);
});

// ---- Late usage figure (ADR-019) -------------------------------------------------------------

test("late usage has one owner and precedes terminal status, publication and archive launch", () => {
  const owner = sectionOf("## Late usage (before every end)");
  const call = 'node "$ROUTER" usage <change-id> <n> --usage-file <usage-file>';
  assert.equal(skill.split(call).length - 1, 1);
  assert.ok(owner.includes(call));
  assert.match(owner, /Usage: step <n> <attached\|not attached>/);
  assert.match(owner, /no `orchestrator-error` result/);
  for (const name of ["done", "halt", "archive"]) {
    const text = branch(name);
    const late = text.indexOf('follow "Late usage (before every end)"');
    assert.ok(late >= 0, `${name}: missing late-usage call site`);
    assert.equal(text.split('follow "Late usage (before every end)"').length - 1, 1);
    assert.ok(late < text.indexOf('node "$ROUTER" status'), `${name}: late usage before status`);
    assert.ok(late < text.indexOf("do the pull request step"), `${name}: late usage before publication`);
  }
  const archive = branch("archive");
  const cutoff = archive.indexOf("A figure that arrives after step 3 has launched the archive subagent is dropped.");
  const launch = archive.indexOf("\n  3. Call the Agent tool");
  assert.ok(cutoff >= 0 && cutoff < launch, "archive cutoff is visible before launch");
  assert.ok(archive.indexOf('follow "Late usage') < launch);
});

test("the run branch points at rule 3 for a figure that arrives after next, and the Rules name usage as the one way in", () => {
  assert.match(branch("run"), /Rule 3 of the anti-stall rules covers one that arrives after `next`/);
  assert.match(sectionOf("## Rules"), /`usage` command is the only way to add a usage figure to a logged step/);
});

test("the argument hint and Start step 1 name --rigor with its value and the goal text", () => {
  assert.ok(lines.some((l) => l.startsWith("argument-hint:") && l.includes("[--rigor <level>]")));
  const step = skill.slice(skill.indexOf("1. Parse the arguments"), skill.indexOf("\n2. "));
  assert.ok(step.includes("--rigor"));
  for (const w of ["--rigor=<level>", "goal text", "lean", "standard", "thorough", "forward only when supplied"]) assert.ok(step.includes(w), w);
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
      "use only the current invocation's matched records",
      "earlier numbered step follows the late-usage path",
      "Leave unmatched or ambiguous figures unattached",
      "Without a matched figure, attach unavailable evidence and proceed under rule 2 through the result-write gate",
      "native Agent `tool_use_id` as `runId`",
      "never derive them from a description",
    ]) assert.ok(dispatch.includes(needle), needle);
    assert.match(rules[1], /without `usage`.*`next`.*same turn/);
  });
  for (const name of ["done", "archive", "halt"]) {
    test(`${chain}: ${name} late usage recovers the earlier numbered launch, not the latest repeated step`, () => {
      const callSite = branch(name, text.split("\n"));
      assert.ok(callSite.includes('follow "Late usage (before every end)"'), `${name}: missing late-usage call site`);
      const paragraph = text.split("## Late usage (before every end)")[1].split("\n## ")[0];
      for (const needle of [
        "Recover `<n>` from the earlier launch matched by rule 6",
        "full router `change`, `n` and `step` identity against the recorded description",
        "printed `Step <n>` line is corroborating context",
        "never a guess from the latest step or a repeated step name",
        "Leave unmatched or ambiguous figures unattached", "Archive-agent usage belongs only in the final message",
        "once, as a call of its own", "--usage-file <usage-file>", "No verified total or no recorded invocation: omit the call",
        "Include no raw source paths or records", "Unlink the owned payload in a finally step", "A refusal exits 1",
      ]) assert.ok(paragraph.includes(needle), needle);
    });
  }
}

// Shared setup stays inside Start step 3, with explicit failure handling and the existing run safety rules.
test("Start step 3 consumes the shared setup result and retains run safety", () => {
  const start = skill.indexOf("\n3. Prepare run isolation");
  assert.ok(start >= 0);
  const setup = skill.slice(start, skill.indexOf("\n4. ", start));
  assert.ok(setup.includes('PREPARE_RUN="${CLAUDE_SKILL_DIR}/scripts/prepare-run.mjs"'));
  assert.ok(setup.includes("Under Codex, resolve"));
  assert.ok(setup.includes("Keep `PREPARE_RUN` absolute and quoted"));
  assert.ok(setup.includes('cd "<root>" && node "$PREPARE_RUN" <change-id>'));
  assert.ok(setup.includes("`timeout: 600000`"));
  for (const text of ["exactly one JSON object", "reason: null", "absolute `root` and `runRoot`",
    "nonzero exit", "missing/malformed JSON", "non-null `reason`", "STOP before `init`",
    "returned `root`", "`runRoot` as `<root>` and `<run root>`", "not in the run (uncommitted in the main checkout)",
    "An ordinary resume leaves the worktree inputs as they are", "retry from the original project root",
    'case: "reused"', "copied: true", 'cd "<run root>" && node "$ROUTER"', "<run root>/<resultFile>",
    "Never commit, stash, reset or clean", "refs/agent-smith/", "name their side refs",
    "List the files, check the list", "retained original paths", "before removing the worktree"]) {
    assert.ok(setup.includes(text), text);
  }
  assert.doesNotMatch(skill, /git worktree|\bcp -|\bmkdir -p|check-ignore|info\/exclude/);
  assert.ok(fs.existsSync(path.resolve(path.dirname(DEFAULT_PATH), "scripts/prepare-run.mjs")));
});

for (const [chain, source, id, selector] of [
  ["10x", skill, "change-id", ""],
  ["openspec", fs.readFileSync(process.env.OPENSPEC_SKILL_PATH || path.resolve(path.dirname(DEFAULT_PATH), "../openspec-pipeline/SKILL.md"), "utf8"), "change-name", " --chain openspec"],
]) {
  test(`${chain}: script invocations quote each script path`, () => {
    for (const name of ["ROUTER", "PR_COMMENT", "OPEN_PR"]) {
      assert.doesNotMatch(source, new RegExp(`\\bnode\\s+\\$(?:${name}\\b|\\{${name}\\})`), name);
      const calls = source.split("`").filter(span => span.includes(`node "$${name}"`));
      assert.ok(calls.length > 0, `missing quoted ${name} call`);
      if (name !== "ROUTER") assert.equal(calls.length, 1, `single ${name} call`);
      for (const call of calls) {
        if (call === `cd "<root>" && node "$ROUTER" verify-archive <${id}>${selector}`) continue;
        assert.ok(call.startsWith(`cd "<run root>" && node "$${name}" `), call);
      }
    }
  });

  test(`${chain}: documented commands run through spaced plugin and run-root paths`, t => {
    const scratch = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "skill commands-"));
    t.after(() => removeTree(scratch));
    const skillsDir = path.join(scratch, "plugin cache", "skills");
    const scripts = path.join(skillsDir, "10x-pipeline", "scripts");
    const runRoot = path.join(scratch, "run root");
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(path.join(skillsDir, `${chain}-pipeline`), { recursive: true });
    fs.mkdirSync(runRoot);
    const chainArgs = chain === "openspec" ? ["--chain", "openspec"] : [];
    const report = `openspec/changes/<${id}>/agent-smith/report.md`;
    const goal = "quote script paths";
    const commands = [
      ["ROUTER", "route.mjs", `init <${id}>${selector} --goal "<goal text>" --host <host> --pr-comment <true|false>`,
        ["init", "demo", ...chainArgs, "--goal", goal, "--host", "claude", "--pr-comment", "false"]],
      ["PR_COMMENT", "pr-comment.mjs", chain === "openspec" ? `<${id}> --report "${report}"` : `<${id}>`,
        chain === "openspec" ? ["demo", "--report", "openspec/changes/demo/agent-smith/report.md"] : ["demo"]],
      ["OPEN_PR", "open-pr.mjs", `<${id}>${selector}`, ["demo", ...chainArgs]],
    ];
    const snippets = source.split("`");
    for (const [name, file, args, expected] of commands) {
      const script = path.join(scripts, file);
      fs.writeFileSync(script, "console.log(JSON.stringify([process.cwd(), ...process.argv.slice(1)]));\n");
      const relative = chain === "openspec" ? "../10x-pipeline/scripts" : "scripts";
      const assignment = snippets.find(span => span === `${name}="\${CLAUDE_SKILL_DIR}/${relative}/${file}"`);
      const snippet = snippets.find(span => span === `cd "<run root>" && node "$${name}" ${args}`);
      assert.ok(assignment && snippet, `missing documented ${name} assignment or command`);
      let command = snippet.replace("<run root>", "$RUN_ROOT").replaceAll(`<${id}>`, "demo")
        .replace("<goal text>", goal).replace("<host>", "claude").replace("<true|false>", "false");
      if (name === "OPEN_PR") {
        const line = source.split("\n").find(line => line.includes(snippet));
        const reportOption = line.split("`").find(span => span === '--report "<archivePath>/agent-smith/report.md"');
        assert.ok(reportOption, "archived pull requests forward the report path");
        command += " " + reportOption.replace("<archivePath>", "archived demo");
        expected.push("--report", "archived demo/agent-smith/report.md");
      }
      const result = spawnSync("/bin/sh", ["-c", `${assignment}\n${command}`], {
        cwd: scratch, timeout: 5000, encoding: "utf8",
        env: { PATH: path.dirname(process.execPath), RUN_ROOT: runRoot, CLAUDE_SKILL_DIR: path.join(skillsDir, `${chain}-pipeline`) },
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), [runRoot, script, ...expected]);
    }
  });

  const start = source.slice(source.indexOf("## Start"), source.indexOf("## Loop"));
  const setup = start.slice(start.indexOf("\n3. "), start.indexOf("\n4. "));
  test(`${chain}: shared project gate failures report diagnostics and stop before init`, () => {
    assert.ok(setup.includes(`cd "<root>" && node "$PREPARE_RUN" <${id}>${selector}`));
    assert.match(setup, /nonzero exit, missing\/malformed JSON, invalid fields or non-null `reason`, show diagnostics and STOP before `init`/);
    assert.ok(setup.includes("retry from the original project root after resolving its diagnostic"));
    const fields = setup.match(/Parse exactly one JSON object and validate ([^.]+)\./)?.[1];
    assert.match(fields, /`runRoot`.*`reason`$/);
    assert.doesNotMatch(fields, /`base`/);
    assert.match(start.slice(start.indexOf("\n4. ")), /node "\$ROUTER" init /);
  });
  test(`${chain}: Claude Write preflight gates startup and owns its scratch cleanup`, () => {
    const probeAt = setup.indexOf("\n   - Claude Write preflight:");
    const missingCheck = setup.indexOf("Setup resolves resumes before this check");
    assert.ok(missingCheck >= 0 && probeAt > missingCheck, "probe follows live change and archive lookup");
    const followUp = setup.indexOf("\n   - Run every later router call", probeAt);
    assert.ok(followUp > probeAt && followUp < setup.indexOf("--cleanup"), "probe precedes init and source cleanup");
    const probe = setup.slice(probeAt, followUp);
    assert.match(probe, /before step 4 on the actual Claude host for fresh setup and resume, regardless of provider or isolation\. Codex skips it/);
    const changeDir = chain === "10x" ? "context/changes/<change-id>" : "openspec/changes/<change-name>";
    assert.ok(probe.includes("Resolve real paths and require `<run root>/" + changeDir + "` to be a directory strictly beneath the canonical run root"));
    assert.match(probe, /sole orchestration ownership after setup unlocks/);
    assert.match(probe, /inspect the run lock and its `\.takeover` guard read-only in the original TMPDIR/i);
    assert.match(probe, /Confirm settlement of any possibly active native session even if no lock exists/);
    assert.match(probe, /Stop on overlap, unresolved ownership, unreadable locks or `\.agent-smith-write-probe-\*` residue.*owner reconciliation/);
    assert.match(probe, /Use `mkdtemp` with that prefix in the live change directory, even before `agent-smith\/` exists/);
    assert.match(probe, /native Write for a unique inert marker at its absent absolute `write\.txt` path.*tool success and exact readback from a regular file.*Shell only prepares, verifies and cleans up/);
    assert.match(probe, /finally step, recheck the scratch directory's identity and location.*List and check entries, unlink only its regular probe file.*`rmdir` the owned empty directory.*earlier probes untouched/);
    assert.match(probe, /Write \(including unavailable or unconfirmed\) or cleanup failure.*absolute path, residue and bounded reason/);
    assert.match(probe, /different-worktree denial.*session with Write access to the selected root.*protected shared `\.claude\/` denial in the owning session/);
    assert.match(probe, /STOP before `init`, source cleanup, dispatch or publication\. Preserve worktree, branch, source inputs and run state/);
  });
  test(`${chain}: every numbered result goes through the result-write gate before next`, () => {
    const run = branch("run", source.split("\n"));
    const gateAt = run.indexOf("\n  5. Result-write gate.");
    const nextAt = run.indexOf('node "$ROUTER" next');
    assert.ok(gateAt > 0 && nextAt > gateAt, "one intake gate precedes the next command");
    const produce = run.slice(0, gateAt);
    assert.match(produce, /confirmed evidence that no step child launched[^\n]*"orchestrator-error"[^\n]*result-write gate in step 5/);
    assert.match(produce, /Apply Suspension STOP if launch or settlement is unresolved\. Treat settled launch failures[^\n]*as `unknown`/);
    assert.match(produce, /Before any result handling[^\n]*Apply the suspension STOP first/);
    assert.match(produce, /`completed: true`[^\n]*step 5 must write only `envelope\.result` unchanged/);
    assert.match(produce, /`completed: false` and `launched: true`[^\n]*`unknown`[^\n]*`usage` and `usageEvidence` when present to step 5/);
    assert.match(produce, /Only an envelope with `launched: false` permits an `orchestrator-error` result\. Pass that eligible prelaunch result to step 5 too/);
    assert.match(produce, /4\. For every Agent result[^\n]*Pass the normalized result to step 5/);
    const gate = run.slice(gateAt);
    assert.match(gate, /Result-write gate\. Suspension STOP takes precedence/);
    assert.match(gate, /exact normalized JSON bytes and launch or prelaunch refusal record in the original session.*host, absolute run root, chain, change, step number and name, and `neutralRetry\.count` \(zero initially\)/);
    assert.match(gate, /result parent to resolve to its expected directory beneath the canonical root.*`lstat` on the absolute `<run root>\/<resultFile>` path and accept only `ENOENT` as absence/);
    assert.match(gate, /On absence, use native Write on Claude without shell fallback, or Codex's local writer.*success, regular-file `lstat` and exact readback/);
    assert.match(gate, /Result-write STOP: on an unsafe path, present file, failed or unconfirmed write.*absolute result path, bounded reason and attempt identity.*Leave existing bytes untouched.*STOP before `next`, late `usage` or publication even under anti-stall rule 2/);
    assert.match(gate, /one authorized session on the recorded host.*Verify settlement, sole ownership, the same result parent and regular, non-symlink `meta\.json` and `run\.jsonl` before plain `status` in the saved root and chain/);
    assert.match(gate, /matching host and change, no `metadataProblem` or `logProblems`, and no terminal outcome in saved metadata \(`meta\.outcome`\).*latest executed pending row's number, name and `neutralRetries` \(absent means zero\).*Ignore skips and require `ok: null`/);
    assert.match(gate, /Attribute bytes to the originating record.*exact retained bytes through the host's writer only on confirmed absence.*matching regular file unchanged/);
    assert.match(gate, /Changed dispatch, lost payload, uncertain ownership, symlink, zero-byte or other conflict needs owner reconciliation/);
    assert.match(gate, /Resume at `next` without `init` or relaunching a completed child\. Verified prelaunch `orchestrator-error` reroutes neutrally/);
    assert.ok(gate.includes('Only then run `cd "<run root>" && node "$ROUTER" next <' + id + '>' + selector + '`'));
    const rule = source.slice(source.indexOf(HEADING)).split("\n").find(line => line.includes("no usage figure has arrived"));
    assert.match(rule, /run `next` in the same turn after step 5 confirms the write/);
  });
  test(`${chain}: actual branch reporting uses publication, saved setup and unavailable identity`, () => {
    const publication = source.split("## Pull request (always)")[1].split("\n## ")[0];
    assert.ok(setup.includes("name the branch from saved setup `branch`"));
    assert.ok(publication.includes("Use publication `branch`, else saved setup `branch`, else `unavailable` as `<branch>`"));
    assert.ok(publication.includes("pushes its validated branch without force"));
    assert.ok(publication.includes("(branch <branch>, pushed <true|false>)"));
    assert.ok(publication.includes("Pull request: NOT pushed, <reason>. Branch <branch> is local only: <manual>"));
    assert.match(publication, /On nonzero exit or no JSON object, print `Pull request: NOT pushed, script error\. Branch <branch> is local only/);
    assert.doesNotMatch(setup + publication, /agent-smith\/<change-(?:id|name)>/);
  });
  test(`${chain}: cleanup uses saved fresh setup after successful init and before each dispatch`, () => {
    for (const text of [
      "Save original setup JSON verbatim, independently of cleanup",
      "`case: created`, `copied: true`, `reason: null`",
      "after step 4 returns `action: run`, `done` or `archive`",
      "saved setup JSON verbatim on stdin", "Cleanup runs once",
      "before run launch", "run launch",
      "done reporting/PR handling", "archive dispatch",
      "Resumes and halted initialization skip cleanup", "Parse exactly one cleanup JSON object",
      "array of path strings in `left`", "Report nonempty `left` as retained original paths",
      "On diagnostics, nonzero exit, missing/malformed JSON or invalid fields",
      "Keep the initialized run root and continue", "`runRoot: null`",
      "name the branch", "retained original paths from `left` and cleanup diagnostics",
    ]) assert.ok(setup.includes(text), text);
    assert.ok(setup.includes(`cd "<root>" && node "$PREPARE_RUN" <${id}> --cleanup${selector}`));
    assert.match(setup, /--cleanup[^`]*` with the Bash tool and `timeout: 600000`/);
    assert.doesNotMatch(setup, /stale copy|remove or stash the main-checkout copy/);
  });
  test(`${chain}: change inputs follow root selection with original-root diagnostic fallback`, () => {
    const selection = setup.indexOf("Use returned `root` and `runRoot`");
    const check = setup.indexOf("After successful setup");
    assert.ok(selection >= 0 && check > selection);
    assert.match(setup.slice(check), /(?:`<run root>\/context\/changes\/.*?`|`openspec\/changes\/.*?` under `<run root>`) is missing/);
    for (const text of ["For `archived: true`, show its path and STOP", "For `ambiguous`, list folders for user selection and STOP",
      "STOP", "setup", "is absent",
      "Validate fresh sources before exclude/branch/worktree creation",
      "Setup resolves resumes before this check, even after complete source cleanup",
    ]) assert.ok(setup.includes(text), text);
    assert.ok(setup.includes(`cd "<root>" && node "$ROUTER" verify-archive <${id}>${selector}`));
    assert.ok(setup.includes(`cd "<run root>" && node "$ROUTER" verify-archive <${id}>${selector}`));
    const early = start.slice(0, start.indexOf("\n3. "));
    assert.doesNotMatch(early, /verify-archive|changes\/.* is missing/);
    if (chain === "10x") {
      assert.ok(early.includes("10x toolkit"));
      assert.ok(setup.includes("/10x-new <change-id>"));
    } else {
      assert.ok(early.includes("openspec/config.yaml"));
      assert.ok(early.includes("command -v openspec"));
      assert.ok(setup.includes("openspec new change <change-name>"));
      assert.ok(setup.includes("`--store`"));
    }
  });
}

test("both numbered dispatch loops forward file handoffs without loading the task", () => {
  for (const text of [skill, fs.readFileSync(path.join(REPO_ROOT, "skills/openspec-pipeline/SKILL.md"), "utf8")]) {
    const loop = text.split("## Loop")[1].split("## Anti-stall rules")[0];
    const step = loop.split("\n  2. ")[1].split("\n  3. ")[0];
    assert.match(step, /when `promptFile` exists, forward the router's short `prompt` verbatim/);
    assert.match(step, /Do not read, expand, edit or delete the task file/);
    assert.match(step, /child reads it and the router owns cleanup/);
    assert.match(step, /entire router action JSON on stdin/);
    assert.match(step, /Pass its exact prompt and dispatch unchanged/);
  }
});

for (const [chain, source] of [
  ["10x", skill],
  ["openspec", fs.readFileSync(process.env.OPENSPEC_SKILL_PATH || path.join(REPO_ROOT, "skills/openspec-pipeline/SKILL.md"), "utf8")],
]) {
  test(`${chain}: Anti-stall baseline retains the suspension STOP and covers both external transports`, () => {
    const start = source.indexOf(HEADING);
    const end = source.indexOf("\n## ", start + HEADING.length);
    assert.ok(start >= 0 && end > start);
    const digest = createHash("sha256").update(source.slice(start, end + 1)
      .replace("External execution waits", "OpenAI execution waits")
      .replace("a running external runner", "a running OpenAI runner")
      .replace(" after step 5 confirms the write", "")
      .replace("the suspension STOP for unresolved native ownership or ", "")).digest("hex");
    assert.equal(digest, "9d262e57b558c87ce54b3a258c9454b3eec2eb35b44cc3539a0d1047077b1d44");
  });
  test(`${chain}: routing literals stay in policy and reference`, () => {
    const policy = pluginPolicy();
    const words = new Set([...policy.ladder.flatMap((rung) => [rung.model, rung.effort]), "fable", "tier", "tiers"]);
    for (const word of words) assert.doesNotMatch(source, new RegExp(`\\b${word}\\b`, "i"), word);
    const tuning = source.slice(source.indexOf("## Tuning"));
    for (const text of ["policy.json", "context/foundation/agent-smith-policy.json", "deep-merges", "replaced whole", "rules/", "no override reaches them", "docs/REFERENCE.md"]) {
      assert.ok(tuning.includes(text), text);
    }
  });
}

test("AGENTS assigns routing documentation to the reference for both skills", () => {
  const agents = fs.readFileSync(path.join(REPO_ROOT, "AGENTS.md"), "utf8");
  assert.match(agents, /Both `skills\/10x-pipeline\/SKILL.md` and `skills\/openspec-pipeline\/SKILL.md` name no literal models, effort levels or tiers/);
  assert.match(agents, /When you change tier logic[^\n]*update the routing bullets in `docs\/REFERENCE.md`/);
  assert.doesNotMatch(agents, /update the "How the tier moves"/);
});

for (const [chain, source, ceiling] of [
  ["10x", skill, 32375],
  ["openspec", fs.readFileSync(process.env.OPENSPEC_SKILL_PATH || path.join(REPO_ROOT, "skills/openspec-pipeline/SKILL.md"), "utf8"), 36870],
]) {
  test(`${chain}: skill byte budget and single procedure owners`, () => {
    assert.ok(Buffer.byteLength(source, "utf8") <= ceiling, `${chain}: skill exceeds ${ceiling} bytes`);
    assert.equal(source.split("## Late usage (before every end)").length - 1, 1);
    assert.equal(source.split('node "$ROUTER" usage ').length - 1, 1);
    assert.equal(source.split("`prComment: true`").length - 1, 1);
    assert.equal(source.split("## PR comment (opt-in)").length - 1, 1);
  });
  test(`${chain}: split dispatch preserves fault, result and usage boundaries`, () => {
    const run = branch("run", source.split("\n"));
    for (const text of [
      "prelaunch refusal/error unrelated to the router's `agent`", "incomplete prompt handoff",
      "neither reply nor error", "Launch notices follow the anti-stall rules",
      "same step/prompt without a failed attempt", "Cut-off replies are also `unknown`",
      "Replace a child-authored `orchestrator-error` with `unknown`", "preserving other keys",
      "Preserve all keys, including `signals`", "<subagent_tokens>N</subagent_tokens>",
      "<tool_uses>N</tool_uses>", "<duration_ms>N</duration_ms>", "using exact figures only",
      "Omit missing usage without waiting", "foreground timeout never permits relaunch",
      "For absent/uncertain envelopes, inspect and wait", "before result/router mutation",
      "Runner and child must close before `next`, rollback or another launch",
    ]) assert.ok(run.includes(text), text);
  });
}

for (const [chain, source] of [
  ["10x", skill],
  ["openspec", fs.readFileSync(process.env.OPENSPEC_SKILL_PATH || path.join(REPO_ROOT, "skills/openspec-pipeline/SKILL.md"), "utf8")],
]) {
  test(`${chain}: setup retains field validation and isolated final-state diagnostics`, () => {
    const start = source.split("## Start")[1].split("## Loop")[0];
    const setup = start.split("\n3. ")[1].split("\n4. ")[0];
    for (const field of ["root", "runRoot", "worktree", "branch", "case", "copied", "excludeAdded", "notInRun", "left", "reason"]) {
      assert.ok(setup.includes(`\`${field}\``), field);
    }
    for (const text of ["invalid fields", "array of path strings in `notInRun`", "array of path strings in `left`",
      "committed: false", "pushed: false", "without `committed: true`", "or no JSON object",
      "report.md", "run.jsonl", "meta.json", "before the merge and before removing the worktree",
      "For either external runner", "fresh-child toolkit SKILL.md discovery", "Parent-session listing alone proves no child discovery",
      "authentication, trust and Git permissions", "without creating profiles or granting trust"]) {
      assert.ok(start.includes(text), text);
    }
  });
  test(`${chain}: terminal reporting retains verdict, proof and worktree obligations`, () => {
    const done = branch("done", source.split("\n"));
    const archive = branch("archive", source.split("\n"));
    const halt = branch("halt", source.split("\n"));
    assert.ok(halt.includes("halt action's `reason`"));
    for (const text of ["committed: false", "committed: true", "git show --stat HEAD", "Without `archive`", "Do not recover autonomously"]) assert.ok(halt.includes(text), text);
    assert.ok(archive.includes('"not committed (ignored by git)"'));
    assert.ok(archive.includes("assumptions"));
    assert.ok(archive.includes("usage"));
    assert.match(archive, /On `archived: false`.*subagent's note/);
    if (chain === "10x") {
      const report = source.split("## Final report")[1].split("\n## ")[0];
      for (const text of ["reason", "steps", "saved terminal action", "status", "manualPending", "manualUnproven",
        "uncommittedTicks", "manualUnprovenWhy", "manualNotProved", "/10x-lesson", "Start step 3", "retained-path", "uncommitted-state", "side refs"]) assert.ok(report.includes(text), text);
      assert.ok(done.includes('follow "Final report" using the done action and status output'));
      assert.ok(archive.includes('Follow "Final report" using the archive action\'s `summary` and status output'));
      assert.ok(archive.includes('Repeat the "Final report" checklist from the archive action\'s `summary`'));
    } else {
      const report = source.split("## Final report")[1].split("\n## ")[0];
      for (const text of ["reason", "steps", "task counts", "report", "verify.md", "saved terminal action", "status", "Start step 3"]) assert.ok(report.includes(text), text);
      assert.ok(done.includes('follow "Final report" using the done action and status output'));
      assert.ok(archive.includes('Follow "Final report" using the archive action\'s `summary` and status output'));
      assert.ok(archive.includes("summary.reason"));
      assert.ok(archive.includes("archivedAs"));
      assert.ok(archive.includes("archive_target_exists"));
    }
  });
}

for (const chain of ["10x", "openspec"]) {
  const source = fs.readFileSync(path.join(REPO_ROOT, `skills/${chain}-pipeline/SKILL.md`), "utf8");
  const onTime = source.split("\n  4. For every Agent result")[1].split("\n  5. ")[0];
  const late = source.split("## Late usage (before every end)")[1].split("\n## ")[0];
  test(`${chain}: enclosing report follows collection and failure reconciliation`, () => {
    assert.match(source, /Accept only the enclosing step report after it has collected every child and reconciled failures/);
    assert.match(source, /child notifications never complete the step/);
  });
  test(`${chain}: immediate accounting rejects final-request totals and always uses the shared reader`, () => {
    assert.match(source, /4\. For every Agent result, run/);
    assert.match(onTime, /node "\$CLAUDE_USAGE"/);
    assert.match(onTime, /never map it to `totalTokens`, even for a flat step/);
    assert.match(onTime, /Delete step-authored `usage` and `usageEvidence` before merging collector output/);
    assert.match(onTime, /independently measured tool\/duration figures at their documented scope/);
    assert.match(onTime, /Invocation matching proves attribution, not coverage/);
    assert.match(onTime, /Missing sources produce unavailable evidence through the same reader/);
    assert.match(onTime, /Omit missing usage without waiting/);
    assert.match(onTime, /bounded assumptions and evidence/);
  });
  test(`${chain}: bound capture checkpoints both native dispatches and carries the invocation into late collection`, () => {
    const dispatch = branch("run", source.split("\n"));
    const native = dispatch.split("\n").find(line => line.includes("use native Agent"));
    assert.match(native, /For `provider: "claude"` on host `claude`, use native Agent/);
    assert.match(native, /If `AGENT_SMITH_CLAUDE_CAPTURE` is present \(do not print its value\)/);
    const checkpoint = native.indexOf('node "$CLAUDE_USAGE" checkpoint');
    assert.ok(checkpoint >= 0 && checkpoint < native.indexOf("Call the Agent tool"));
    assert.match(native, /immediately before dispatch\. Retain its JSON for this invocation and proceed even if it is null/);
    assert.match(onTime, /observed host version and invocation IDs, the saved `checkpoint` for bound capture/);
    assert.match(late, /recheck under Loop step 4 once per settled native Agent step with missing tokens, a recorded invocation and either its original launcher binding or authorized explicit sources/);
    assert.match(late, /For bound capture use the same router identity, recorded host version and `usageEvidence.invocation` with no checkpoint/);
    assert.match(late, /Only for a newly verified total for the same recorded native invocation/);
    for (const name of ["done", "halt", "archive"]) {
      const terminal = branch(name, source.split("\n"));
      const latePass = terminal.indexOf('follow "Late usage (before every end)"');
      assert.ok(latePass >= 0 && latePass < terminal.indexOf('node "$ROUTER" status'), name);
      assert.ok(latePass < terminal.indexOf("do the pull request step"), name);
      if (name === "archive") {
        assert.ok(latePass < terminal.indexOf("\n  3. Call the Agent tool"));
        assert.match(terminal, /taking the checkpoint as in run step 2 immediately before dispatch/);
        assert.match(terminal, /collector once after settlement with router `n: null` and the archive step/);
      }
    }
  });
  test(`${chain}: late and archive accounting share collection without a second next or raw payload`, () => {
    assert.match(late, /under Loop step 4 once/);
    assert.match(late, /usage:\{totalTokens\},usageEvidence/);
    assert.match(late, /No verified total or no recorded invocation: omit the call/);
    assert.match(late, /Recorded numbers remain immutable/);
    assert.match(late, /identical source\/version\/invocation evidence/);
    assert.match(late, /Include no raw source paths or records/);
    assert.match(late, /create an exclusively owned unique transient run-root file/);
    assert.match(late, /Unlink the owned payload in a finally step before terminal handoff, including on refusal/);
    assert.match(late, /Never wait or poll/);
    assert.match(late, /Archive-agent usage belongs only in the final message, including its coverage limitation/);
    assert.doesNotMatch(late, /node "\$ROUTER" next|--tokens N/);
    assert.match(branch("archive", source.split("\n")), /Only for native Agent, apply Loop step 4.s collector/);
  });
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: unresolved native execution suspends before result intake and publication`, () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, `skills/${chain}-pipeline/SKILL.md`), "utf8");
    const stop = source.indexOf("Suspension STOP:");
    assert.ok(stop > 0 && stop < source.indexOf("- **`run`**"));
    for (const text of ["pending dispatch, saved prompt and existing result bytes", "read-only status",
      "signals.needsHuman", "same TMPDIR", "archive verification/dispatch", "late `usage`",
      "terminal publication/comment", "router-owned recovery", "foreground process has closed"]) {
      assert.ok(source.slice(stop, source.indexOf("- **`run`**")).includes(text), text);
    }
    assert.ok(source.indexOf("Before any result handling") < source.indexOf("With `completed: false`"));
    assert.match(source, /including `launched: false` and lock-related router halts/);
    assert.match(source, /Check the suspension STOP before archive verification or publication/);
    assert.match(source, /for example the suspension STOP for unresolved native ownership/);
  });
}
