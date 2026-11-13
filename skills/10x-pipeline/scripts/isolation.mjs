import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  SKILL_DIR, ROOT, out, readJson, mtime, readPlan, executed, writeLog, isFailure, isObject, SHA_RE, runGit,
  ignoredProbePaths, halt, coAuthorProblem, coAuthorTrailer, prCommentField,
} from "./state.mjs";
import { artifactFile } from "./preplan.mjs";
import { doneNotes, tierFor, render } from "./steps.mjs";
import { readOpenspec, openspecArchivePath } from "./openspec.mjs";
import { finishRun, endRun, promptText } from "./flow.mjs";

// ---- run provenance -------------------------------------------------------------

// What a run ran with: the plugin version, one hash per merged-policy section (prompts by resolved text), a hash of the
// plugin's agent definitions and the flags in force. Recorded once in meta.json and read by compare. Every input is
// only read; computing the record never throws, so it never halts init or next.
const PLUGIN_ROOT = path.resolve(SKILL_DIR, "../..");
const PROVENANCE_DEFAULTS = { ignore: ["compare", "provenance", "prices", "coAuthor"], expected: { pinned: ["ladder", "rigor", "score"], unpinned: ["score"] } };

// The provenance block of the policy. A list that is not an array of strings reads as the shipped default.
export function provenanceConfig(policy) {
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
// records the effective setting: on unless meta.chrome is false. `chain` is added only when meta.chain is set, so the
// flags of a 10x run keep their keys.
function provenanceFlags(policy, meta) {
  const minRigor = isObject(policy.score) ? policy.score.minRigor : null;
  return {
    archive: meta.archive === true,
    chrome: meta.chrome !== false,
    "score.minRigor": typeof minRigor === "string" ? minRigor : null,
    "agents.restricted": isObject(policy.agents) && policy.agents.restricted === true,
    "advisor.enabled": isObject(policy.advisor) && policy.advisor.enabled === true,
    ...(typeof meta.chain === "string" ? { chain: meta.chain } : {}),
  };
}

// The record init stores. null only if something unexpected throws: a run then has no record and reads as unknown.
export function provenanceRecord(policy, meta) {
  try {
    return { schemaVersion: 1, plugin: pluginVersion(), sections: provenanceSections(policy), flags: provenanceFlags(policy, meta) };
  } catch { return null; }
}

// Adds every section whose hash differs from the record to provenance.drift (sorted, each name once, omitted while
// empty). The recorded hashes are never touched, and a run without a record gets none. Returns true when drift
// changed, so the caller writes meta.json. plugin and flags are not drift-tracked.
export function recordDrift(meta, policy) {
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
export function provenanceWarnings(sides, expected) {
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
export function authorityLine(p, policy, template) {
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
export function gitMessage(res) {
  const text = `${res.stderr}\n${res.stdout}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6).join(" | ");
  return text || `exit status ${res.status}`;
}

// The halt text when `rev-parse --is-inside-work-tree` did not answer "true". A git that is missing or timed out
// is reported as such, not as "not a work tree".
export function notWorkTree(inside, timeout, need = "--archive needs") {
  if (inside.timedOut) return `${need} a git work tree, but git timed out after ${timeout} ms while checking ${ROOT}.`;
  if (inside.status === 127) return `${need} a git work tree, but git could not be run: ${gitMessage(inside)}.`;
  if (inside.status !== 0) return `${need} a git work tree and ${ROOT} is not one: ${gitMessage(inside)}.`;
  return `${need} a git work tree and ${ROOT} is not one.`;
}

// The git safety checks shared by the pre-archive commit, the start and step commits of an isolated run and the
// rollback, all reads: a work tree, git ignoring a router file (only with `id`), a symbolic HEAD, no merge, rebase,
// cherry-pick or revert in progress and, unless `emptyIndex` is false, an empty index. Returns null or the reason.
// `chain` picks the router files probed with `id` (ignoredProbePaths).
function gitSafety(g, timeout, { id = null, emptyIndex = true, need, chain = "10x" } = {}) {
  const inside = g(["rev-parse", "--is-inside-work-tree"]);
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return notWorkTree(inside, timeout, need);
  if (id !== null) {
    const ignoredProbes = ignoredProbePaths(id, { timeout, chain });
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
export const isolationOn = (policy) => isObject(policy.isolation) && policy.isolation.require === true;

// The isolation checks of init, all reads. Returns the short branch name, or halts and writes nothing.
// `chain` picks the router files git must not ignore (ignoredProbePaths).
// A linked worktree has a git dir that differs from the common dir; both are compared as absolute paths, because
// from a subdirectory of the main checkout the plain forms differ as strings (/abs/.git and ../.git).
export function isolationCheck(id, policy, prev, fresh, chain = "10x") {
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
  const ignored = ignoredProbePaths(id, { timeout, chain });
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
export function worktreeLine(policy, meta) {
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
// With `rel` the post-commit checks also run when nothing was staged (a resume). Returns { commit, made } or
// { error, reason?, commit?, made? }. `made` says whether this call made a commit; `commit` is its full hash, or null
// when nothing was staged or the hash could not be read, so it is never a label. An error with `reason`, `commit` and
// `made` came from the post-commit checks; an error without them came before a commit and the router's own add was
// unstaged. Without `rel` a commit that was made also returns `names`: the git-root-relative paths it holds
// (`--no-renames`), read before the commit so the step commit can record them; a failed read is a failed add.
function routerCommit(g, timeout, { rel = null, message, trailer = null }) {
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
  if (check.status === 0 && !rel) return { commit: null, made: false };
  if (check.status !== 0 && check.status !== 1) return failed("diff --cached", check);
  const made = check.status === 1;
  let commit = null;
  let names;
  if (made && !rel) {
    const listed = g(["diff", "--cached", "--name-only", "--no-renames", "-z"]);
    if (listed.status !== 0) return failed("diff --cached --name-only", listed);
    names = listed.stdout.split("\0").filter(Boolean);
  }
  if (made) {
    // The trailer sits right after the message and before the `--` of the pathspec form.
    const msg = ["-m", message, ...(trailer ? ["--trailer", trailer] : [])];
    const res = g(rel ? ["commit", ...msg, "--", rel] : ["commit", ...msg]);
    if (res.status !== 0) return failed("commit", res);
    const head = g(["rev-parse", "HEAD"]);
    if (head.status === 0 && head.stdout.trim()) commit = head.stdout.trim();
  }
  const after = (reason) => ({
    error: made ? `${reason} The commit ${commit ? commit.slice(0, 7) : "HEAD"} exists and the router does not undo it.` : reason,
    reason,
    commit,
    made,
    ...(names ? { names } : {}),
  });
  const left = g(["diff", "--cached", "--quiet"]);
  if (left.status !== 0) {
    const staged = g(["diff", "--cached", "--name-only", "-z"]).stdout.split("\0").filter(Boolean);
    return after(`The index is not empty after the commit (a hook staged something): ${listNames(staged)} (paths relative to the git root).`);
  }
  if (rel) {
    const prefix = (g(["rev-parse", "--show-prefix"]).stdout ?? "").replace(/\r?\n$/, "");
    if (made) {
      const shown = g(["show", "--name-only", "-z", "--format=", "HEAD"]);
      if (shown.status !== 0) return after(`Cannot list the commit: ${gitMessage(shown)}`);
      const extra = shown.stdout.split("\0").filter(Boolean).filter((name) => !name.startsWith(`${prefix}${rel}/`));
      if (extra.length) return after(`The commit holds paths outside ${rel}: ${listNames(extra)} (paths relative to the git root).`);
    }
    const unclean = statusEntries(["--", `${rel}/`], { timeout });
    if (unclean === null) return after("Cannot read the status of the change folder.");
    if (unclean.length) {
      const unprefix = (file) => (file.startsWith(prefix) ? file.slice(prefix.length) : file);
      return after(`The change folder is not clean after the commit: ${listNames(unclean.map((e) => unprefix(e.file)))}.`);
    }
  }
  return { commit, made, ...(names ? { names } : {}) };
}

// ---- late usage figure in the archive state ---------------------------------

// The change folder of a run, relative to the project root.
const changeRel = (p, id) => (p.chain === "openspec" ? `openspec/changes/${id}` : `context/changes/${id}`);

// The rendered archive.usageMessage, or null when the template is not a non-blank string or renders blank.
function usageMessage(policy, id, n) {
  const tpl = policy.archive?.usageMessage;
  if (typeof tpl !== "string" || !tpl.trim()) return null;
  return render(tpl, { id, n: String(n) }).trim() || null;
}

// The reads the `usage` command makes before it writes anything for a run in the archive state (an ended `--archive`
// run): the git safety checks of the archive commit, the run branch of an isolated run and a clean change folder.
// Returns null or the reason.
export function lateUsagePrecheck(p, id, meta, policy) {
  const timeout = policy.archive?.gitTimeoutMs;
  const g = (args) => runGit(args, { timeout });
  const rel = changeRel(p, id);
  if (usageMessage(policy, id, 1) === null) return "policy.archive.usageMessage must be a non-blank string.";
  const bad = coAuthorProblem(policy);
  if (bad) return bad;
  const unsafe = gitSafety(g, timeout, { id, chain: p.chain === "openspec" ? "openspec" : "10x" });
  if (unsafe) return unsafe;
  if (meta.isolated === true) {
    const wrong = runBranchReason(g, meta);
    if (wrong) return wrong;
  }
  const dirty = statusEntries(["--", `${rel}/`], { timeout });
  if (dirty === null) return "Cannot read the status of the change folder.";
  if (dirty.length) {
    return `The change folder ${rel} is not clean; the archive may have started, or the pre-archive commit failed.`;
  }
  return null;
}

// Commits the change folder with the rendered archive.usageMessage: the folder-only commit of the archive path with
// its post-commit checks. Returns what routerCommit returns: `made` says whether the commit exists.
export function lateUsageCommit(p, id, policy, n) {
  const timeout = policy.archive?.gitTimeoutMs;
  const g = (args) => runGit(args, { timeout });
  const message = usageMessage(policy, id, n);
  if (message === null) return { error: "policy.archive.usageMessage must be a non-blank string." };
  const bad = coAuthorProblem(policy);
  if (bad) return { error: bad };
  return routerCommit(g, timeout, { rel: changeRel(p, id), message, trailer: coAuthorTrailer(policy) });
}

// The start commit of the first init of an isolated run: the change folder as the orchestrator copied it, plus
// meta.json, so the first step's startSha holds the run's inputs. meta.startCommit is the guard (the hash, or null
// when nothing was staged or the hash could not be read); a failure that made no commit leaves it absent, so the
// next init retries. Halts on any failure.
export function startCommit(p, id, meta, policy) {
  const timeout = policy.isolation?.gitTimeoutMs;
  const g = (args) => runGit(args, { timeout });
  const stop = (reason) => halt(`The start commit of the run was not made: ${reason}`);
  const where = runBranchReason(g, meta);
  if (where) stop(where);
  const unsafe = gitSafety(g, timeout, { need: "The start commit needs" });
  if (unsafe) stop(unsafe);
  const message = isolationMessage(policy, "startMessage", { id });
  if (message === null) stop("policy.isolation.commit.startMessage must be a non-blank string.");
  const bad = coAuthorProblem(policy);
  if (bad) stop(bad);
  const rel = changeRel(p, id);
  const res = routerCommit(g, timeout, { rel, message, trailer: coAuthorTrailer(policy) });
  if (res.made || !res.error) {
    meta.startCommit = res.commit;
    fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
  }
  if (res.error) stop(res.error);
}

// The step commit of an isolated run: right after attachResult, when the last executed entry is ok and has no
// `commit` key, everything the step left is committed (run.jsonl first, so the commit holds the step's result).
// The entry gets `commit` (the hash, or null for an empty index or an unreadable hash), so a resume never commits
// again under its name; the paths of the commit outside the change folder go to `swept` (sorted, only when there are
// any; ADR-010 Amendment 1), so a report can name the code that went in under the chore subject;
// a failure before the commit leaves the key absent, so the resume retries. Halts on any failure.
export function stepCommit(p, id, meta, log, policy) {
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
  const bad = coAuthorProblem(policy);
  if (bad) stop(bad);
  const res = routerCommit(g, timeout, { message, trailer: coAuthorTrailer(policy) });
  if (res.made || !res.error) {
    last.commit = res.commit;
    // Names are relative to the git root; without the prefix they cannot be told from the change folder, so none is recorded.
    const shown = res.names ? g(["rev-parse", "--show-prefix"]) : null;
    if (shown?.status === 0) {
      const inside = `${(shown.stdout ?? "").replace(/\r?\n$/, "")}${changeRel(p, id)}/`;
      const swept = res.names.filter((name) => !name.startsWith(inside)).sort();
      if (swept.length) last.swept = swept;
    }
  }
  if (res.error) stop(res.error);
  writeLog(p.log, log);
}

// The files whose times decide compares while no plan or plan-review step is logged, keyed as in before.mtimes.
// Only paths the chain has: an OpenSpec run has no plan or review files and reads tasks.md and verify.md instead.
const timedFiles = (p) => Object.fromEntries(Object.entries({
  plan: p.plan, planReview: p.planReview, implReview: p.implReview,
  ...(p.chain === "openspec" ? { tasks: p.tasks, verify: p.verify } : {}),
}).filter(([, file]) => typeof file === "string"));
export const fileTimes = (p) => Object.fromEntries(Object.entries(timedFiles(p)).map(([key, file]) => [key, mtime(file)]));

// Sets each file that exists and has a recorded time above 0 back to that time (fs.utimesSync, no git).
export function setTimes(p, times) {
  if (!isObject(times)) return;
  for (const [key, file] of Object.entries(timedFiles(p))) {
    const t = times[key];
    if (typeof t === "number" && Number.isFinite(t) && t > 0 && fs.existsSync(file)) fs.utimesSync(file, t / 1000, t / 1000);
  }
}

// run.jsonl and meta.json as next holds them in memory, written back after a reset changed them on disk.
export function writeState(p, meta, log) {
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
export function rollback(p, id, meta, log, policy) {
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
  const bad = coAuthorProblem(policy);
  if (bad) stop(bad);
  const trailer = coAuthorTrailer(policy);
  const left = fileTimes(p); // the times the failed step left, for the undo on halt
  const step = (args) => {
    const res = g(args);
    if (res.status !== 0) stop(`git ${args[0]} failed: ${gitMessage(res)}.`);
    return res.stdout.trim();
  };
  step(["add", "-A"]);
  const tree = step(["write-tree"]);
  const snapshot = step(["commit-tree", tree, "-p", "HEAD", "-m", `agent-smith: failed step ${last.n} (${last.step})`, ...(trailer ? ["-m", trailer] : [])]);
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

const COMMIT_EXISTS = "The pre-archive commit exists, is local and is not undone by the router. A resume makes no commit, " +
  "so the check that the commit touched only the change folder (post-commit check 2) is not repeated; clearing the index " +
  "does not remove a path the commit already holds (amend the commit, or accept it). `next` repeats safely after the cause is fixed.";

// The done branch of a run with --archive. Pre-checks, final report, commit, post-commit checks, then the archive action.
// While the folder is not committed a halt may write the end state (endRun). Once the commit exists, or the run is
// written as done, a halt only prints (out): rewriting meta.json or report.md would dirty the committed folder.
// An OpenSpec run (ADR-013 D5) commits openspec/changes/<id>/, needs no created: line, halts on an open task row,
// names the folder `openspec archive` will create and returns the os-archive prompt at the tier of steps["os-archive"].
export function archiveDone(p, id, meta, log, policy, level, d) {
  const openspec = p.chain === "openspec";
  const rel = changeRel(p, id);
  const ran = executed(log);
  const timeout = policy.archive?.gitTimeoutMs;
  const g = (args) => runGit(args, { timeout });
  const pr = prCommentField(meta);

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
      return out({ action: "halt", reason: `${reason} ${COMMIT_EXISTS}`, steps: ran.length, archive: SKIP_COMMITTED, committed: true, ...pr });
    }
    return endRun(p, id, meta, log, { action: "halt", reason: `${reason} Nothing was committed.`, steps: ran.length });
  };
  const unsafe = gitSafety(g, timeout, { id, chain: openspec ? "openspec" : "10x" });
  if (unsafe) precheck(unsafe);
  let archivePath;
  if (openspec) {
    const tasks = readOpenspec(p).tasks;
    if (tasks.open > 0) {
      precheck(`${rel}/tasks.md has ${tasks.open} open task row(s) of ${tasks.total}; an OpenSpec change is archived only with every task ticked. Needs a human.`);
    }
    archivePath = openspecArchivePath(id);
    if (fs.existsSync(path.join(ROOT, archivePath))) {
      precheck(`Archive destination ${archivePath} already exists; openspec archive would refuse it (archive_target_exists). Needs a human.`);
    }
  } else {
    const created = createdValue(path.join(p.change, "change.md"));
    if (created === null || !CREATED_RE.test(created)) {
      precheck(`change.md needs a line "created: YYYY-MM-DD" (found ${created === null ? "none" : JSON.stringify(created)}); /10x-archive builds the archive folder name from it.`);
    }
    archivePath = `context/archive/${created}-${id}`;
    if (fs.existsSync(path.join(ROOT, archivePath))) {
      precheck(`Archive destination ${archivePath} already exists; a reused id on the same date needs a human.`);
    }
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
  const badCoAuthor = coAuthorProblem(policy);
  if (badCoAuthor) precheck(badCoAuthor);
  let settled;
  try {
    settled = tierFor({ step: openspec ? "os-archive" : "archive" }, ran, policy, readPlan(p.plan), meta, level);
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

  // 4. Final report, then the commit and the post-commit checks (routerCommit). A halt after the commit exists only prints.
  const done = finishRun(p, id, meta, log, { action: "done", reason: d.reason, manualPending, ...doneNotes(d), steps: ran.length });
  // A report that could not be written halts here, before anything is staged or committed.
  if (done.reportError) {
    return out({
      action: "halt",
      reason: `report.md was not written: ${done.reportError}. Nothing was committed.`,
      steps: ran.length,
      archive: SKIP_FAILED,
      committed: false,
      ...pr,
    });
  }
  const res = routerCommit(g, timeout, { rel, message, trailer: coAuthorTrailer(policy) });
  if (res.error) {
    return res.commit === undefined
      ? out({ action: "halt", reason: res.error, steps: ran.length, archive: SKIP_FAILED, committed: false, ...pr })
      : out({ action: "halt", reason: `${res.reason} ${COMMIT_EXISTS}`, steps: ran.length, archive: SKIP_COMMITTED, committed: true, ...pr });
  }

  // 6. The archive action. No log entry and no resultFile: nothing may be written into the folder that moves.
  // "HEAD" stands for a commit this call made whose hash could not be read; null means no commit was made.
  const commit = res.made ? (res.commit ? res.commit.slice(0, 7) : "HEAD") : null;
  const body = openspec ? render(promptText(policy, "os-archive"), { id }) : render(promptText(policy, "archive"), { id });
  const prompt = worktreeLine(policy, meta) + body.trim() + "\n\n" + promptText(policy, "suffix");
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
    ...pr,
  });
}
