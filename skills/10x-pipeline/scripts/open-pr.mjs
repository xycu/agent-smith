#!/usr/bin/env node
// Pushes the run branch of an isolated run and opens its pull request, or leaves the open one updated by the push.
// The orchestrator runs it from the run root at the end of every run. The router never calls it (ADR-017).
// It never merges, never reviews, never force-pushes, never deletes a branch, worktree or ref and never writes git config.
// Prints exactly one JSON object and exits 0 for every runtime outcome; exit 2 is for usage errors only.
// Plain node: built-ins only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const USAGE = "usage: node open-pr.mjs <change-id> [--chain 10x|openspec] [--report <path>] [--remote <name>] [--base <branch>] [--draft] [--timeout-ms <n>]";
const ID_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const REMOTE_RE = /^[A-Za-z0-9._][A-Za-z0-9._-]*$/;
const BRANCH_RE = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;
const DEFAULT_TIMEOUT_MS = 20000;
const GIT_TIMEOUT_MS = 120000;
const GH_HOST = "github.com";
const BRANCH_PREFIX = "agent-smith/";
const BODY_CAP = 60000;
const TITLE_CAP = 256;
const MENTION_RE = /(^|[^A-Za-z0-9_])@(?=[A-Za-z0-9])/g;
const COMMIT_MESSAGE = (id) => `chore(${id}): final run state`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { id: null, chain: "10x", report: null, remote: "origin", base: null, draft: false, timeoutMs: DEFAULT_TIMEOUT_MS };
  const valued = new Set(["--chain", "--report", "--remote", "--base", "--timeout-ms"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (valued.has(a)) {
      const value = argv[++i];
      if (value === undefined) throw new UsageError(`${a} needs a value`);
      if (a === "--chain") {
        if (value !== "10x" && value !== "openspec") throw new UsageError("--chain must be 10x or openspec");
        opts.chain = value;
      } else if (a === "--report") {
        opts.report = value;
      } else if (a === "--remote") {
        if (!REMOTE_RE.test(value)) throw new UsageError("--remote must be a remote name");
        opts.remote = value;
      } else if (a === "--base") {
        if (!BRANCH_RE.test(value) || value.includes("..") || value.endsWith("/")) throw new UsageError("--base must be a branch name");
        opts.base = value;
      } else if (/^\d+$/.test(value) && Number(value) > 0) {
        opts.timeoutMs = Number(value);
      } else {
        throw new UsageError("--timeout-ms must be a positive integer");
      }
    } else if (a === "--draft") {
      opts.draft = true;
    } else if (a.startsWith("-")) {
      throw new UsageError(`unknown flag ${a}`);
    } else if (opts.id === null) {
      opts.id = a;
    } else {
      throw new UsageError(`unexpected argument ${a}`);
    }
  }
  if (opts.id === null) throw new UsageError("missing <change-id>");
  if (!ID_RE.test(opts.id)) throw new UsageError("<change-id> must match ^[a-z0-9][a-z0-9-]{0,99}$");
  if (opts.report !== null) {
    const resolved = path.resolve(opts.report);
    if (path.basename(resolved) !== "report.md" || path.basename(path.dirname(resolved)) !== "agent-smith") {
      throw new UsageError("--report must name a file report.md inside a directory agent-smith");
    }
  }
  return opts;
}

function firstLine(text, max = 200) {
  return String(text ?? "").split(/\r?\n/).find((l) => l.trim() !== "")?.trim().slice(0, max) ?? "";
}

// Runs a command without a shell. Never throws. timedOut and missing are set instead.
function spawn(cmd, args, timeoutMs, env) {
  const res = spawnSync(cmd, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    env,
  });
  if (res.error) {
    const code = res.error.code;
    return {
      status: code === "ENOENT" ? 127 : code === "ETIMEDOUT" ? 124 : 1,
      stdout: "",
      stderr: String(res.error.message ?? ""),
      missing: code === "ENOENT",
      timedOut: code === "ETIMEDOUT",
    };
  }
  return { status: res.status ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "", missing: false, timedOut: false };
}

function runGh(args, timeoutMs) {
  return spawn("gh", args, timeoutMs, { ...process.env, GH_PROMPT_DISABLED: "1" });
}

function runGit(args, timeoutMs = GIT_TIMEOUT_MS) {
  return spawn("git", args, timeoutMs, { ...process.env, GIT_TERMINAL_PROMPT: "0" });
}

const gitOut = (args) => {
  const res = runGit(args);
  return res.status === 0 ? res.stdout.trim() : null;
};

function gitError(res, fallback) {
  if (res.timedOut) return "git timed out";
  if (res.missing) return "git is not installed";
  return firstLine(res.stderr) || firstLine(res.stdout) || `${fallback} exited ${res.status}`;
}

function result(fields) {
  return {
    pushed: false,
    committed: null,
    commit: null,
    commitError: null,
    branch: null,
    remote: null,
    base: null,
    pr: { action: "skipped", url: null, state: null, reason: null },
    reason: null,
    manual: null,
    ...fields,
  };
}

const prSkip = (reason, extra = {}) => ({ action: "skipped", url: null, state: null, reason, ...extra });

// Guard: a linked worktree whose HEAD is the branch agent-smith/<id>. Reads only.
function checkIsolated(id) {
  const inside = gitOut(["rev-parse", "--is-inside-work-tree"]);
  if (inside !== "true") return { skip: "run is not isolated: not a git work tree" };
  const dirs = gitOut(["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"]);
  const [gitDir, commonDir] = (dirs ?? "").split("\n");
  if (!gitDir || !commonDir) return { skip: "run is not isolated: git directories unreadable" };
  const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
  if (real(gitDir) === real(commonDir)) return { skip: "run is not isolated: this is the main checkout, not a linked worktree" };
  const branch = gitOut(["symbolic-ref", "-q", "--short", "HEAD"]);
  if (!branch) return { skip: "run is not isolated: HEAD is detached" };
  if (branch !== `${BRANCH_PREFIX}${id}`) return { skip: `run is not isolated: HEAD is on ${branch}, not ${BRANCH_PREFIX}${id}` };
  const top = gitOut(["rev-parse", "--show-toplevel"]);
  return { branch, top };
}

// owner/repo of a github.com remote url (https, ssh or scp form), else null.
export function parseRepo(url) {
  const s = String(url ?? "").trim();
  const patterns = [
    /^https:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
    /^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
    /^(?:[^@/]+@)?([^/:]+):([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
  ];
  for (const re of patterns) {
    const m = re.exec(s);
    if (!m) continue;
    if (m[1].toLowerCase() !== GH_HOST) return null;
    if (!/^[A-Za-z0-9_.-]+$/.test(m[2]) || !/^[A-Za-z0-9_.-]+$/.test(m[3])) return null;
    return `${m[2]}/${m[3]}`;
  }
  return null;
}

function remoteHeadBranch(remote) {
  const ref = gitOut(["symbolic-ref", "-q", `refs/remotes/${remote}/HEAD`]);
  const prefix = `refs/remotes/${remote}/`;
  return ref && ref.startsWith(prefix) ? ref.slice(prefix.length) : null;
}

// The nearest remote branch the run descends from: fewest commits between it and HEAD, ties to <remote>/HEAD.
function nearestBase(remote, branch) {
  const prefix = `refs/remotes/${remote}/`;
  const refs = (gitOut(["for-each-ref", "--format=%(refname)", prefix]) ?? "").split("\n").filter(Boolean);
  const head = remoteHeadBranch(remote);
  let best = null;
  for (const ref of refs.sort()) {
    const name = ref.slice(prefix.length);
    if (name === "HEAD" || name === branch || name.startsWith(BRANCH_PREFIX)) continue;
    if (runGit(["merge-base", "--is-ancestor", ref, "HEAD"]).status !== 0) continue;
    const count = Number(gitOut(["rev-list", "--count", `${ref}..HEAD`]));
    if (!Number.isInteger(count)) continue;
    if (!best || count < best.count || (count === best.count && name === head && best.name !== head)) best = { name, count };
  }
  return best ? best.name : null;
}

function resolveBase(opts, branch, repo) {
  if (opts.base) return { base: opts.base };
  const nearest = nearestBase(opts.remote, branch);
  if (nearest) return { base: nearest };
  const head = remoteHeadBranch(opts.remote);
  if (head) return { base: head };
  if (repo) {
    const res = runGh(["repo", "view", repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"], opts.timeoutMs);
    const name = res.status === 0 ? res.stdout.trim() : "";
    if (name !== "" && BRANCH_RE.test(name)) return { base: name };
  }
  return { skip: "base branch not found: pass --base <branch>" };
}

function countAhead(remote, base) {
  for (const ref of [`refs/remotes/${remote}/${base}`, `refs/heads/${base}`]) {
    if (runGit(["rev-parse", "-q", "--verify", `${ref}^{commit}`]).status !== 0) continue;
    const count = Number(gitOut(["rev-list", "--count", `${ref}..HEAD`]));
    if (Number.isInteger(count)) return { count };
  }
  return { skip: `base branch ${base} not found on ${remote} or locally` };
}

// Commits what the worktree holds after the router's last write. On failure it undoes its own add.
function commitLeftovers(id) {
  const status = runGit(["status", "--porcelain"]);
  if (status.status !== 0) return { committed: false, error: gitError(status, "git status") };
  if (status.stdout.trim() === "") return { committed: null };
  const add = runGit(["add", "-A"]);
  if (add.status !== 0) {
    runGit(["reset", "-q"]);
    return { committed: false, error: gitError(add, "git add") };
  }
  const commit = runGit(["commit", "-q", "-m", COMMIT_MESSAGE(id)]);
  if (commit.status !== 0) {
    runGit(["reset", "-q"]);
    return { committed: false, error: gitError(commit, "git commit") };
  }
  return { committed: true, commit: gitOut(["rev-parse", "HEAD"]) };
}

function changeDir(opts) {
  if (opts.report !== null) return path.dirname(path.dirname(path.resolve(opts.report)));
  return opts.chain === "openspec" ? path.join("openspec", "changes", opts.id) : path.join("context", "changes", opts.id);
}

function reportPath(opts) {
  return opts.report ?? path.join(changeDir(opts), "agent-smith", "report.md");
}

function readFile(file) {
  try {
    if (fs.statSync(file).isFile()) return fs.readFileSync(file, "utf8");
  } catch { /* unreadable */ }
  return null;
}

// title: of the frontmatter of change.md, else the id. OpenSpec changes have no change.md.
export function titleFor(id, text) {
  if (typeof text === "string") {
    const lines = text.split(/\r?\n/);
    if (lines[0] === "---") {
      for (const line of lines.slice(1)) {
        if (line === "---") break;
        const m = /^title:\s*(.*)$/.exec(line);
        if (m) {
          const title = m[1].trim().replace(/^(["'])(.*)\1$/, "$2").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
          if (title !== "") return title.slice(0, TITLE_CAP);
        }
      }
    }
  }
  return id;
}

export function markerFor(id) {
  return `<!-- agent-smith:pr change=${id} -->`;
}

// Marker line, blank line, the report lines before its first table row, mentions neutralized, capped like pr-comment.mjs.
export function buildBody(id, reportText, reportFile) {
  let head;
  if (typeof reportText === "string" && reportText.split(/\r?\n/)[0] === `# Run report: ${id}`) {
    const lines = reportText.split(/\r?\n/);
    const table = lines.findIndex((l) => l.trimStart().startsWith("|"));
    head = (table < 0 ? lines : lines.slice(0, table)).join("\n").trimEnd();
  } else {
    head = `Run report not found: ${reportFile}`;
  }
  const text = `${markerFor(id)}\n\n${head.replace(MENTION_RE, "$1@​")}\n`;
  if (text.length <= BODY_CAP) return text;
  let end = BODY_CAP;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  const kept = text.slice(0, end);
  return `${kept}\n\nReport truncated: ${text.length - kept.length} characters omitted.`;
}

function ghFailure(res, what) {
  if (res.missing) return "gh is not installed";
  if (res.timedOut) return "gh timed out";
  if (res.status === 4 || /gh auth login/.test(res.stderr)) return "gh is not authenticated";
  return `${what} failed: ${firstLine(res.stderr) || `gh exited ${res.status}`}`;
}

function openPullRequest(opts, branch, base, repo) {
  const list = runGh(["pr", "list", "--repo", repo, "--head", branch, "--state", "all", "--json", "number,url,state"], opts.timeoutMs);
  if (list.status !== 0 || list.missing || list.timedOut) return prSkip(ghFailure(list, "gh pr list"));
  let prs = null;
  try { prs = JSON.parse(list.stdout); } catch { /* prs stays null */ }
  if (!Array.isArray(prs) || prs.some((p) => !p || typeof p.url !== "string" || typeof p.state !== "string")) {
    return prSkip("unexpected gh output");
  }
  const open = prs.find((p) => p.state === "OPEN");
  if (open) return { action: "existing", url: open.url, state: "OPEN", reason: null };
  if (prs.length > 0) {
    return prSkip(`pull request is ${prs[0].state}`, { url: prs[0].url, state: prs[0].state });
  }
  const title = titleFor(opts.id, readFile(path.join(changeDir(opts), "change.md")));
  const file = reportPath(opts);
  const body = buildBody(opts.id, readFile(file), file);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "as-opr-"));
  try {
    const bodyFile = path.join(dir, "body.md");
    fs.writeFileSync(bodyFile, body);
    const args = ["pr", "create", "--repo", repo, "--head", branch, "--base", base, "--title", title, "--body-file", bodyFile];
    if (opts.draft) args.push("--draft");
    const res = runGh(args, opts.timeoutMs);
    if (res.status !== 0 || res.missing || res.timedOut) return prSkip(ghFailure(res, "gh pr create"));
    const url = res.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() ?? "";
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(url)) return prSkip("gh pr create failed: unexpected gh output");
    return { action: "created", url, state: "OPEN", reason: null };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function manualPr(repo, branch, base) {
  return repo && base ? `gh pr create --repo ${repo} --head ${branch} --base ${base} --fill` : null;
}

function manualFor(top, remote, branch, base, repo) {
  const push = `git -C "${top}" push ${remote} refs/heads/${branch}:refs/heads/${branch}`;
  const create = manualPr(repo, branch, base);
  return create ? `${push} && ${create}` : push;
}

function run(opts) {
  const guard = checkIsolated(opts.id);
  if (guard.skip) {
    return result({
      reason: guard.skip,
      pr: prSkip(guard.skip),
      manual: `run the script from the run worktree on ${BRANCH_PREFIX}${opts.id}`,
    });
  }
  const { branch, top } = guard;
  const base0 = { branch, remote: opts.remote };
  const url = gitOut(["remote", "get-url", opts.remote]);
  if (url === null) {
    const reason = `no remote ${opts.remote}`;
    return result({ ...base0, reason, pr: prSkip(reason), manual: `git -C "${top}" remote add ${opts.remote} <url>, then run the script again` });
  }
  const repo = parseRepo(url);
  const resolved = resolveBase(opts, branch, repo);
  if (resolved.skip) return result({ ...base0, reason: resolved.skip, pr: prSkip(resolved.skip), manual: manualFor(top, opts.remote, branch, null, repo) });
  const base = resolved.base;
  const ahead = countAhead(opts.remote, base);
  if (ahead.skip) return result({ ...base0, base, reason: ahead.skip, pr: prSkip(ahead.skip), manual: manualFor(top, opts.remote, branch, base, repo) });
  if (ahead.count === 0) {
    const reason = "no commits on the run branch";
    return result({ ...base0, base, reason, pr: prSkip(reason) });
  }
  const left = commitLeftovers(opts.id);
  const committed = { committed: left.committed, commit: left.commit ?? null, commitError: left.error ?? null };
  const push = runGit(["push", opts.remote, `refs/heads/${branch}:refs/heads/${branch}`]);
  if (push.status !== 0) {
    const reason = `push failed: ${gitError(push, "git push")}`;
    return result({ ...base0, ...committed, base, reason, pr: prSkip("not pushed"), manual: manualFor(top, opts.remote, branch, base, repo) });
  }
  const pushed = { ...base0, ...committed, base, pushed: true };
  if (!repo) {
    return result({ ...pushed, pr: prSkip(`remote ${opts.remote} is not a github.com repository`) });
  }
  const pr = openPullRequest(opts, branch, base, repo);
  // A MERGED or CLOSED pull request is a decision a human made: no manual command reopens it.
  return result({ ...pushed, pr, manual: pr.action === "skipped" && pr.state === null ? manualPr(repo, branch, base) : null });
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    process.stderr.write(`${e.message}\n${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  let out;
  try {
    out = run(opts);
  } catch (e) {
    const reason = `internal error: ${firstLine(e?.message) || "unknown"}`;
    out = result({ reason, pr: prSkip(reason) });
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
}

function isEntryPoint() {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();
