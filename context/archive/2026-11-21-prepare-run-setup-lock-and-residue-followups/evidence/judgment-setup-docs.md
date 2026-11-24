# Manual rows 2.4 and 2.5

## Current wording

The recorded grep output contains one historical pending-intent description in ADR-010 Amendment 6. It says “The full-branch setup lock protects the intent, registration, overlay and final worktree checks.” That statement describes the writer and worktree setup. The Reference's cleanup match likewise applies to cleanup, which still takes the lock. The fixed-temp bullet calls the UUID form “a legacy `.pending.<uuid>.tmp`.” A supplementary Markdown search for UUID staging, pre-selection locking and opt-out locking found the UUID writer described as older, legacy or the behavior restored by a revert. The text describes the current reader as lock-free and the current staging path as fixed.

## Read and lock ownership

ADR-010 Amendment 8 says “it reads the current branch’s canonical record without taking the branch lock.” The Reference says this happens “before opting out or selecting a different run branch.” In `prepare-run.mjs`, `checkCurrentPending` checks for a named linked checkout and calls `readPending(file, { lockFree: true })` directly. Both the opt-out path and the pre-selection path for a different branch call this reader. It directs callers with a valid record to the original project root. The later `withSetupLock(common, branch, …)` still covers selection, registration, copying, validation and project gates for the resolved branch.

Amendment 8 says the reader “treats the record as absent only if a second `lstat` confirms disappearance.” The Reference includes that same confirmation and says “An invalid or unreadable record requires inspection.” The payload catch in `readPending` checks `lockFree` and `error.code === "ENOENT"` and confirms absence before returning null. Other read failures, a failed recheck, or an entry that remains surface the inspection diagnostic. Parsing, record shape and the regular-file check still apply. The resolved branch uses `readPending(file)` with strict error handling.

## Staging and recovery

Amendment 8 says the writer “stages the new record at `<canonical record>.tmp` before atomically renaming it” and that “A directory or failed unlink stops publication and preserves the canonical record.” The Reference says “The next updated writer that publishes a record on that branch replaces this staging file” and “A retry that skips publication or uses an older writer can leave it behind.” Both publication sites call `writePending` while holding the same lock. The function uses `${file}.tmp`, checks the staging name with `lstat`, unlinks the entry before opening with `wx` and mode `0o600`, and only replaces the canonical record at rename. A symlink is unlinked as an entry. A directory makes the unlink fail before any canonical write. A retry with `copyComplete` already published can reach the project gates without calling `writePending`.

Both documents say to verify setup and its descendants have stopped before removing the exact staging entry and to keep the canonical record for recovery. The parent of the implementation commit used the same lock and record with UUID staging. The compatibility and revert notes match that code and explicitly say to finish copy-complete recovery on a version that understands it before reverting.
