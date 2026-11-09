#!/usr/bin/env node
// Router for /agent-smith:10x-pipeline.
// Decides the next step, model and effort from disk artifacts (plan.md Progress,
// review verdicts) plus the run log. The orchestrator never picks a model itself.
//
// Usage (run from the project root):
//   node route.mjs init   <change-id> [--goal "<text>"] [--rigor lean|standard|thorough] [--archive] [--chrome [false]]   # Chrome is on unless --chrome false
//   node route.mjs next   <change-id>        # consumes context/changes/<id>/agent-smith/last-result.json
//   node route.mjs risk   <change-id>        # read-only: churn hot paths, plan hits, diff hits
//   node route.mjs status <change-id> [--report]   # --report (re)writes agent-smith/report.md
//   node route.mjs verify-archive <change-id> [--path <p>]   # read-only: is the change archived (files only, no git)
//   node route.mjs compare <change-id> --baseline <dir> [--routed <dir>] [--format md] [--unpinned]   # read-only: usage of a routed run against a baseline run
//                                      # --unpinned: the baseline is a routed run too (scorer off), for the scorer A/B
//
// Policy: <skill>/policy.json, deep-merged with context/foundation/agent-smith-policy.json if present.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  SKILL_DIR, ROOT, out, parseFlags, readJson, loadPolicy, mtime, readPlan, archiveDirs, frontmatterField,
  guardArchived, paths, readLog, executed, readMeta, writeLog, isFailure, budgetSteps, isObject, rigorLevels,
  maxLevel, resolveRigor, SHA_RE, runGit, gitOut, ignoredProbePaths, measureRisk, riskMeasured, scoreConfig, halt,
} from "./state.mjs";
import { artifactFile, scoreSummary } from "./preplan.mjs";
import { beforeExtra, doneNotes, manualRows, tierFor, render } from "./steps.mjs";
import {
  writeReport, finishRun, endRun, lessonLimits, attachResult, decide, promptText, checkPrompts, artifactsLine,
  stepAgent, advisorOn,
} from "./flow.mjs";

// ---- run provenance -------------------------------------------------------------

// What a run ran with: the plugin version, one hash per merged-policy section (prompts by resolved text), a hash of the
// plugin's agent definitions and the flags in force. Recorded once in meta.json and read by compare. Every input is
// only read; computing the record never throws, so it never halts init or next.
const PLUGIN_ROOT = path.resolve(SKILL_DIR, "../..");
const PROVENANCE_DEFAULTS = { ignore: ["compare", "provenance"], expected: { pinned: ["ladder", "rigor", "score"], unpinned: ["score"] } };

// The provenance block of the policy. A list that is not an array of strings reads as the shipped default.
function provenanceConfig(policy) {
  const c = isObject(policy?.provenance) ? policy.provenance : {};
  const e = isObject(c.expected) ? c.expected : {};
  const list = (v, fallback) => (Array.isArray(v) && v.every((s) => typeof s === "string") ? v : fallback);
  return {
    ignore: list(c.ignore, PROVENANCE_DEFAULTS.ignore),
    expected: { pinned: list(e.pinned, PROVENANCE_DEFAULTS.expected.pinned), unpinned: list(e.unpinned, PROVENANCE_DEFAULTS.expected.unpinned) },
  };
}

// JSON with the keys of every object sorted, so key order never changes a hash.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

const hash16 = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);

// The resolved text of every template, keyed by template. null when a reference does not resolve: checkPrompts
// halts at next for that, as before.
function promptsHash(policy) {
  const texts = {};
  try {
    for (const template of Object.keys(isObject(policy.prompts) ? policy.prompts : {})) texts[template] = promptText(policy, template);
  } catch { return null; }
  return hash16(canonicalJson(texts));
}

// The <plugin root>/agents/*.md files, keyed by file name. null when the folder is missing or a file is unreadable.
function agentFilesHash() {
  const dir = path.join(PLUGIN_ROOT, "agents");
  try {
    const files = {};
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory() && d.name.endsWith(".md")) files[d.name] = fs.readFileSync(path.join(dir, d.name), "utf8");
    }
    return hash16(canonicalJson(files));
  } catch { return null; }
}

// The version of the plugin manifest, only read (release-please owns it). null when the file is unreadable.
function pluginVersion() {
  const manifest = readJson(path.join(PLUGIN_ROOT, ".claude-plugin/plugin.json"), null);
  return isObject(manifest) && typeof manifest.version === "string" ? manifest.version : null;
}

// One hash per section of the merged policy except the ignored ones, plus agentFiles, sorted by name.
function provenanceSections(policy) {
  const ignore = new Set(provenanceConfig(policy).ignore);
  const sections = {};
  for (const key of Object.keys(policy)) {
    if (!ignore.has(key)) sections[key] = key === "prompts" ? promptsHash(policy) : hash16(canonicalJson(policy[key]));
  }
  sections.agentFiles = agentFilesHash();
  return Object.fromEntries(Object.entries(sections).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// The flags in force. A flag the policy lacks or malforms reads false; archive and chrome come from meta.json, and chrome
// records the effective setting: on unless meta.chrome is false.
function provenanceFlags(policy, meta) {
  const minRigor = isObject(policy.score) ? policy.score.minRigor : null;
  return {
    archive: meta.archive === true,
    chrome: meta.chrome !== false,
    "score.minRigor": typeof minRigor === "string" ? minRigor : null,
    "agents.restricted": isObject(policy.agents) && policy.agents.restricted === true,
    "advisor.enabled": isObject(policy.advisor) && policy.advisor.enabled === true,
  };
}

// The record init stores. null only if something unexpected throws: a run then has no record and reads as unknown.
function provenanceRecord(policy, meta) {
  try {
    return { schemaVersion: 1, plugin: pluginVersion(), sections: provenanceSections(policy), flags: provenanceFlags(policy, meta) };
  } catch { return null; }
}

// Adds every section whose hash differs from the record to provenance.drift (sorted, each name once, omitted while
// empty). The recorded hashes are never touched, and a run without a record gets none. Returns true when drift
// changed, so the caller writes meta.json. plugin and flags are not drift-tracked.
function recordDrift(meta, policy) {
  const rec = meta.provenance;
  if (!isObject(rec) || !isObject(rec.sections)) return false;
  try {
    const ignore = new Set(provenanceConfig(policy).ignore);
    const now = provenanceSections(policy);
    const had = Array.isArray(rec.drift) ? rec.drift.filter((s) => typeof s === "string") : [];
    const changed = [...new Set([...Object.keys(rec.sections), ...Object.keys(now)])]
      .filter((name) => !ignore.has(name) && rec.sections[name] !== now[name]);
    const drift = [...new Set([...had, ...changed])].sort();
    const old = JSON.stringify(rec.drift);
    if (drift.length) rec.drift = drift;
    else delete rec.drift;
    return JSON.stringify(rec.drift) !== old;
  } catch { return false; }
}

// The provenance warnings of a compare pair, in the order of `sides`. Two sides without a record stay silent (two runs
// from before provenance existed). A name of `expected` exempts that section, and a flag whose first dot segment it
// names. Warnings only: they never change comparable, reasons or the verdict.
function provenanceWarnings(sides, expected) {
  const warnings = [];
  const missing = sides.filter(([, rec]) => rec === null);
  if (missing.length === 1) warnings.push(`provenance-unknown:${missing[0][0]}`);
  if (!missing.length) {
    const [b, r] = sides.map(([, rec]) => rec);
    const exempt = new Set(expected);
    const differ = (x, y) => canonicalJson(x ?? null) !== canonicalJson(y ?? null);
    const keyed = (rec, key) => (isObject(rec[key]) ? rec[key] : {});
    const names = (key) => [...new Set([...Object.keys(keyed(b, key)), ...Object.keys(keyed(r, key))])];
    const sections = names("sections").filter((n) => !exempt.has(n) && differ(keyed(b, "sections")[n], keyed(r, "sections")[n]));
    if (!exempt.has("plugin") && differ(b.plugin, r.plugin)) sections.push("plugin");
    if (sections.length) warnings.push(`provenance-differs:${sections.sort().join(",")}`);
    const flags = names("flags").filter((k) => !exempt.has(k) && !exempt.has(k.split(".")[0]) && differ(keyed(b, "flags")[k], keyed(r, "flags")[k]));
    if (flags.length) warnings.push(`flags-differ:${flags.sort().join(",")}`);
  }
  for (const [name, rec] of sides) {
    const drift = rec !== null && Array.isArray(rec.drift) ? [...new Set(rec.drift.filter((s) => typeof s === "string"))].sort() : [];
    if (drift.length) warnings.push(`provenance-drift:${name}:${drift.join(",")}`);
  }
  return warnings;
}

// The frame authority rule for the re-plan prompt, only when frame.md exists. render() is a single pass, so the
// change id is put into the rule here, before the rule is inserted as a variable.
function authorityLine(p, policy, template) {
  if (template !== "plan-revise") return "";
  const file = artifactFile(p, policy, "frame");
  if (file === null || !fs.existsSync(file)) return "";
  return "\n" + render(promptText(policy, "frame-authority"), { id: path.basename(p.change) }).trim();
}

// ---- archive adapter ------------------------------------------------------

const CREATED_RE = /^\d{4}-\d{2}-\d{2}$/;
const IN_PROGRESS = ["MERGE_HEAD", "REVERT_HEAD", "CHERRY_PICK_HEAD", "rebase-merge", "rebase-apply"];
const SKIP_COMMITTED = "skipped: pre-archive commit exists; run not archived";
const SKIP_FAILED = "skipped: pre-archive commit failed";

// `created` as /10x-archive reads it: the first line of change.md that starts with "created:", second field split
// on blanks, unmodified. The archive folder name must equal the skill's DEST, so no quote stripping and no trimming.
function createdValue(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return null; }
  const line = text.split("\n").find((l) => l.startsWith("created:"));
  return line === undefined ? null : (line.split(/[ \t]+/)[1] ?? "");
}

// `git status --porcelain -z` as { xy, file } records, or null when git fails. With -z a name with spaces stays unquoted.
// A rename or copy record is followed by one more NUL field (the old name), which is dropped.
function statusEntries(args, opts) {
  const res = runGit(["status", "--porcelain", "-z", ...args], opts);
  if (res.status !== 0) return null;
  const parts = res.stdout.split("\0");
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    if (rec.length < 4) continue;
    const xy = rec.slice(0, 2);
    entries.push({ xy, file: rec.slice(3) });
    if (/[RC]/.test(xy)) i++;
  }
  return entries;
}

// Up to ten names, joined for a halt message.
const listNames = (names) => `${names.slice(0, 10).join(", ")}${names.length > 10 ? `, +${names.length - 10} more` : ""}`;

// First lines of what a failed git call printed (stderr, then stdout: hooks write to either).
function gitMessage(res) {
  const text = `${res.stderr}\n${res.stdout}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6).join(" | ");
  return text || `exit status ${res.status}`;
}

// The halt text when `rev-parse --is-inside-work-tree` did not answer "true". A git that is missing or timed out
// is reported as such, not as "not a work tree".
function notWorkTree(inside, timeout, need = "--archive needs") {
  if (inside.timedOut) return `${need} a git work tree, but git timed out after ${timeout} ms while checking ${ROOT}.`;
  if (inside.status === 127) return `${need} a git work tree, but git could not be run: ${gitMessage(inside)}.`;
  if (inside.status !== 0) return `${need} a git work tree and ${ROOT} is not one: ${gitMessage(inside)}.`;
  return `${need} a git work tree and ${ROOT} is not one.`;
}

// The git safety checks shared by the pre-archive commit, the start and step commits of an isolated run and the
// rollback, all reads: a work tree, git ignoring a router file (only with `id`), a symbolic HEAD, no merge, rebase,
// cherry-pick or revert in progress and, unless `emptyIndex` is false, an empty index. Returns null or the reason.
function gitSafety(g, timeout, { id = null, emptyIndex = true, need } = {}) {
  const inside = g(["rev-parse", "--is-inside-work-tree"]);
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return notWorkTree(inside, timeout, need);
  if (id !== null) {
    const ignoredProbes = ignoredProbePaths(id, { timeout });
    if (ignoredProbes.length) return `git ignores ${ignoredProbes.join(", ")}, so the change folder cannot be committed.`;
  }
  if (g(["symbolic-ref", "-q", "HEAD"]).status !== 0) return "HEAD is detached; check out a branch first.";
  for (const name of IN_PROGRESS) {
    const where = g(["rev-parse", "--git-path", name]);
    if (where.status === 0 && fs.existsSync(path.resolve(ROOT, where.stdout.trim()))) {
      return `A merge, rebase, cherry-pick or revert is in progress (${name} exists); finish or abort it first.`;
    }
  }
  if (emptyIndex) {
    const staged = g(["diff", "--cached", "--quiet"]);
    if (staged.status === 1) {
      const names = g(["diff", "--cached", "--name-only", "-z"]).stdout.split("\0").filter(Boolean);
      return `The index holds staged changes: ${listNames(names)} (paths relative to the git root). Commit or unstage them first.`;
    }
    if (staged.status !== 0) return `git diff --cached failed: ${gitMessage(staged)}`;
  }
  return null;
}

// ---- run isolation ----------------------------------------------------------

const ISOLATION_OFF = '{ "isolation": { "require": false } } in context/foundation/agent-smith-policy.json';

// Is the run isolation gate on? Only the boolean true turns it on; a block of another shape reads as off.
const isolationOn = (policy) => isObject(policy.isolation) && policy.isolation.require === true;

// The isolation checks of init, all reads. Returns the short branch name, or halts and writes nothing.
// A linked worktree has a git dir that differs from the common dir; both are compared as absolute paths, because
// from a subdirectory of the main checkout the plain forms differ as strings (/abs/.git and ../.git).
function isolationCheck(id, policy, prev, fresh) {
  const c = policy.isolation;
  const timeout = c.gitTimeoutMs;
  const g = (args) => runGit(args, { timeout });
  const stop = (reason) => halt(`${reason} Nothing was written.`);
  const inside = g(["rev-parse", "--is-inside-work-tree"]);
  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    stop(`${notWorkTree(inside, timeout, "Run isolation (isolation.require) needs")} To run without isolation, set ${ISOLATION_OFF}.`);
  }
  const gitDir = g(["rev-parse", "--path-format=absolute", "--git-dir"]);
  const commonDir = g(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (gitDir.status !== 0 || commonDir.status !== 0) {
    stop(`Run isolation cannot tell whether ${ROOT} is a linked worktree: ${gitMessage(gitDir.status !== 0 ? gitDir : commonDir)}.`);
  }
  if (path.resolve(gitDir.stdout.trim()) === path.resolve(commonDir.stdout.trim())) {
    stop(`Run isolation needs a linked git worktree on a run branch, and ${ROOT} is in the main checkout. ` +
      `The orchestrator creates the worktree (.claude/worktrees/agent-smith-${id}); to run in the main checkout, for example to finish an in-flight run, set ${ISOLATION_OFF}.`);
  }
  const head = g(["symbolic-ref", "-q", "--short", "HEAD"]);
  const branch = head.status === 0 ? head.stdout.trim() : "";
  if (!branch) stop("HEAD is detached; run isolation needs the run worktree on its run branch.");
  const defaults = Array.isArray(c.defaultBranches) ? c.defaultBranches.filter((b) => typeof b === "string" && b) : [];
  const originHead = g(["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"]);
  const originName = originHead.status === 0 ? originHead.stdout.trim().replace(/^origin\//, "") : "";
  if (originName) defaults.push(originName);
  if (defaults.includes(branch)) stop(`Branch ${branch} is a default branch; run isolation needs a run branch of its own.`);
  const prefix = typeof c.branchPrefix === "string" ? c.branchPrefix : "agent-smith/";
  if (!branch.startsWith(prefix)) stop(`Branch ${branch} does not start with ${prefix}; run isolation needs the run branch ${prefix}${id}.`);
  const ignored = ignoredProbePaths(id, { timeout });
  if (ignored.length) stop(`Run isolation needs git to track the change folder, but git ignores ${ignored.join(", ")}. Fix .gitignore.`);
  if (prev.isolated === true && typeof prev.branch === "string" && prev.branch !== branch) {
    stop(`This run started on branch ${prev.branch} and HEAD is on ${branch}; resume it on ${prev.branch}.`);
  }
  if (!fresh && prev.isolated !== true) {
    stop(`This run has executed steps and was not started isolated, so it cannot become isolated now. To finish it, set ${ISOLATION_OFF}.`);
  }
  return branch;
}

// The working-directory rules put before every prompt of an isolated run, with a blank line after them, else "".
function worktreeLine(policy, meta) {
  if (meta.isolated !== true) return "";
  return render(promptText(policy, "worktree"), { workdir: ROOT }).trim() + "\n\n";
}

// Checked before every git write of an isolated run: the cwd is a linked worktree and HEAD is on meta.branch, so
// the router never commits to or resets the main checkout or another branch. Returns null or the reason; reads only.
function runBranchReason(g, meta) {
  const gitDir = g(["rev-parse", "--path-format=absolute", "--git-dir"]);
  const commonDir = g(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (gitDir.status !== 0 || commonDir.status !== 0) {
    return `Cannot tell whether ${ROOT} is the run worktree: ${gitMessage(gitDir.status !== 0 ? gitDir : commonDir)}.`;
  }
  if (path.resolve(gitDir.stdout.trim()) === path.resolve(commonDir.stdout.trim())) {
    return `${ROOT} is the main checkout, not the run worktree; the router never writes git state there.`;
  }
  const head = g(["symbolic-ref", "-q", "--short", "HEAD"]);
  const branch = head.status === 0 ? head.stdout.trim() : "";
  if (branch !== meta.branch) return `HEAD is on ${branch || "a detached commit"}, not on the run branch ${meta.branch}.`;
  return null;
}

// The rendered commit subject of policy.isolation.commit[key], or null when the template is not a non-blank string.
function isolationMessage(policy, key, vars) {
  const tpl = policy.isolation?.commit?.[key];
  if (typeof tpl !== "string") return null;
  return render(tpl, vars).trim() || null;
}

// Stages and commits for an isolated run: `git add` of `rel` (the change folder) or of the whole worktree, a commit
// when the index is not empty, then the post-commit checks of the archive path (index empty; with `rel`, the commit
// holds only that folder and the folder is clean). Hooks and signing apply; never --no-verify, never a push.
// Returns { commit } (the full hash, or null when nothing was staged) or { error, commit? }: `commit` is set only
// when the commit exists, else the router's own add was unstaged.
function routerCommit(g, timeout, { rel = null, message }) {
  const failed = (what, res) => {
    const reset = g(rel ? ["reset", "-q", "--", rel] : ["reset", "-q"]);
    const note = res.timedOut ? ` git timed out after ${timeout} ms; a hook child may still run and an index.lock may remain.` : "";
    return {
      error: `git ${what} failed: ${gitMessage(res)}.${note} The router's own add was ` +
        `${reset.status === 0 ? "unstaged again" : `not unstaged (git reset failed: ${gitMessage(reset)})`}. Nothing was committed.`,
    };
  };
  const added = g(rel ? ["add", "--", rel] : ["add", "-A"]);
  if (added.status !== 0) return failed("add", added);
  const check = g(["diff", "--cached", "--quiet"]);
  if (check.status === 0) return { commit: null };
  if (check.status !== 1) return failed("diff --cached", check);
  const made = g(rel ? ["commit", "-m", message, "--", rel] : ["commit", "-m", message]);
  if (made.status !== 0) return failed("commit", made);
  const head = g(["rev-parse", "HEAD"]);
  const commit = head.status === 0 && head.stdout.trim() ? head.stdout.trim() : null;
  const after = (reason) => ({ error: `${reason} The commit ${commit ? commit.slice(0, 7) : "HEAD"} exists and the router does not undo it.`, commit });
  const left = g(["diff", "--cached", "--quiet"]);
  if (left.status !== 0) {
    const names = g(["diff", "--cached", "--name-only", "-z"]).stdout.split("\0").filter(Boolean);
    return after(`The index is not empty after the commit (a hook staged something): ${listNames(names)} (paths relative to the git root).`);
  }
  if (rel) {
    const prefix = (g(["rev-parse", "--show-prefix"]).stdout ?? "").replace(/\r?\n$/, "");
    const shown = g(["show", "--name-only", "-z", "--format=", "HEAD"]);
    if (shown.status !== 0) return after(`Cannot list the commit: ${gitMessage(shown)}`);
    const extra = shown.stdout.split("\0").filter(Boolean).filter((name) => !name.startsWith(`${prefix}${rel}/`));
    if (extra.length) return after(`The commit holds paths outside ${rel}: ${listNames(extra)} (paths relative to the git root).`);
    const unclean = statusEntries(["--", `${rel}/`], { timeout });
    if (unclean === null) return after("Cannot read the status of the change folder.");
    if (unclean.length) return after(`The change folder is not clean after the commit: ${listNames(unclean.map((e) => e.file))}.`);
  }
  return { commit };
}

// The start commit of the first init of an isolated run: the change folder as the orchestrator copied it, plus
// meta.json, so the first step's startSha holds the run's inputs. meta.startCommit is the guard (the hash, or null
// when nothing was staged); a git failure leaves it absent, so the next init retries. Halts on any failure.
function startCommit(p, id, meta, policy) {
  const timeout = policy.isolation?.gitTimeoutMs;
  const g = (args) => runGit(args, { timeout });
  const stop = (reason) => halt(`The start commit of the run was not made: ${reason}`);
  const where = runBranchReason(g, meta);
  if (where) stop(where);
  const unsafe = gitSafety(g, timeout, { need: "The start commit needs" });
  if (unsafe) stop(unsafe);
  const message = isolationMessage(policy, "startMessage", { id });
  if (message === null) stop("policy.isolation.commit.startMessage must be a non-blank string.");
  const res = routerCommit(g, timeout, { rel: `context/changes/${id}`, message });
  if (res.commit !== undefined) {
    meta.startCommit = res.commit;
    fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
  }
  if (res.error) stop(res.error);
}

// The step commit of an isolated run: right after attachResult, when the last executed entry is ok and has no
// `commit` key, everything the step left is committed (run.jsonl first, so the commit holds the step's result).
// The entry gets `commit` (the hash, or null for an empty index), so a resume never commits again under its name;
// a failure before the commit leaves the key absent, so the resume retries. Halts on any failure.
function stepCommit(p, id, meta, log, policy) {
  if (meta.isolated !== true) return;
  const ran = executed(log);
  const last = ran[ran.length - 1];
  if (!last || last.ok !== true || Object.hasOwn(last, "commit")) return;
  const timeout = policy.isolation?.gitTimeoutMs;
  const g = (args) => runGit(args, { timeout });
  writeLog(p.log, log);
  const stop = (reason) => endRun(p, id, meta, log, { action: "halt", reason: `Step commit of step ${last.n} (${last.step}): ${reason}`, steps: ran.length });
  const where = runBranchReason(g, meta);
  if (where) stop(where);
  const unsafe = gitSafety(g, timeout, { need: "A step commit needs" });
  if (unsafe) stop(unsafe);
  const message = isolationMessage(policy, "message", { id, n: String(last.n), step: last.step });
  if (message === null) stop("policy.isolation.commit.message must be a non-blank string.");
  const res = routerCommit(g, timeout, { message });
  if (res.commit !== undefined) last.commit = res.commit;
  if (res.error) stop(res.error);
  writeLog(p.log, log);
}

// The files whose times decide compares while no plan or plan-review step is logged, keyed as in before.mtimes.
const timedFiles = (p) => ({ plan: p.plan, planReview: p.planReview, implReview: p.implReview });
const fileTimes = (p) => Object.fromEntries(Object.entries(timedFiles(p)).map(([key, file]) => [key, mtime(file)]));

// Sets each file that exists and has a recorded time above 0 back to that time (fs.utimesSync, no git).
function setTimes(p, times) {
  if (!isObject(times)) return;
  for (const [key, file] of Object.entries(timedFiles(p))) {
    const t = times[key];
    if (typeof t === "number" && Number.isFinite(t) && t > 0 && fs.existsSync(file)) fs.utimesSync(file, t / 1000, t / 1000);
  }
}

// run.jsonl and meta.json as next holds them in memory, written back after a reset changed them on disk.
function writeState(p, meta, log) {
  fs.mkdirSync(p.dir, { recursive: true });
  writeLog(p.log, log);
  fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
}

// The run token of the side ref ({run} in policy.isolation.rollback.ref): the first RUN_TOKEN_LENGTH hex characters
// of the run's start commit, so two runs of one change id never share a ref. The start commit is meta.startCommit, or,
// when init staged nothing (null), the startSha of the run's first step, which is HEAD at init; the failed step's own
// startSha is the last resort for a log without either.
const RUN_TOKEN_LENGTH = 12;
function runToken(meta, ran, last) {
  const first = ran.find((e) => typeof e.startSha === "string" && SHA_RE.test(e.startSha))?.startSha;
  const sha = [meta.startCommit, first, last.startSha].find((s) => typeof s === "string" && SHA_RE.test(s));
  return sha.slice(0, RUN_TOKEN_LENGTH);
}

// The rollback of a failed step of an isolated run, right after attachResult and before risk, rigor and decide, so
// the next step is chosen from the restored files. Eligible: a failure (not a fallback, not advisory) with a
// startSha, no `uncommitted` list (the implement-retry that follows needs those ticks), no signals.needsHuman, not
// rolled back or kept before. The partial state, staged and untracked files included, becomes a commit under the side
// ref (plumbing: no hook runs); then the worktree is hard-reset to startSha (no git clean; ignored files stay), the
// file times decide compares are set back to the step start and the router state is written back.
// Returns null when nothing was rolled back, else what the undo on halt needs. Halts on any failure.
function rollback(p, id, meta, log, policy) {
  if (meta.isolated !== true) return null;
  const ran = executed(log);
  const last = ran[ran.length - 1];
  if (!last || !isFailure(last) || typeof last.startSha !== "string" || !SHA_RE.test(last.startSha)) return null;
  if (Object.hasOwn(last, "uncommitted") || last.signals?.needsHuman || last.rolledBack || last.kept) return null;
  const timeout = policy.isolation?.gitTimeoutMs;
  const g = (args) => runGit(args, { timeout });
  let ref = null;
  let refMade = false;
  const stop = (reason) => endRun(p, id, meta, log, {
    action: "halt",
    reason: `Rollback of step ${last.n} (${last.step}): ${reason}${refMade ? ` The partial edits are kept under ${ref}.` : ""}`,
    steps: ran.length,
  });
  const where = runBranchReason(g, meta);
  if (where) stop(where);
  // A failed step may leave staged files (a hook rejected its own commit): the snapshot takes them.
  const unsafe = gitSafety(g, timeout, { emptyIndex: false, need: "A rollback needs" });
  if (unsafe) stop(unsafe);
  const tpl = policy.isolation?.rollback?.ref;
  ref = typeof tpl === "string" ? render(tpl, { id, run: runToken(meta, ran, last), n: String(last.n) }).trim() : "";
  // Only the router's own namespace: refs/heads, refs/tags and refs/remotes are shared by every worktree of the repo.
  if (!ref.startsWith("refs/agent-smith/")) stop("policy.isolation.rollback.ref must render to a ref under refs/agent-smith/.");
  const left = fileTimes(p); // the times the failed step left, for the undo on halt
  const step = (args) => {
    const res = g(args);
    if (res.status !== 0) stop(`git ${args[0]} failed: ${gitMessage(res)}.`);
    return res.stdout.trim();
  };
  step(["add", "-A"]);
  const tree = step(["write-tree"]);
  const snapshot = step(["commit-tree", tree, "-p", "HEAD", "-m", `agent-smith: failed step ${last.n} (${last.step})`]);
  step(["update-ref", ref, snapshot]); // a ref of that name from an earlier attempt is overwritten
  refMade = true;
  step(["reset", "-q", "--hard", last.startSha]);
  // The reset replaced run.jsonl and meta.json with their startSha versions: write the state back first, so a failure
  // while setting the file times cannot lose the log.
  last.rolledBack = ref;
  writeState(p, meta, log);
  setTimes(p, last.before?.mtimes);
  return { ref, left, last, g };
}

// The undo on halt: the next call that rolled back ends in a halt, so the final failure keeps its partial edits for a
// human. The branch goes back to the head the failed step left, the worktree holds the snapshot (files the step added
// are untracked again, staged files come back unstaged), the router state and the file times the step left are
// written back, and the entry says `kept`. Returns null or the git failure.
// The undo of a rollback made by this call of next, for main's catch: set after the rollback, cleared by every halt
// that runs the undo itself.
let undoOnError = null;

function undoRollback(p, meta, log, rb) {
  const hard = rb.g(["reset", "-q", "--hard", rb.ref]);
  if (hard.status !== 0) return `git reset --hard ${rb.ref} failed: ${gitMessage(hard)}.`;
  const mixed = rb.g(["reset", "-q", `${rb.ref}^`]);
  if (mixed.status !== 0) {
    return `git reset ${rb.ref}^ failed: ${gitMessage(mixed)}. The run branch now points at the snapshot commit of ${rb.ref}; ` +
      `run git reset -q ${rb.ref}^ in the run worktree before resuming.`;
  }
  delete rb.last.rolledBack;
  rb.last.kept = rb.ref;
  writeState(p, meta, log);
  setTimes(p, rb.left);
  return null;
}

const COMMIT_EXISTS = "The pre-archive commit exists, is local and is not undone by the router. A resume makes no commit, " +
  "so the check that the commit touched only the change folder (post-commit check 2) is not repeated; clearing the index " +
  "does not remove a path the commit already holds (amend the commit, or accept it). `next` repeats safely after the cause is fixed.";

// The done branch of a run with --archive. Pre-checks, final report, commit, post-commit checks, then the archive action.
// While the folder is not committed a halt may write the end state (endRun). Once the commit exists, or the run is
// written as done, a halt only prints (out): rewriting meta.json or report.md would dirty the committed folder.
function archiveDone(p, id, meta, log, policy, level, d) {
  const rel = `context/changes/${id}`;
  const ran = executed(log);
  const timeout = policy.archive?.gitTimeoutMs;
  const g = (args) => runGit(args, { timeout });

  // 1. Already committed and clean (a resume).
  const tracked = g(["ls-files", "--error-unmatch", "--", `${rel}/agent-smith/report.md`]).status === 0;
  const dirty = tracked ? statusEntries(["--", `${rel}/`], { timeout }) : null;
  let committed = tracked && dirty !== null && dirty.length === 0;
  // In an isolated run a step commit can take report.md and leave the folder clean, so the folder counts as committed
  // only when HEAD is the pre-archive commit itself.
  if (committed && meta.isolated === true) {
    const tpl = policy.archive?.commitMessage;
    const subject = g(["log", "-1", "--format=%s"]);
    committed = typeof tpl === "string" && subject.status === 0 && subject.stdout.trim() === render(tpl, { id }).trim();
  }

  // 2. Pre-checks. Kind A (folder not committed) writes the run's end state, kind B prints only.
  const precheck = (reason) => {
    if (committed) {
      return out({ action: "halt", reason: `${reason} ${COMMIT_EXISTS}`, steps: ran.length, archive: SKIP_COMMITTED, committed: true });
    }
    return endRun(p, id, meta, log, { action: "halt", reason: `${reason} Nothing was committed.`, steps: ran.length });
  };
  const unsafe = gitSafety(g, timeout, { id });
  if (unsafe) precheck(unsafe);
  const created = createdValue(path.join(p.change, "change.md"));
  if (created === null || !CREATED_RE.test(created)) {
    precheck(`change.md needs a line "created: YYYY-MM-DD" (found ${created === null ? "none" : JSON.stringify(created)}); /10x-archive builds the archive folder name from it.`);
  }
  const archivePath = `context/archive/${created}-${id}`;
  if (fs.existsSync(path.join(ROOT, archivePath))) {
    precheck(`Archive destination ${archivePath} already exists; a reused id on the same date needs a human.`);
  }
  const manualPending = Array.isArray(d.manualPending) ? d.manualPending : [];
  if (policy.archive?.haltOnManualPending === true && manualPending.length) {
    precheck(`Manual rows are pending and archive.haltOnManualPending is true: ${manualPending.join("; ")}`);
  }
  // The message and the tier are settled before git add, so a bad policy never leaves a staged index
  // and never throws after the commit exists.
  const template = policy.archive?.commitMessage;
  if (typeof template !== "string" || !template.trim()) precheck("policy.archive.commitMessage must be a non-blank string.");
  const message = render(template, { id }).trim();
  if (!message) precheck("policy.archive.commitMessage renders to a blank message.");
  let settled;
  try {
    settled = tierFor({ step: "archive" }, ran, policy, readPlan(p.plan), meta, level);
  } catch (e) {
    precheck(`Cannot pick the archive tier: ${e instanceof Error ? e.message : String(e)}`);
  }
  const target = policy.ladder[settled.tier];
  if (!isObject(target) || typeof target.model !== "string" || typeof target.effort !== "string") {
    precheck(`policy.ladder has no entry for tier ${settled.tier}, which the archive step is pinned to.`);
  }

  // 3. Ignored files are reported, never a halt.
  const prefix = (g(["rev-parse", "--show-prefix"]).stdout ?? "").replace(/\r?\n$/, "");
  const unprefix = (file) => (file.startsWith(prefix) ? file.slice(prefix.length) : file);
  const ignoredEntries = statusEntries(["--ignored", "--", `${rel}/`], { timeout }) ?? [];
  const ignored = ignoredEntries.filter((e) => e.xy === "!!").map((e) => unprefix(e.file)).slice(0, 10);

  // 4. Final report, then the commit.
  const done = finishRun(p, id, meta, log, { action: "done", reason: d.reason, manualPending, ...doneNotes(d), steps: ran.length });
  const commitFailed = (what, res) => {
    const reset = g(["reset", "-q", "--", rel]);
    const note = res.timedOut
      ? ` git timed out after ${timeout} ms; a hook child may still run and an index.lock may remain.`
      : "";
    return out({
      action: "halt",
      reason: `git ${what} failed: ${gitMessage(res)}.${note} The change folder was ${reset.status === 0 ? "unstaged again" : `not unstaged (git reset failed: ${gitMessage(reset)})`}. Nothing was committed.`,
      steps: ran.length,
      archive: SKIP_FAILED,
      committed: false,
    });
  };
  // A report that could not be written halts here, before anything is staged or committed.
  if (done.reportError) {
    return out({
      action: "halt",
      reason: `report.md was not written: ${done.reportError}. Nothing was committed.`,
      steps: ran.length,
      archive: SKIP_FAILED,
      committed: false,
    });
  }
  const added = g(["add", "--", rel]);
  if (added.status !== 0) commitFailed("add", added);
  const check = g(["diff", "--cached", "--quiet"]);
  if (check.status !== 0 && check.status !== 1) commitFailed("diff --cached", check);
  let madeCommit = false;
  if (check.status === 1) {
    const made = g(["commit", "-m", message, "--", rel]);
    if (made.status !== 0) commitFailed("commit", made);
    madeCommit = true;
  }

  // 5. Post-commit checks. The commit exists, so a halt prints only.
  const commitHalt = (reason) => out({ action: "halt", reason: `${reason} ${COMMIT_EXISTS}`, steps: ran.length, archive: SKIP_COMMITTED, committed: true });
  const left = g(["diff", "--cached", "--quiet"]);
  if (left.status !== 0) {
    const names = g(["diff", "--cached", "--name-only", "-z"]).stdout.split("\0").filter(Boolean);
    commitHalt(`The index is not empty after the commit (a hook staged something): ${listNames(names)} (paths relative to the git root).`);
  }
  if (madeCommit) {
    const shown = g(["show", "--name-only", "-z", "--format=", "HEAD"]);
    if (shown.status !== 0) commitHalt(`Cannot list the commit: ${gitMessage(shown)}`);
    const inFolder = `${prefix}${rel}/`;
    const extra = shown.stdout.split("\0").filter(Boolean).filter((name) => !name.startsWith(inFolder));
    if (extra.length) commitHalt(`The commit holds paths outside ${rel}: ${listNames(extra)} (paths relative to the git root).`);
  }
  const unclean = statusEntries(["--", `${rel}/`], { timeout });
  if (unclean === null) commitHalt("Cannot read the status of the change folder.");
  if (unclean.length) commitHalt(`The change folder is not clean after the commit: ${listNames(unclean.map((e) => unprefix(e.file)))}.`);

  // 6. The archive action. No log entry and no resultFile: nothing may be written into the folder that moves.
  let commit = null;
  if (madeCommit) {
    const head = g(["rev-parse", "--short", "HEAD"]);
    commit = head.status === 0 && head.stdout.trim() ? head.stdout.trim() : "HEAD";
  }
  const prompt = worktreeLine(policy, meta) + render(policy.prompts.archive, { id }).trim() + "\n\n" + policy.prompts.suffix;
  return out({
    action: "archive",
    model: target.model,
    effort: target.effort,
    reason: `run done; ${commit ? `committed ${commit}` : "folder already committed"}; tier ${settled.tier} (${settled.tierWhy})`,
    prompt,
    summary: { reason: d.reason, manualPending, ...doneNotes(d), steps: ran.length },
    report: done.report,
    archivePath,
    commit,
    ignored,
  });
}

function next(id, policy) {
  const p = paths(id, policy);
  guardArchived(p, id);
  fs.mkdirSync(p.dir, { recursive: true });
  const meta = readMeta(p.meta, { id, goal: "" });
  const log = readLog(p.log);
  checkPrompts(policy);
  attachResult(p, log, policy);
  // An isolated run commits what a successful step left before risk, rigor and decide read the files.
  stepCommit(p, id, meta, log, policy);
  // An isolated run rolls a failed step back before risk, rigor and decide read the files. When this call ends in a
  // halt instead of a next step, the rollback is undone first, so the partial edits stay for a human.
  const rb = rollback(p, id, meta, log, policy);
  // A router error later in this call ends it in main's catch, which runs the same undo.
  if (rb) undoOnError = () => undoRollback(p, meta, log, rb);
  const end = (result) => {
    undoOnError = null;
    if (rb && result.action === "halt") {
      const failed = undoRollback(p, meta, log, rb);
      if (failed) result = { ...result, reason: `${result.reason} The rollback was not undone: ${failed} The partial edits are kept under ${rb.ref}.` };
    }
    return endRun(p, id, meta, log, result);
  };

  const planNow = readPlan(p.plan);
  const risk = planNow.exists ? measureRisk(p, meta, log, policy) : null;
  const { level, changed } = resolveRigor(meta, log, policy, planNow, risk);
  // A policy, prompt or agent edit since the record adds its section to provenance.drift; meta.json is written only then.
  const drifted = recordDrift(meta, policy);
  if (changed || drifted) fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");

  // A subagent that cannot decide from evidence stops the run once. The ack lives on the log entry.
  const ranNow = executed(log);
  const lastRan = ranNow[ranNow.length - 1];
  if (lastRan?.signals?.needsHuman && !lastRan.needsHumanAck) {
    lastRan.needsHumanAck = true;
    return end({
      action: "halt",
      reason: `Step ${lastRan.n} (${lastRan.step}) needs a human: ${lastRan.signals.needsHuman}`,
      steps: ranNow.length,
    });
  }

  const budget = Math.max(1, policy.limits.maxTotalSteps + (policy.rigor.budgetDelta?.[level] ?? 0));
  if (budgetSteps(log) >= budget) {
    return end({ action: "halt", reason: `Step budget ${budget} spent.` });
  }

  // decide() may skip a step: log the skip and ask again. A step is skipped at most once per call, because a
  // logged skip marks it handled; a second skip of the same step is a router bug and halts. Different steps may
  // skip in turn (the three pre-plan gates can all close), and step names are finite, so the loop ends.
  const skippedNow = new Set();
  let d;
  for (;;) {
    d = decide(p, log, policy, meta, { level, risk });
    if (!d.skip) break;
    if (skippedNow.has(d.skip.step)) {
      return end({ action: "halt", reason: "Router error: skip loop", steps: executed(log).length });
    }
    skippedNow.add(d.skip.step);
    log.push({
      skipped: true,
      step: d.skip.step,
      reason: d.skip.reason,
      rigor: level,
      risk: d.skip.risk,
      score: d.skip.score,
      afterN: executed(log).length,
      at: Date.now(),
    });
    writeLog(p.log, log);
  }
  const ran = executed(log);
  if (d.done && meta.archive === true) return archiveDone(p, id, meta, log, policy, level, d);
  if (d.halt || d.done) {
    return end(d.done
      ? { action: "done", reason: d.reason, manualPending: d.manualPending, ...doneNotes(d), steps: ran.length }
      : { action: "halt", reason: d.halt, steps: ran.length });
  }

  const plan = readPlan(p.plan);
  // The score shift reads the summary from the log, never complexity.json.
  const riskClear = riskMeasured(risk) && risk.hits.length === 0;
  const { tier, fails, simple, cheap, tierWhy, scoreShift: shifted } = tierFor(d, ran, policy, plan, meta, level, { summary: scoreSummary(log), riskClear });
  if (fails >= policy.escalation.maxAttemptsPerStep) {
    return end({ action: "halt", reason: `${d.step} failed ${fails} times in a row. Last note: ${ran[ran.length - 1]?.result?.note ?? "none"}` });
  }

  // A continued run must not keep the outcome of an earlier end.
  if (meta.outcome) {
    delete meta.outcome;
    fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
  }

  const { model, effort } = policy.ladder[tier];
  const template = d.template ?? d.step;
  const vars = {
    id, goal: meta.goal, verdict: d.verdict ?? "", artifacts: artifactsLine(p, policy), authority: authorityLine(p, policy, template),
    phase: d.phase === undefined ? "" : String(d.phase), lastPhase: d.lastPhase === undefined ? "" : String(d.lastPhase),
    retry: (d.retry ?? []).join(", "), uncommitted: (d.uncommitted ?? []).join(", "), failure: d.failure ?? "",
    unproven: (d.unproven ?? []).join(", ") || "none", evidence: d.evidenceNote ?? "",
    lessonMax: String(lessonLimits(policy).maxCandidates), lessonChars: String(lessonLimits(policy).maxChars),
  };
  // The working-directory rules of an isolated run (meta.isolated), the rendered template, then the advisor rules for a
  // listed template (advisor.enabled), then the generic suffix.
  const advisor = advisorOn(policy, template);
  const prompt = worktreeLine(policy, meta) + render(promptText(policy, template), vars).trim()
    + (advisor ? "\n\n" + render(promptText(policy, "advisor"), vars).trim() : "")
    + "\n\n" + policy.prompts.suffix;
  const agent = stepAgent(policy, d.step);
  const entry = {
    n: ran.length + 1,
    step: d.step,
    template,
    skill: d.skill ?? policy.steps[d.step].skill,
    tier,
    model,
    effort,
    reason: d.reason,
    tierWhy,
    simple,
    rigor: level,
    startedAt: Date.now(),
    before: { autoDone: plan.autoDone, ...beforeExtra(policy, template, plan) },
  };
  // The commit the step of an isolated run starts from: HEAD when the entry is created, after the step commit above.
  // A head that cannot be read (git missing, a timeout, no commit) halts before the step is logged: a step without a
  // startSha could not be rolled back.
  if (meta.isolated === true) {
    const head = runGit(["rev-parse", "HEAD"], { timeout: policy.isolation?.gitTimeoutMs });
    const startSha = head.status === 0 ? head.stdout.trim() : "";
    if (!SHA_RE.test(startSha)) {
      const why = head.timedOut ? `git timed out after ${policy.isolation?.gitTimeoutMs} ms`
        : head.status !== 0 ? `git rev-parse HEAD failed: ${gitMessage(head).replace(/\.$/, "")}`
          : `git rev-parse HEAD printed "${startSha.slice(0, 80)}"`;
      return end({ action: "halt", reason: `Cannot read the start commit of step ${entry.n} (${d.step}) of an isolated run: ${why}. Fix git in the run worktree, then run next again.`, steps: ran.length });
    }
    entry.startSha = startSha;
    // The file times decide compares, so a rollback can set them back after the reset (0 when a file is absent).
    entry.before.mtimes = fileTimes(p);
  }
  if (d.verdict) entry.verdict = d.verdict; // the review verdict that caused this step
  if (d.step === "score") entry.advisory = true; // the score only advises: a failed attempt is neutral and uses no budget
  if (agent) entry.agent = agent; // the restricted agent type the step was dispatched with (agents.restricted)
  if (advisor) entry.advisor = true; // the prompt carried the advisor rules (advisor.enabled); no consult is verified
  if (shifted) entry.scoreShift = shifted;
  if (cheap) entry.cheap = true; // the first-attempt drop survived the score shift, the clamp and the floor
  if (d.phase !== undefined) { entry.phase = d.phase; entry.lastPhase = d.lastPhase; }
  if (d.executor) entry.executor = d.executor;
  if (Array.isArray(d.retry)) entry.retry = d.retry;
  if (d.step === "manual-verify") {
    const copy = (rows) => rows.map(({ id: rid, text, done }) => ({ id: rid, text, done }));
    entry.before.manual = copy(manualRows(plan));
    entry.before.auto = copy(plan.phaseList.flatMap((ph) => ph.auto));
  }
  log.push(entry);
  writeLog(p.log, log);
  out({
    action: "run",
    n: entry.n,
    step: d.step,
    ...(agent ? { agent } : {}),
    model,
    effort,
    reason: `${d.reason}; tier ${tier} (${tierWhy})`,
    prompt,
    resultFile: path.relative(ROOT, p.result),
  });
}

// Read-only, files only, no git: did /10x-archive move this change and stamp it archived.
function verifyArchive(id, flags) {
  const no = (reason, extra = {}) => out({ archived: false, reason, ...extra }, 1);
  let name;
  if (flags.path !== undefined) {
    if (typeof flags.path !== "string") no("--path needs a folder");
    const m = flags.path.replace(/^\.\//, "").replace(/\/$/, "").match(/^context\/archive\/([^/\\]+)$/);
    if (!m || !archiveDirs(id).includes(m[1])) no(`--path is not an archive folder of ${id}`);
    name = m[1];
  } else {
    const found = archiveDirs(id);
    if (found.length > 1) {
      const folders = found.map((n) => `context/archive/${n}`);
      no(`More than one archive folder for ${id}: ${folders.join(", ")}. Pass --path.`, { ambiguous: folders });
    }
    name = found[0];
  }
  const p = paths(id);
  const stillThere = fs.existsSync(p.change);
  if (name === undefined) {
    const stamped = stillThere && frontmatterField(path.join(p.change, "change.md"), "status") === "archived";
    no(stamped
      ? `No archive folder for ${id}: context/changes/${id} is stamped archived but was not moved.`
      : `No archive folder for ${id} under context/archive/.`);
  }
  const rel = `context/archive/${name}`;
  const changeFile = path.join(ROOT, rel, "change.md");
  if (!fs.existsSync(changeFile)) no(`${rel}/change.md is missing.`);
  const status = frontmatterField(changeFile, "status");
  if (status !== "archived") no(`${rel}/change.md has status ${status === null ? "(none)" : status}, not archived.`);
  if (stillThere) no(`context/changes/${id} still exists next to ${rel}.`);
  const archivedAt = frontmatterField(changeFile, "archived_at");
  out({
    archived: true,
    path: rel,
    archivedAt: archivedAt === "null" ? null : archivedAt,
    report: fs.existsSync(path.join(ROOT, rel, "agent-smith/report.md")) ? `${rel}/agent-smith/report.md` : null,
  });
}

// Read-only: prints the churn numbers for a change.
function riskCommand(id, policy) {
  const p = paths(id);
  const meta = readMeta(p.meta, { id, goal: "" });
  const r = measureRisk(p, meta, readLog(p.log), policy);
  out({ source: r.source, hot: r.hot, planPaths: r.planPaths, unclassified: r.unclassified, planHits: r.planHits, diffHits: r.diffHits, level: r.level });
}

// ---- compare --------------------------------------------------------------

// Read-only: compares the usage of a routed run with a baseline run of the same change.
// Each side is a run folder in its own checkout. Nothing is written, nothing is routed.

const BASELINE_PIN = { model: "sonnet", effort: "high" };

// A figure counts only when it is a non-negative safe integer; run.jsonl may be edited by hand.
function validFigure(v) {
  return Number.isSafeInteger(v) && v >= 0;
}

// Floor division for BigInt (the built-in operator truncates toward zero).
function floorDivBig(a, b) {
  const q = a / b;
  return a % b !== 0n && (a < 0n) !== (b < 0n) ? q - 1n : q;
}

// Find the agent-smith folder of one side: the folder itself, the live change folder, then the archive.
function locateSide(dirArg, id, side) {
  const base = path.resolve(ROOT, dirArg);
  const live = path.join(base, "context/changes", id, "agent-smith");
  const archiveRoot = path.join(base, "context/archive");
  const re = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${id}$`);
  let archived = [];
  try {
    archived = fs.readdirSync(archiveRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && re.test(d.name)).map((d) => d.name).sort();
  } catch { /* no archive folder */ }
  const hasLog = (dir) => fs.existsSync(path.join(dir, "run.jsonl"));
  const tried = [base, live, archived.length ? path.join(archiveRoot, `${archived[0]}/agent-smith`) : path.join(archiveRoot, `<date>-${id}/agent-smith`)];
  if (hasLog(base)) return { source: "folder", dir: base, alsoArchived: false };
  if (hasLog(live)) return { source: "changes", dir: live, alsoArchived: archived.length > 0 };
  if (archived.length > 1) {
    halt(`${side}: more than one archive folder for ${id} under ${archiveRoot}: ${archived.join(", ")}. Pass the exact folder.`);
  }
  if (archived.length === 1 && hasLog(path.join(archiveRoot, archived[0], "agent-smith"))) {
    return { source: "archive", dir: path.join(archiveRoot, archived[0], "agent-smith"), alsoArchived: false };
  }
  return halt(`${side}: no run.jsonl found for ${id}. Looked in: ${tried.map((t) => path.join(t, "run.jsonl")).join(", ")}.`);
}

// `producedFile` is the score file of the policy compare loads: a produced file, dropped from inputFiles like plan.md.
function readSide(dirArg, id, side, producedFile) {
  const found = locateSide(dirArg, id, side);
  const log = readLog(path.join(found.dir, "run.jsonl")).filter(isObject); // readLog lets a JSON array through
  const meta = readMeta(path.join(found.dir, "meta.json"), {});
  const steps = executed(log);
  const skipped = log.filter((e) => e.skipped).map((e) => (typeof e.step === "string" ? e.step : "unknown"));
  const figure = (key) => {
    let total = 0;
    let withFigures = 0;
    for (const e of steps) {
      const v = e.usage?.[key];
      // A running total past the safe-integer range counts as a missing figure, so the pair is not comparable.
      if (validFigure(v) && !Number.isSafeInteger(total + v)) continue;
      if (validFigure(v)) { total += v; withFigures++; }
    }
    return { total, stepsWithFigures: withFigures };
  };
  // Tokens per model alias, and per tier as <model>/<effort>: byModel cannot show an effort move.
  const byModel = {};
  const byTier = {};
  for (const e of steps) {
    const v = e.usage?.totalTokens;
    if (!validFigure(v)) continue;
    const model = typeof e.model === "string" && e.model ? e.model : "unknown";
    const effort = typeof e.effort === "string" && e.effort ? e.effort : "unknown";
    byModel[model] = (byModel[model] ?? 0) + v;
    byTier[`${model}/${effort}`] = (byTier[`${model}/${effort}`] ?? 0) + v;
  }
  const changeDir = path.basename(found.dir) === "agent-smith" ? path.dirname(found.dir) : null;
  let plan = null;
  let inputFiles = null;
  if (changeDir) {
    const pl = readPlan(path.join(changeDir, "plan.md"));
    if (pl.exists) plan = { phases: pl.phases, rows: pl.rows };
    try {
      inputFiles = fs.readdirSync(changeDir, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name !== "plan.md" && d.name !== "plan-brief.md" && d.name !== producedFile)
        .map((d) => d.name).sort();
    } catch { inputFiles = null; }
  }
  return {
    source: found.source,
    dir: found.dir,
    goal: typeof meta.goal === "string" ? meta.goal : null,
    baseSha: typeof meta.baseSha === "string" ? meta.baseSha : null,
    rigor: meta.rigor?.level ?? null,
    outcome: meta.outcome?.action ?? null,
    provenance: isObject(meta.provenance) ? meta.provenance : null,
    steps: steps.length,
    skipped,
    failedAttempts: steps.filter((e) => e.ok === false && !e.fallback).length,
    plan,
    inputFiles,
    tokens: { ...figure("totalTokens"), byModel, byTier },
    toolUses: figure("toolUses"),
    durationMs: figure("durationMs"),
    alsoArchived: found.alsoArchived,
    pinned: steps.length > 0 && steps.every((e) => e.model === BASELINE_PIN.model && e.effort === BASELINE_PIN.effort),
  };
}

// The A9 decision on exact tokens. A target with at most 2 decimals is decided in exact integer math;
// any other target uses a float test with a relative slack that only absorbs the rounding of target * baseline.
function dropMet(diff, baseline, target) {
  const cents = Math.round(target * 100);
  if (cents / 100 === target) return BigInt(diff) * 10000n >= BigInt(cents) * BigInt(baseline);
  const right = target * baseline;
  return diff * 100 >= right - 4 * Number.EPSILON * Math.max(1, right);
}

// The exact drop rounded down to 2 decimals.
function dropPercentOf(diff, baseline) {
  return Number(floorDivBig(BigInt(diff) * 10000n, BigInt(baseline))) / 100;
}

function comparePair(id, flags, policy) {
  // Flags and the target are checked before anything is read.
  for (const key of ["baseline", "routed", "format"]) {
    if (flags[key] !== undefined && typeof flags[key] !== "string") halt(`Missing value for --${key}.`);
  }
  if (flags.baseline === undefined) halt("compare needs --baseline <dir>: compare <change-id> --baseline <dir> [--routed <dir>] [--format md] [--unpinned].");
  if (flags.format !== undefined && flags.format !== "json" && flags.format !== "md") {
    halt(`Invalid --format ${flags.format}. Use json or md.`);
  }
  // --unpinned is checked like --archive of init: a bare flag or "true" turns it on, "false" turns it off.
  let unpinned = false;
  if (flags.unpinned !== undefined) {
    if (flags.unpinned === true || flags.unpinned === "true") unpinned = true;
    else if (flags.unpinned === "false") unpinned = false;
    else halt(`Invalid --unpinned ${flags.unpinned}. Use --unpinned, --unpinned true or --unpinned false.`);
  }
  let target = policy.compare?.targetDropPercent;
  if (target === undefined) target = null;
  if (target !== null && !(typeof target === "number" && Number.isFinite(target) && target >= 0 && target <= 100)) {
    halt(`Invalid compare.targetDropPercent ${JSON.stringify(target)}. Use null or a number from 0 to 100.`);
  }

  // The score file is produced by the run, so only the scorer-on arm of an A/B pair has it.
  const producedFile = scoreConfig(policy)?.file ?? "complexity.json";
  const baseline = readSide(flags.baseline, id, "baseline", producedFile);
  const routed = readSide(typeof flags.routed === "string" ? flags.routed : ROOT, id, "routed", producedFile);

  const reasons = [];
  const warnings = [];
  // --unpinned waives only the pin: the baseline of a scorer A/B pair is a routed run with the scorer off.
  if (baseline.steps > 0 && !baseline.pinned && !unpinned) reasons.push("baseline-not-pinned");
  if (unpinned) warnings.push("baseline-unpinned");
  const sides = [["baseline", baseline], ["routed", routed]];
  for (const [name, s] of sides) {
    if (s.steps === 0) reasons.push(`no-steps:${name}`);
    if (s.outcome !== "done") reasons.push(`outcome-not-done:${name}`);
    if (s.steps > 0 && s.tokens.stepsWithFigures < s.steps) reasons.push(`usage-incomplete:${name}`);
  }
  const baselineComplete = baseline.steps > 0 && baseline.tokens.stepsWithFigures === baseline.steps;
  if (baselineComplete && baseline.tokens.total === 0) reasons.push("baseline-total-zero");

  if (baseline.goal !== routed.goal) warnings.push("goal-mismatch");
  if (baseline.baseSha !== routed.baseSha) warnings.push("baseSha-mismatch");
  if (baseline.skipped.length) warnings.push(`baseline-skipped-steps:${baseline.skipped.length}`);
  if (baseline.inputFiles && routed.inputFiles) {
    const differ = [
      ...baseline.inputFiles.filter((n) => !routed.inputFiles.includes(n)),
      ...routed.inputFiles.filter((n) => !baseline.inputFiles.includes(n)),
    ].sort();
    if (differ.length) warnings.push(`input-files-differ:${differ.join(",")}`);
  }
  for (const [name, s] of sides) if (s.alsoArchived) warnings.push(`archive-also-present:${name}`);
  // The expected set follows the flag, never baseline.pinned: a pinned baseline changes ladder, rigor and score by design.
  const expected = provenanceConfig(policy).expected[unpinned ? "unpinned" : "pinned"];
  warnings.push(...provenanceWarnings(sides.map(([name, s]) => [name, s.provenance]), expected));

  const comparable = reasons.length === 0;
  let dropPercent = null;
  let verdict = "not comparable";
  if (comparable) {
    const diff = baseline.tokens.total - routed.tokens.total;
    dropPercent = dropPercentOf(diff, baseline.tokens.total);
    if (unpinned) verdict = "unpinned";
    else verdict = target === null ? "target not set" : dropMet(diff, baseline.tokens.total, target) ? "met" : "not met";
  }
  const strip = ({ alsoArchived, pinned, ...rest }) => rest;
  return {
    change: id,
    baseline: strip(baseline),
    routed: strip(routed),
    pinned: baseline.pinned,
    comparable,
    reasons,
    warnings,
    dropPercent,
    targetDropPercent: target,
    verdict,
  };
}

// Markdown form of the same pair object, so the two outputs cannot disagree.
function compareMarkdown(pair) {
  const { baseline: b, routed: r } = pair;
  const row = (label, f) => `| ${label} | ${f(b)} | ${f(r)} |`;
  const list = (a) => (a.length ? a.join(", ") : "none");
  const withSteps = (key) => (s) => `${s[key].total} (${s[key].stepsWithFigures} of ${s.steps})`;
  const models = (s) => {
    const names = Object.keys(s.tokens.byModel).sort();
    return names.length ? names.map((m) => `${m} ${s.tokens.byModel[m]}`).join(", ") : "none";
  };
  const tiers = (s) => {
    const names = Object.keys(s.tokens.byTier).sort();
    return names.length ? names.map((t) => `${t} ${s.tokens.byTier[t]}`).join(", ") : "none";
  };
  return [
    `# Usage comparison: ${pair.change}`,
    "",
    "| | Baseline | Routed |",
    "| --- | --- | --- |",
    row("Outcome", (s) => s.outcome ?? "none"),
    row("Rigor", (s) => s.rigor ?? "none"),
    row("Steps", (s) => s.steps),
    row("Skipped", (s) => list(s.skipped)),
    row("Failed attempts", (s) => s.failedAttempts),
    row("Tokens", withSteps("tokens")),
    row("Tool uses", withSteps("toolUses")),
    row("Duration (ms)", withSteps("durationMs")),
    row("Plan phases and rows", (s) => (s.plan ? `${s.plan.phases} and ${s.plan.rows}` : "none")),
    row("Source", (s) => s.source),
    "",
    `Tokens by model, baseline: ${models(b)}`,
    `Tokens by model, routed: ${models(r)}`,
    `Tokens by tier, baseline: ${tiers(b)}`,
    `Tokens by tier, routed: ${tiers(r)}`,
    "",
    `Baseline pinned to sonnet at high effort: ${pair.pinned ? "yes" : "no"}`,
    `Drop: ${pair.dropPercent === null ? "none" : `${pair.dropPercent}%`} (rounded down to 2 decimals; the verdict uses exact tokens)`,
    `Target: ${pair.targetDropPercent === null ? "not set" : `${pair.targetDropPercent}%`}`,
    `Verdict: ${pair.verdict}. Unit: raw tokens, a proxy for the weekly limit.`,
    `Reasons: ${list(pair.reasons)}`,
    `Warnings: ${list(pair.warnings)}`,
    "",
  ].join("\n");
}

function compareCommand(id, flags, policy) {
  const pair = comparePair(id, flags, policy);
  if (flags.format === "md") {
    process.stdout.write(compareMarkdown(pair));
    process.exit(0);
  }
  out(pair);
}

function status(id, flags) {
  const p = paths(id);
  const log = readLog(p.log);
  const res = {
    change: id,
    rigor: readMeta(p.meta, {}).rigor?.level ?? null,
    steps: log.map((e) => e.skipped ? {
      skipped: true, step: e.step, reason: e.reason, rigor: e.rigor ?? null, afterN: e.afterN ?? null, risk: e.risk ?? null,
      ...(e.score ? { score: e.score } : {}),
    } : ({
      n: e.n, step: e.step, template: e.template ?? null, model: e.model, effort: e.effort, simple: e.simple ?? null,
      ok: e.ok ?? null, verified: e.verified ?? null, note: e.result?.note ?? null, reason: e.reason,
      usage: e.usage ?? null,
      ...(e.step === "manual-verify" ? {
        ticked: e.ticked?.length ?? 0,
        unproven: e.unproven?.length ?? 0,
        proved: (Array.isArray(e.proved) ? e.proved : []).reduce((acc, r) => {
          const kind = isObject(r) && typeof r.kind === "string" ? r.kind : "other";
          acc[kind] = (acc[kind] ?? 0) + 1;
          return acc;
        }, {}),
        pending: Array.isArray(e.pending) ? e.pending.length : 0,
      } : {}),
      ...(e.score ? { score: e.score } : {}),
      ...(e.invalid ? { invalid: e.invalid } : {}),
      ...(e.scoreShift ? { scoreShift: e.scoreShift } : {}),
      ...(typeof e.agent === "string" ? { agent: e.agent } : {}),
      ...(isObject(e.review) ? { review: e.review } : {}),
      ...(typeof e.commit === "string" ? { commit: e.commit.slice(0, 7) } : {}),
      ...(typeof e.rolledBack === "string" ? { rolledBack: e.rolledBack } : {}),
      ...(typeof e.kept === "string" ? { kept: e.kept } : {}),
    })),
  };
  if (flags.report) {
    guardArchived(p, id);
    if (!fs.existsSync(p.change)) out({ action: "halt", reason: `No change folder context/changes/${id}.` }, 1);
    const meta = readMeta(p.meta, { id, goal: "" });
    res.report = writeReport(p, id, meta, log);
  }
  out(res);
}

// ---- main -----------------------------------------------------------------

function main() {
  const [cmd, id, ...rest] = process.argv.slice(2);
  if (!cmd || !id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    halt("Usage: route.mjs init|next|status|risk <change-id> [--goal text] [--rigor level] [--archive] [--chrome [false]] [--report] | verify-archive <change-id> [--path <p>] | compare <change-id> --baseline <dir> [--routed <dir>] [--format md] [--unpinned]");
  }
  const policy = loadPolicy();
  const flags = parseFlags(rest);

  if (cmd === "init") {
    const levels = rigorLevels(policy);
    // --rigor is checked before anything is written.
    if (flags.rigor !== undefined && (typeof flags.rigor !== "string" || !levels.includes(flags.rigor))) {
      halt(`Invalid --rigor ${flags.rigor === true ? "(no value)" : flags.rigor}. Use one of: ${levels.join(", ")}.`);
    }
    // --archive is checked before anything is written: a bare flag or "true" turns it on, "false" turns it off.
    let archive;
    if (flags.archive !== undefined) {
      if (flags.archive === true || flags.archive === "true") archive = true;
      else if (flags.archive === "false") archive = false;
      else halt(`Invalid --archive ${flags.archive}. Use --archive, --archive true or --archive false.`);
    }
    // --chrome is checked before anything is written, like --archive: a bare flag or "true" stores true, "false" stores false.
    // Chrome is on by default, so only a stored false turns the Chrome rules off; a resume without the flag keeps the value.
    let chrome;
    if (flags.chrome !== undefined) {
      if (flags.chrome === true || flags.chrome === "true") chrome = true;
      else if (flags.chrome === "false") chrome = false;
      else halt(`Invalid --chrome ${flags.chrome}. Use --chrome, --chrome true or --chrome false.`);
    }
    const p = paths(id);
    guardArchived(p, id);
    const prev = readMeta(p.meta, {});
    // No flag keeps the stored value, so a resume of an archive run is checked again.
    if ((archive ?? prev.archive) === true) {
      const timeout = policy.archive?.gitTimeoutMs;
      const inside = runGit(["rev-parse", "--is-inside-work-tree"], { timeout });
      if (inside.status !== 0 || inside.stdout.trim() !== "true") {
        halt(`${notWorkTree(inside, timeout)} Nothing was written.`);
      }
      const ignored = ignoredProbePaths(id, { timeout });
      if (ignored.length) {
        halt(`--archive needs git to track the change folder, but git ignores ${ignored.join(", ")}. Fix .gitignore or run without --archive. Nothing was written.`);
      }
    }
    // Run isolation (isolation.require true) is checked before anything is written. meta.isolated and meta.branch are
    // set only at an init whose log has no executed entry, so a run is isolated from its first step or not at all.
    const fresh = executed(readLog(p.log)).length === 0;
    const branch = isolationOn(policy) ? isolationCheck(id, policy, prev, fresh) : null;
    fs.mkdirSync(p.dir, { recursive: true });
    // An empty, blank or valueless --goal keeps the stored goal.
    const goal = typeof flags.goal === "string" && flags.goal.trim() ? flags.goal : typeof prev.goal === "string" ? prev.goal : "";
    // Keep every stored field (rigor and whatever later changes add); a stored rigor that is no object is dropped.
    const meta = { ...prev, id, goal };
    if (!isObject(prev.rigor)) delete meta.rigor;
    if (archive !== undefined) meta.archive = archive;
    if (chrome !== undefined) meta.chrome = chrome;
    if (branch !== null && fresh) { meta.isolated = true; meta.branch = branch; }
    if (flags.rigor !== undefined) {
      // On resume --rigor can raise the requested level, never lower it.
      const old = isObject(prev.rigor) && levels.includes(prev.rigor.requested) ? prev.rigor.requested : flags.rigor;
      meta.rigor = { ...meta.rigor, requested: maxLevel(levels, old, flags.rigor) };
    }
    // The commit the run started from: churn is counted up to it. Set once, kept on resume.
    if (!(typeof meta.baseSha === "string" && SHA_RE.test(meta.baseSha))) {
      delete meta.baseSha;
      const head = (gitOut(["rev-parse", "HEAD"]) ?? "").trim();
      if (SHA_RE.test(head)) meta.baseSha = head;
    }
    // What the run runs with: recorded at the first init of a run with no executed step, kept on resume, never
    // rewritten. A run with executed steps and no record (started before provenance existed) gets none.
    if (meta.provenance === undefined && executed(readLog(p.log)).length === 0) {
      const record = provenanceRecord(policy, meta);
      if (record) meta.provenance = record;
    }
    fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
    // The start commit of an isolated run, after baseSha and the meta.json write and before the first entry exists.
    if (meta.isolated === true && !Object.hasOwn(meta, "startCommit") && executed(readLog(p.log)).length === 0) {
      startCommit(p, id, meta, policy);
    }
    next(id, policy);
  } else if (cmd === "next") {
    next(id, policy);
  } else if (cmd === "status") {
    status(id, flags);
  } else if (cmd === "risk") {
    riskCommand(id, policy);
  } else if (cmd === "verify-archive") {
    verifyArchive(id, flags);
  } else if (cmd === "compare") {
    compareCommand(id, flags, policy);
  } else {
    halt(`Unknown command ${cmd}`);
  }
}

try {
  main();
} catch (e) {
  // Never a stack trace: a bad policy or a bad file ends the run with JSON.
  let reason = `Router error: ${e instanceof Error ? e.message : String(e)}`;
  // A rollback made earlier in this call is undone, as on any other halt, so the partial edits stay for a human.
  if (undoOnError) {
    const undo = undoOnError;
    undoOnError = null;
    let failed;
    try { failed = undo(); } catch (u) { failed = u instanceof Error ? u.message : String(u); }
    reason += failed ? ` The rollback was not undone: ${failed}` : " The rollback of the failed step was undone; its partial edits are back in the worktree.";
  }
  halt(reason);
}
