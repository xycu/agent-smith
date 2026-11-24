<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Codex Run Gitdir Grant Implementation Plan

- **Plan**: context/changes/codex-run-gitdir-grant/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-24
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 3 observations

Verdict and counts are as measured on the code before the review fixes (base `71730075`). Every automated row of all three phases is `[x]`; the Manual rows 1.4, 2.2 and 3.3 are open, so the review covers the automated scope of each phase.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Automated success criteria (run on the code before the fixes, and again after them)

| Command | Result |
|---------|--------|
| `node --test skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs` | pass (in the combined run below) |
| `node --test skills/10x-pipeline/test/codex-chain.test.mjs` | pass (combined run: 196 tests, 196 pass, 0 fail, before and after) |
| `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` | pass |
| `node tools/version-check.mjs` | `version-check: OK (1.16.2)` |
| `grep -n "codex.permissions" docs/REFERENCE.md docs/ADR/ADR-024-openai-codex-support.md` | 3 hits in REFERENCE.md, 1 in the ADR |

## Findings

### F1 — The grant covers the common dir when the run root is not a linked worktree

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/run-codex.mjs:60 (`gitdirGrant`)
- **Detail**: The runner grants `git rev-parse --absolute-git-dir` of the run root. In a main checkout (a run with `isolation.require: false`) that path is `<repo>/.git`, the common dir itself, so the sandbox got write access to all of `.git` (objects, refs, hooks, config). The plan's "What We're NOT Doing" says "No grant of the common dir, `objects` or `refs`", and REFERENCE.md and the ADR-024 amendment say the grant is "never the common dir". The runner tests locked the wrong behavior in: every grant fixture was a plain `git init` checkout and expected a grant on `<root>/.git`.
- **Fix**: Resolve the common dir in the same `git rev-parse` call and pass no grant when it equals the gitdir (reason `gitdir is the common dir`); run the grant tests from a linked worktree fixture and add the main-checkout case to the no-grant and refusal tests; name the case in REFERENCE.md and the ADR amendment.
- **Decision**: APPLIED in 00630b3e (fix(codex-run-gitdir-grant): never grant the common dir outside a linked worktree).

### F2 — Dispatch targets omit `permissions` when it is null

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/state.mjs:164 (`dispatchTarget`), skills/10x-pipeline/scripts/flow.mjs:501
- **Detail**: The plan's contract is `permissions: policy.codex?.permissions ?? null` on every OpenAI target, and the replay copies `permissions: last.permissions ?? null`. The code adds the key only when it is non-null; the code comment gives the reason (ordinary actions stay within their size budget). Every comparison reads an absent key as null, and tests cover legacy entries, neutral retry and both archive shapes, so behavior matches the plan. Only the action shape differs.
- **Fix**: None needed in code; the owner can accept the shape or note it in the plan.
- **Decision**: PENDING — no code change proposed; the owner decides whether to accept the omitted-when-null action shape as an intended deviation from the plan's contract.

### F3 — A long gitdir can push the stderr tail past the 2048-character reason cap

- **Severity**: 💬 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/run-codex.mjs:283 (`detail`), :22 (`failureReason`)
- **Detail**: The Git-capability refusal is about 470 characters, then the grant status repeats the gitdir, then up to 512 bytes of tail, which usually names the gitdir again. `failureReason` cuts at 2048 characters from the end of the text, so with a gitdir path longer than about 1000 characters the tail, the part that names the denied path, is cut first. The plan states the cap "leaves room"; that holds for ordinary paths only.
- **Fix**: Either shorten the fixed refusal text when a tail is present, or cut the tail to the room left under the cap. Both change agreed refusal text or the 512-byte contract.
- **Decision**: PENDING — no clear fix inside the plan's contract; the owner decides whether paths this long matter and which text gives way.

### F4 — Live checks on codex-cli 0.171.0 are still open

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/codex-run-gitdir-grant/plan.md (Progress rows 1.4, 2.2, 3.3)
- **Detail**: All three Manual rows are `[ ]`. `evidence/unproven.md` records why: only codex-cli 0.172.0 is installed, and 3.3 needs a live split run that calls a model. The fake-Codex tests prove argv and refusal text, not that Codex 0.171.0 honors the inline-table grant. The plan's reproduction table is the only live evidence for the merge behavior.
- **Fix**: The owner runs the three live checks (or accepts 0.172.0 as the observed version and updates the rows).
- **Decision**: PENDING — needs the owner: a live Codex run on 0.171.0 (or a decision to accept 0.172.0) cannot be done by an unattended review step.
