Judged: skills/10x-pipeline/test/result-persist.test.mjs against change.md "Reproduction" and "Tests".

Test 1 "a router error after the result is read keeps the result in run.jsonl, and the next call routes on":
 init, write result {status done, usage totalTokens 1234}, override broken (rigor.levels null; change.md suggests a broken key such as "ladder": []), next -> asserts "Router error", last-result.json gone, log entry has result/usage/ok; restore override, next -> routes on, no "has no result". Matches change.md steps 1-5 (non-isolated).

Test 2 "the same in an isolated run with a failed advisory score entry":
 real linked worktree, isolation.require true, score step, result written, broken override; asserts Router error, file gone, entry kept with ok false, last-result.json not tracked; restore, next works. Matches the "isolated variant ... fallback/non-ok non-rollback entry" in change.md Tests.

Both tests pass now (node --test: pass 2, fail 0). Row supported.
