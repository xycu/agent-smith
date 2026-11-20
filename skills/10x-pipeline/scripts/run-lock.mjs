// Standalone lock shared by router commands, external execution and terminal publication.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function liveRunDirectory(root, id, chain) {
  return path.join(root, chain === "openspec" ? "openspec/changes" : "context/changes", id, "agent-smith");
}

// The lock lives in the OS temp directory, outside the change folder, so no step commit or archive-state check sees it.
export function runLockPath(dir) {
  return path.join(os.tmpdir(), `agent-smith-${crypto.createHash("sha256").update(dir).digest("hex").slice(0, 16)}.lock`);
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code !== "ESRCH"; }
}

// Takes the lock of the run or halts. The pid is in the file from the moment it exists: written to a private temp file,
// then linked to the lock name, so a second caller never reads an empty lock as stale.
export function lockRunDirectory(root, id, chain, onBusy) {
  const lock = runLockPath(liveRunDirectory(root, id, chain));
  const nativeSuspension = (threadId, claudeSession) =>
    `Execution suspended: native ownership unresolved (lock file ${lock}, ${claudeSession ? "Claude session " + claudeSession : "thread " + (threadId ?? "unknown")}). `
    + "Keep the enabling revision and TMPDIR. Await an active runner through its existing handle. "
    + "If it has exited, the authorized owner must inspect the recorded thread and its descendants, prove settlement and arrange router-owned recovery before mutation, relaunch or publication. "
    + "Automatic recovery for a retained native lock is unavailable.";
  const tmp = `${lock}.${process.pid}.tmp`;
  let own = String(process.pid);
  let execution = null;
  fs.writeFileSync(tmp, own);
  const unlinkQuiet = (file) => { try { fs.unlinkSync(file); } catch { /* already gone */ } };
  const guard = `${lock}.takeover`;
  const removeGuard = () => {
    try { if (fs.readFileSync(guard, "utf8") === String(process.pid)) unlinkQuiet(guard); } catch { /* not held */ }
  };
  // The temp file is always this process's. The lock is removed only while it still holds this pid, so a lock
  // another process holds, or took over, is never touched.
  const release = () => {
    unlinkQuiet(tmp);
    removeGuard();
    // An abrupt exit must leave child ownership available to the next caller.
    if (execution) return;
    let holder = null;
    try { holder = fs.readFileSync(lock, "utf8"); } catch { /* already gone */ }
    if (holder === own) unlinkQuiet(lock);
  };
  // Returns the reason the lock must not be taken, or null when it is stale (dead pid, unparsable text, vanished).
  const busyReason = (contents) => {
    let owner;
    try { owner = JSON.parse(contents); } catch { /* legacy malformed locks are stale */ }
    const pid = isObject(owner) ? owner.pid : Number(contents);
    if (isObject(owner) && Object.hasOwn(owner, "native")) {
      return `${nativeSuspension(owner.native?.threadId, owner.native?.claudeSessionId)} Nothing was written.`;
    }
    if (Number.isInteger(pid) && pid > 0 && pidAlive(pid)) {
      return `Another init, next or usage of change ${id} is running, or execution, publication or status --report holds its lock (lock file ${lock}, pid ${pid}). Run calls one at a time. `
        + `Check that the pid is a router: \`ps -p ${pid} -o command=\` (POSIX) or \`tasklist /FI "PID eq ${pid}"\` (Windows) shows route.mjs, run-claude.mjs, run-codex.mjs, open-pr.mjs or pr-comment.mjs. `
        + "When it is another program and no router runs for this change, the owner removes the lock file and retries. Nothing was written.";
    }
    if (isObject(owner) || contents.startsWith("{")) {
      const groupGone = Number.isSafeInteger(pid) && pid > 0
        && owner?.processGroup === true && Number.isSafeInteger(owner.childPid)
        && owner.childPid > 0 && !pidAlive(-owner.childPid);
      if (!groupGone) {
        return `Codex execution lock remains for change ${id} (lock file ${lock}, runner ${pid}, child ${owner?.childPid ?? "unknown"}). The child process group is alive or its termination is uncertain. Inspect the execution and confirm its process tree has stopped before removing this lock. Nothing was written.`;
      }
    }
    return null;
  };
  const halt = (reason) => { release(); onBusy(reason); };
  const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  // Stale takeover under a guard: only the guard holder deletes, and it re-reads the lock first, so a lock that
  // changed since the caller's read is never deleted. Returns true when this process linked the lock.
  const takeOver = () => {
    const deadline = Date.now() + 1000;
    for (;;) {
      try { fs.linkSync(tmp, guard); break; } catch (e) {
        if (e.code !== "EEXIST") throw e;
        let holder = null;
        try { holder = fs.readFileSync(guard, "utf8").trim(); } catch { /* released: retry at once */ }
        if (holder !== null) {
          const holderPid = Number(holder);
          // shortcut: a dead holder's guard is never auto-removed (that would reopen the race); the owner removes it.
          if (!(Number.isInteger(holderPid) && holderPid > 0 && pidAlive(holderPid))) {
            halt(`Stale run-lock takeover guard ${guard} names no running process (contents "${holder}"). Remove that file when no router runs for change ${id}, then retry. Nothing was written.`);
          }
        }
        if (Date.now() >= deadline) {
          halt(`Another caller is taking over the stale run lock of change ${id} (guard file ${guard}, pid ${holder ?? "unknown"}). Retry in a moment. Nothing was written.`);
        }
        if (holder !== null) sleep(20);
      }
    }
    try {
      let contents = null;
      try { contents = fs.readFileSync(lock, "utf8").trim(); } catch { /* gone: only retry the link */ }
      if (contents !== null) {
        const reason = busyReason(contents);
        if (reason) halt(reason);
        unlinkQuiet(lock);
      }
      try { fs.linkSync(tmp, lock); return true; } catch (e) {
        if (e.code !== "EEXIST") throw e; // a caller that saw no lock linked first: classify it next round
        return false;
      }
    } finally {
      removeGuard();
    }
  };
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        fs.linkSync(tmp, lock);
        break;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        let contents = "";
        try { contents = fs.readFileSync(lock, "utf8").trim(); } catch { /* vanished: retry */ }
        const reason = busyReason(contents);
        if (reason) halt(reason);
        if (attempt >= 10) throw e;
        if (takeOver()) break;
      }
    }
    // Check existing ownership first. An archive move or git add -A must never capture the lock.
    const relativeTemp = path.relative(fs.realpathSync(root), fs.realpathSync(path.dirname(lock)));
    if (relativeTemp !== ".." && !relativeTemp.startsWith(".." + path.sep) && !path.isAbsolute(relativeTemp)) {
      release();
      onBusy("The OS temporary directory must be outside the run worktree. Reconcile any existing execution locks before changing TMPDIR.");
    }
  } catch (e) {
    release();
    throw e;
  }
  unlinkQuiet(tmp);
  process.on("exit", release);
  const replace = (contents) => {
    fs.writeFileSync(tmp, contents);
    fs.renameSync(tmp, lock);
    own = contents;
  };
  return {
    release,
    retainedReason() {
      return execution?.native
        ? nativeSuspension(execution.native.threadId, execution.native.claudeSessionId)
        : execution ? `Execution suspended: process ownership unresolved (lock file ${lock}). Confirm execution closure before router-owned recovery.` : null;
    },
    setChild(pid, native = false, claudeSessionId = null) {
      // null protects the spawn-to-PID-recording window after a supervisor crash.
      execution = { pid: process.pid, childPid: pid, processGroup: process.platform !== "win32",
        ...(native ? { native: execution?.native ?? (claudeSessionId ? { host: "claude", claudeSessionId } : { threadId: null }) } : {}) };
      replace(JSON.stringify(execution));
    },
    setThread(threadId) {
      if (!execution?.native || (execution.native.threadId && execution.native.threadId !== threadId)) {
        throw new Error("Native execution identity changed.");
      }
      const updated = { ...execution, native: { ...execution.native, threadId } };
      replace(JSON.stringify(updated));
      execution = updated;
    },
    clearChild(settled = false) {
      if (execution?.native && !settled) throw new Error(this.retainedReason());
      if (execution?.processGroup && execution.childPid && pidAlive(-execution.childPid)) {
        throw new Error(`Codex child process group ${execution.childPid} is still alive. Execution lock retained at ${lock}.`);
      }
      replace(String(process.pid));
      execution = null;
    },
  };
}
