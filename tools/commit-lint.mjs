// Conventional Commits lint for the commits of a pull request.
// The repository rebase-merges, so every commit subject lands on main and release-please reads it
// to pick the SemVer bump (fix: patch, feat: minor, ! or BREAKING CHANGE: major). This checks subjects only.
// Usage: node tools/commit-lint.mjs <git range>, for example origin/main..HEAD
// Exit 0: every subject is valid. Exit 1: at least one is not. Exit 2: usage error or git failed.
// Plain node: built-ins only. Git is read-only here (git log).
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const TYPES = ["feat", "fix", "docs", "chore", "ci", "refactor", "perf", "test", "build", "revert"];

const SUBJECT = new RegExp(`^(${TYPES.join("|")})(\\([a-z0-9][a-z0-9._-]*\\))?!?: \\S`);

// Returns an error string for an invalid subject and null for a valid one.
export function lintSubject(subject) {
  if (subject.startsWith("Merge ")) return null;
  // Git's default revert subject is: Revert "<original subject>". Accept it when the original is valid.
  const revert = /^Revert "(.+)"$/.exec(subject);
  if (revert) return lintSubject(revert[1]);
  if (SUBJECT.test(subject)) return null;
  return `expected "<type>(<scope>)!: <description>" with type one of ${TYPES.join(", ")}`;
}

// Returns [{ hash, subject, error }] for each invalid commit in the range. Throws when git fails.
export function lintRange(range, cwd = process.cwd()) {
  const run = spawnSync("git", ["log", "--format=%h%x09%s", range], { cwd, encoding: "utf8" });
  if (run.status !== 0) throw new Error((run.stderr || "git log failed").trim());
  const lines = run.stdout.split("\n").filter(Boolean);
  if (lines.length === 0) throw new Error(`no commits in range ${range}`);
  const failures = [];
  for (const line of lines) {
    const tab = line.indexOf("\t");
    const hash = line.slice(0, tab);
    const subject = line.slice(tab + 1);
    const error = lintSubject(subject);
    if (error) failures.push({ hash, subject, error });
  }
  return failures;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const range = process.argv[2];
  if (!range || range.startsWith("-")) {
    console.error("usage: node tools/commit-lint.mjs <git range>   (for example origin/main..HEAD)");
    process.exit(2);
  }
  let failures;
  try {
    failures = lintRange(range);
  } catch (error) {
    console.error(`commit-lint: ${error.message}`);
    process.exit(2);
  }
  if (failures.length > 0) {
    console.error("commit-lint: these commits are not Conventional Commits:");
    for (const f of failures) console.error(`  ${f.hash} ${f.subject}\n    ${f.error}`);
    process.exit(1);
  }
  console.log(`commit-lint: OK (${range})`);
}
