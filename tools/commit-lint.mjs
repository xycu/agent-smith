// Conventional Commits lint for the title and the commits of a pull request.
// The repository squash-merges, so the pull request title is the one subject that lands on main and
// release-please reads it to pick the SemVer bump (fix: patch, feat: minor, ! or BREAKING CHANGE: major).
// Title mode lints that title. Range mode lints the branch commits as hygiene (ADR-008, Amendment 2).
// This checks subjects only.
// Usage: node tools/commit-lint.mjs --title "<text>"
//        node tools/commit-lint.mjs <git range>, for example origin/main..HEAD
// Exit 0: every subject is valid. Exit 1: at least one is not. Exit 2: usage error or git failed.
// Plain node: built-ins only. Git is read-only here (git log).
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const TYPES = ["feat", "fix", "docs", "chore", "ci", "refactor", "perf", "test", "build", "revert"];

const SUBJECT = new RegExp(`^(${TYPES.join("|")})(\\([a-z0-9][a-z0-9._-]*\\))?!?: \\S`);

// Returns an error string for an invalid subject and null for a valid one.
export function lintSubject(subject) {
  // Git's default revert subject is: Revert "<original subject>". Accept it when the original is valid.
  const revert = /^Revert "(.+)"$/.exec(subject);
  if (revert) return lintSubject(revert[1]);
  if (SUBJECT.test(subject)) return null;
  return `expected "<type>(<scope>)!: <description>" with type one of ${TYPES.join(", ")}`;
}

// Returns [{ hash, subject, error }] for each invalid commit in the range. Throws when git fails.
export function lintRange(range, cwd = process.cwd()) {
  const run = spawnSync("git", ["log", "--no-merges", "--format=%h%x09%s", range], { cwd, encoding: "utf8" });
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
  const usage = 'usage: node tools/commit-lint.mjs --title "<text>"   or   node tools/commit-lint.mjs <git range>   (for example origin/main..HEAD)';
  const range = process.argv[2];
  if (range === "--title") {
    const title = process.argv[3];
    if (title === undefined) {
      console.error(usage);
      process.exit(2);
    }
    const error = lintSubject(title);
    if (error) {
      console.error(`commit-lint: the title is not a Conventional Commit: ${JSON.stringify(title)}\n  ${error}`);
      process.exit(1);
    }
    console.log("commit-lint: OK (title)");
    process.exit(0);
  }
  if (!range || range.startsWith("-")) {
    console.error(usage);
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
