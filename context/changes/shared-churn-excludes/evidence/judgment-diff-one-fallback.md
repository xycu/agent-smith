Judged: `git diff main...HEAD -- skills/10x-pipeline/scripts`

Quoted, state.mjs (only place with the fallback):
  export function churnExcludes(policy) {
    let exclude = policy.risk?.churn?.exclude;
    if (!Array.isArray(exclude)) exclude = readJson(path.join(SKILL_DIR, "policy.json"), {}).risk?.churn?.exclude;
    ...
  churnConfig now: `return { ...c, exclude: churnExcludes(policy) };`

Quoted, steps.mjs: removed `evidenceExcludes` (its own readJson of policy.json) and the imports SKILL_DIR, readJson, churnConfig; now `const exclude = churnExcludes(policy);`.

Reasoning: exactly one policy.json read of the shipped exclude list remains, in state.mjs; steps.mjs has none (grep for policy.json/readJson/SKILL_DIR passes, row 1.5).
Net lines in scripts (numstat): state.mjs +9/-4, steps.mjs +3/-11 = +12/-15 = 3 fewer. Plan said "about 5"; 3 is the same order and the fallback is single, so the claim holds.
