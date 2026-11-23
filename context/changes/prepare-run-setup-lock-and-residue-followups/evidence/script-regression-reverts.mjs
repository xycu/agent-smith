import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// From the repository root, pass an empty scratch directory created with mktemp -d.
const scratch = fs.realpathSync(process.argv[2]);
assert.deepEqual(fs.readdirSync(scratch), []);
const skills = path.join(scratch, "skills");
fs.cpSync("skills", skills, { recursive: true });
const relativeScript = "skills/10x-pipeline/scripts/prepare-run.mjs";
const copy = path.join(scratch, relativeScript);
const fixed = fs.readFileSync(copy, "utf8");
const previous = spawnSync("git", ["show", "f2bbdee3^:" + relativeScript], { encoding: "utf8" });
assert.equal(previous.status, 0, previous.stderr);

function section(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

function revert(from, to) {
  return fixed.replace(section(fixed, from, to), () => section(previous.stdout, from, to));
}

const lookupTests = [
  "10x: unrelated linked branch, detached HEAD and other-chain metadata follow later cases",
  "openspec: unrelated linked branch, detached HEAD and other-chain metadata follow later cases",
  "linked opt-out reads pending setup without creating or changing the branch lock",
  "linked opt-out refuses a malformed pending record with a stale lock",
  "linked opt-out refuses a directory pending record with a stale lock",
  "an incomplete worktree with a committed opt-out points back to the original project",
];
const vanished = "linked opt-out handles ENOENT while reading pending setup (disappearing)";
const ioError = "linked opt-out handles EIO while reading pending setup (disappearing)";
const retained = "linked opt-out handles ENOENT while reading pending setup (retained)";
const unverifiable = "linked opt-out handles ENOENT while reading pending setup (unverifiable)";
const swappedSymlink = "linked opt-out refuses a pending record swapped for a symlink before opening";
const swappedDirectory = "linked opt-out refuses a pending record swapped for a directory before opening";
const stagingTests = [
  "interrupted pending publication 1 leaves one staging file and retries cleanly",
  "interrupted pending publication 2 leaves one staging file and retries cleanly",
  "pending publication replaces a stale staging symlink and preserves its target",
  "pending publication preserves a directory at its staging path and the canonical record",
];
const lockControl = "a preexisting setup lock is preserved for inspection";

function check(label, source, failures, controls) {
  fs.writeFileSync(copy, source);
  const names = [...failures, ...controls];
  const pattern = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const result = spawnSync(process.execPath, [
    "--test", "--test-reporter=tap", "--test-name-pattern", `^(${pattern})$`,
    "skills/10x-pipeline/test/prepare-run.test.mjs",
  ], { cwd: scratch, env: { ...process.env, TMPDIR: scratch }, encoding: "utf8", timeout: 120000 });
  assert.ifError(result.error);
  console.log(`\n=== ${label}, exit ${result.status} ===`);
  console.log(result.stdout.replaceAll(scratch, "<scratch>"));
  if (result.stderr) console.error(result.stderr.replaceAll(scratch, "<scratch>"));
  assert.equal(result.status, failures.length ? 1 : 0);
  const cases = [...result.stdout.matchAll(/^(not ok|ok) \d+ - (.+)$/gm)];
  assert.deepEqual(cases.filter(([, status]) => status === "not ok").map(([, , name]) => name).sort(), failures.slice().sort());
  assert.deepEqual(cases.filter(([, status]) => status === "ok").map(([, , name]) => name).sort(), controls.slice().sort());
}

function mutate(from, to) {
  assert.ok(fixed.includes(from));
  return fixed.replace(from, to);
}

check("Unmodified code", fixed, [],
  [...lookupTests, vanished, ioError, retained, unverifiable, swappedSymlink, swappedDirectory, ...stagingTests, lockControl]);
check("Restore the pre-selection lock", revert("  const checkCurrentPending", "  if (!isolationEnabled"), lookupTests, [ioError, lockControl]);
const guarded = 'lockFree && error.code === "ENOENT"';
check("Restore strict payload reads for a disappearing record", mutate(guarded, "false"), [vanished], [ioError, lockControl]);
check("Allow disappearance fallback after every payload error", mutate(guarded, "lockFree"), [ioError], [vanished, lockControl]);
check("Skip the absence confirmation", mutate(
  "try { if (!lstat(file)) return null; } catch { /* Preserve the original read error. */ }",
  "return null;",
), [retained, unverifiable], [vanished, ioError, lockControl]);
check("Follow a replacement symlink", mutate(
  "fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK",
  "fs.constants.O_RDONLY | fs.constants.O_NONBLOCK",
), [swappedSymlink], [swappedDirectory, lockControl]);
check("Skip the descriptor type check", mutate(
  'if (!fs.fstatSync(fd).isFile()) throw new Error("expected a regular file");',
  "",
), [swappedDirectory], [swappedSymlink, lockControl]);
check("Restore UUID staging", 'import { randomUUID } from "node:crypto";\n' + revert("function writePending(", "function routerState("), stagingTests, [lockControl]);
