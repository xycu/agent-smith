Row 1.4: halt reason in skills/10x-pipeline/scripts/route.mjs.

Quoted text:
"isolation.require is on and meta.json does not record an isolated run. Run init first, in the run worktree. Nothing was written."

Reasoning: the remedy is the imperative "Run init first, in the run worktree", which is the action the row asks for. The text never mentions `require: false`, the policy override file or any opt-out, so the opt-out is not suggested first (or at all). It also states nothing was written. The isolation test file asserts /run init first/i and passes (24/24 in isolation.test.mjs, run now).
