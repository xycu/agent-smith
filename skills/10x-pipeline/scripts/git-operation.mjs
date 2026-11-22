import { lstatSync, statSync } from "node:fs";
import { basename, isAbsolute } from "node:path";

const MARKERS = ["MERGE_HEAD", "REVERT_HEAD", "CHERRY_PICK_HEAD", "rebase-merge", "rebase-apply", "sequencer"];

export function gitOperationProblem(git) {
  for (const name of MARKERS) {
    const where = git(["rev-parse", "--path-format=absolute", "--git-path", name]);
    const invalid = `Cannot verify ${name} with git rev-parse --git-path.`;
    if (where.status !== 0) return invalid;
    // Strip Git's LF and preserve the raw path bytes for filesystem lookups.
    const file = where.stdout.at(-1) === 0x0a ? where.stdout.subarray(0, -1) : where.stdout;
    const label = file.toString();
    if (!isAbsolute(label) || basename(label) !== name || file.includes(0)) return invalid;
    try {
      lstatSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") return `Cannot inspect ${name} (${error.code}).`;
      try {
        if (statSync(file.subarray(0, -name.length)).isDirectory()) continue;
      } catch (parentError) {
        return `Cannot inspect ${name} (${parentError.code}).`;
      }
      return invalid;
    }
    return `A merge, rebase, cherry-pick or revert is in progress (${name} exists); finish or abort it first.`;
  }
  const unmerged = git(["--no-literal-pathspecs", "ls-files", "--unmerged", "-z", "--", ":/"]);
  if (unmerged.status !== 0) return "Cannot verify the index with git ls-files --unmerged.";
  return unmerged.stdout.length === 0 ? null : "The index holds unmerged entries; resolve them first.";
}
