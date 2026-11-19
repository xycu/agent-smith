// Native sandbox uses the same config selection and cwd. Legacy sandbox_mode can be forced read-only, so failure
// cannot establish exec's effective permissions. Exec retains its hooks and execpolicy, which this filesystem proof
// does not exercise. Probe files have invalid ref names and are removed immediately. Commit proof uses an unrelated repo.
export const PERMISSION_PROBE = `
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { removeTree } from ${JSON.stringify(new URL("./remove-tree.mjs", import.meta.url).href)};
const [root, scratch] = process.argv.slice(2);
const git = (args, cwd = root) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const gitDir = fs.realpathSync(git(["rev-parse", "--path-format=absolute", "--git-dir"]));
const common = fs.realpathSync(git(["rev-parse", "--path-format=absolute", "--git-common-dir"]));
const dirs = [...new Set([gitDir, common, path.join(common, "objects"), path.join(common, "refs"), path.join(common, "refs/heads")])];
for (const dir of dirs) {
  const file = path.join(fs.realpathSync(dir), ".agent-smith-probe-" + crypto.randomUUID());
  let fd;
  try { fd = fs.openSync(file, "wx", 0o600); fs.writeSync(fd, "permission probe"); }
  finally { if (fd !== undefined) { fs.closeSync(fd); fs.unlinkSync(file); } }
}
const fixture = path.join(scratch, "git-proof");
fs.mkdirSync(fixture);
try {
  git(["init", "--quiet", "--initial-branch=main", fixture]);
  const identity = ["-c", "user.name=Agent Smith permission probe", "-c", "user.email=agent-smith@example.invalid"];
  git([...identity, "commit", "--quiet", "--allow-empty", "-m", "chore: initialize permission proof"], fixture);
  const linked = path.join(fixture, "linked");
  git(["worktree", "add", "--quiet", "--detach", linked, "HEAD"], fixture);
  fs.writeFileSync(path.join(linked, "proof.txt"), "child-owned commit proof\\n");
  git(["add", "--", "proof.txt"], linked);
  git([...identity, "commit", "--quiet", "-m", "test: prove child commit permissions", "-m", "Co-Authored-By: Agent Smith <agent-smith@example.invalid>"], linked);
  if (git(["log", "-1", "--format=%s"], linked) !== "test: prove child commit permissions") throw new Error("Commit proof was not retained");
  if (git(["status", "--porcelain"], linked)) throw new Error("Commit proof left uncommitted changes");
  process.stdout.write(JSON.stringify({ gitDir, commonDir: common, commit: git(["rev-parse", "HEAD"], linked) }) + "\\n");
} finally { removeTree(fixture); }
`;
