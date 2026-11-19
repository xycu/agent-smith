import { lstatSync } from "node:fs";
import { isAbsolute } from "node:path";

const MARKERS = ["MERGE_HEAD", "REVERT_HEAD", "CHERRY_PICK_HEAD", "rebase-merge", "rebase-apply", "sequencer"];

export function gitOperationProblem(git) {
  for (const name of MARKERS) {
    const where = git(["rev-parse", "--path-format=absolute", "--git-path", name]);
    // Strip Git's line terminator while preserving whitespace in the path itself.
    const file = where.stdout.endsWith("\n") ? where.stdout.slice(0, -1) : where.stdout;
    if (where.status !== 0 || !isAbsolute(file) || file.includes("\0")) {
      return `Cannot verify ${name} with git rev-parse --git-path.`;
    }
    try {
      lstatSync(file);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      return `Cannot inspect ${name} (${error.code}).`;
    }
    return `A merge, rebase, cherry-pick or revert is in progress (${name} exists); finish or abort it first.`;
  }
  const unmerged = git(["--no-literal-pathspecs", "ls-files", "--unmerged", "-z", "--", ":/"]);
  if (unmerged.status !== 0) return "Cannot verify the index with git ls-files --unmerged.";
  return unmerged.stdout === "" ? null : "The index holds unmerged entries; resolve them first.";
}
