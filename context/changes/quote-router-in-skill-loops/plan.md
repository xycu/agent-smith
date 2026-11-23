# Quote router calls in pipeline skills — Implementation Plan

## Overview

Quote every `ROUTER`, `PR_COMMENT` and `OPEN_PR` script argument in both pipeline skills so a plugin path containing spaces remains one shell argument. Preserve the current orchestration contracts, update all affected content assertions, and add regression proof without changing router behavior.

Planning baseline: `e1d18a0`, 2026-11-15. Complexity is medium because the small text change overlaps a whole-skill rewrite and depends on unproved host acceptance. This unattended planning step resolves choices from repository evidence; it does not implement the fix, commit artifacts, or claim live acceptance.

## Current State Analysis

The path assignments already use double quotes, but command examples expand the variables without quotes. In each current skill there are **12 router invocations**, including the generic example, plus one PR-comment and one open-PR invocation. The ticket's 11-router count predates the original-root diagnostic fallback. Every invocation must be considered, including Start, terminal branches and recovery guidance, not only the normal loop.

The owning layer is the command text in `SKILL.md`. The shared router cannot repair word splitting that happens before Node starts. Bash reproduction during planning gave two script words for an unquoted `/plugin cache/skills/10x-pipeline/scripts/route.mjs` variable and one for the quoted variable. The current three content suites passed **71 tests, zero failures or skips**, on Node v26.13.1; those suites currently pin the faulty spelling.

The architecture has changed since the ticket was written: OpenSpec's test is now `skills/openspec-pipeline/test/openspec-skill.test.mjs`. Both skills also carry `PREPARE_RUN` and `RUN_CODEX`, already quoted, host selection, saved setup JSON cleanup, prompt-file forwarding, and provider dispatch. These remain intact. Tuning currently lists policy paths as prose references, not executable commands, so it needs no gratuitous quote edit.

### Key Discoveries

- `skills/10x-pipeline/SKILL.md:21` and `skills/openspec-pipeline/SKILL.md:23` already define quoted absolute script paths. The OpenSpec paths go through `../10x-pipeline/scripts/`; its policy and rules remain chain-local.
- `skills/10x-pipeline/SKILL.md:37` and `skills/openspec-pipeline/SKILL.md:42` intentionally use `<root>` for the diagnostic before a run root can be selected. Later calls use `<run root>`. Quoting must preserve that exception.
- `skills/10x-pipeline/test/skill-loop.test.mjs:184`, `skills/openspec-pipeline/test/openspec-skill.test.mjs:242`, and `skills/10x-pipeline/test/archive-gate.test.mjs:43` pin usage/status/archive ordering. Some positional assertions can pass when a searched token disappears and `indexOf` returns -1; retain explicit presence checks before comparing positions.
- `skills/10x-pipeline/test/pr-comment.test.mjs:711` is a **fourth affected test file**, omitted from the ticket. It counts and locates the single unquoted PR-comment call.
- `skills/openspec-pipeline/test/openspec-skill.test.mjs:107` currently discovers router calls by their unquoted spelling. Updating only expectations without the discovery filter would make coverage incomplete. Its nonempty and required-command checks must remain.
- `context/archive/2026-11-12-skill-dir-variable/evidence/unproven.md:1` and `reviews/impl-review.md:41` explicitly leave installed-plugin rows 3.5 and 3.6 unproved. F1 in that review is the origin of this change. Archive approval and a direct CLI smoke test do not prove Claude skill-variable substitution.
- `context/changes/WAVES.md:131` gives the whole skill files to `skill-md-context-diet`; lines 139–147 put this quotation fix outside the scheduled waves and require ownership reconciliation. The rewrite's `change.md` plans to centralize late usage and move routing prose. This checkout contains its change description, but no plan or implementation artifact establishing completion.
- `context/foundation/lessons.md` forbids nested delegation. The current user request also confines this step to its worktree. Live Claude slash-command acceptance cannot be manufactured by starting a nested agent or modifying an installed cache outside that worktree.

## Desired End State

Every executable occurrence uses `node "$ROUTER"`, `node "$PR_COMMENT"` or `node "$OPEN_PR"`. No corresponding unquoted occurrence remains. Commands preserve their root prefixes, arguments, flags and ordering. Any policy path introduced into an executable command is quoted; existing prose path references remain prose.

Both anti-stall sections stay byte-for-byte equal and unchanged by this fix. OpenSpec retains `--chain openspec` on every router and open-PR invocation; PR-comment retains its explicit report path and does **not** acquire an unsupported chain flag. Tests fail for a single reintroduced bare script variable, and representative commands successfully reach a harmless Node fixture through paths containing spaces. Installed-plugin acceptance stays separately visible until supported by live evidence for each chain.

## What We're NOT Doing

- No routing, policy, prompt, rule-file, provider, setup, archive or PR-script behavior changes; no new dependency or path abstraction.
- No Wave 7 text compression, late-usage consolidation or routing-document migration in this change. Those belong to `skill-md-context-diet`.
- No changes to `WAVES.md`, `context/archive/`, versions, or router-owned run state. Do not modify the pre-existing dirty `agent-smith/run.jsonl`.
- No real GitHub write from a regression test, no plugin installation in this unattended worktree step, and no substitution of `--plugin-dir`, environment-variable simulation, source inspection or local shell proof for installed-plugin acceptance.

## Implementation Approach

Use the existing literal double-quote convention already used by `PREPARE_RUN` and `RUN_CODEX`. Change the two skills and their affected tests in one implementation commit after prerequisites are met. Extend the existing content suites rather than adding a new production helper or a generic Markdown/shell parser.

Evidence-backed assumptions replacing interview decisions:

1. **Serialize this follow-up after Wave 7's rewrite is integrated.** This follows the non-overlapping ownership rule and the explicit follow-up status in `WAVES.md`. Planning can run concurrently; implementation cannot edit those shared regions concurrently. It is a local dependency, not a change to the wave schedule.
2. **Do not waive the earlier live prerequisite.** The ticket explicitly requires the `skill-dir-variable` checks first. Record equivalent fresh evidence here; leave the archived rows untouched. If unavailable, stop implementation before skill edits and report the prerequisite as blocked. Planning itself can finish with that gate documented.
3. **Keep final spaced-path acceptance pending when unavailable.** The ticket explicitly permits an open Manual row for this case. Automated quoting tests prove shell behavior only.
4. **Use the current layered locations and full current test command.** AGENTS.md and the files on disk supersede the old OpenSpec test path and old suite glob in the ticket. `pr-comment.test.mjs` belongs in scope because it pins a changed call.

## Critical Implementation Details

### Timing and lifecycle

Phase 2 requires both the integrated rewrite and successful prerequisite substitution evidence from Phase 1. Do not let an unattended implementation executor skip those Manual prerequisites simply because it normally processes only Automated rows. If they are unavailable, retain unchecked rows, record the exact reason in this change's evidence, and return blocked with `signals.needsHuman`; do not infer success from installation metadata or the presence of Claude tools.

### Rewrite integration

Stay on this run branch. After the rewrite lands, integrate its completed main-branch state using a normal merge under the enclosing workflow's Git rules; never switch branches, rewrite pushed history or discard existing work. Re-inventory commands and their test anchors on that result. If the rewrite already fixes a call, reuse it. If usage moves into `## Late usage (before every end)`, pin the shared quoted command and each terminal branch's reference before status, PR handling and archive dispatch; do not restore three copies to satisfy obsolete tests. Preserve the archive cutoff and matched-invocation ownership rules. Record the integrated commit and the resulting mapping in `evidence/command-contracts.md`.

## Phase 1: Establish prerequisites and the integration baseline

### Overview

Resolve the known dependency ordering before changing shared skills. Carry new evidence in this active change, never in the archive.

### Changes Required

#### 1. Integration inventory and prerequisite evidence

**Files**: `context/changes/quote-router-in-skill-loops/evidence/command-contracts.md`, `context/changes/quote-router-in-skill-loops/evidence/unproven.md` when needed, and separate live evidence files in that same evidence directory.

**Intent**: Record the completed rewrite revision, every relevant command and affected assertion at that revision, and the outcome of the old live prerequisite. Make a missing prerequisite explicit before implementation begins.

**Contract**: The inventory covers both original-root and run-root diagnostics, generic examples, init/next/status/usage/verify-archive, PR-comment, open-PR, and any command using a policy path. Evidence for each live prerequisite identifies the exact installed source revision, Claude version, actual expanded cache path, invoked slash command and successful router output. Do not tick a live row from a shell stub or a JSON halt. If substitution is demonstrably wrong, stop this quotation-only implementation, document the failure and require a prerequisite correction and replan before proceeding.

### Success Criteria

#### Automated Verification

- The completed Wave 7 rewrite is integrated on this run branch, and `evidence/command-contracts.md` records its commit, the current invocation inventory and all affected test locations without changing `WAVES.md` or archives.

#### Manual Verification

- Fresh installed-plugin evidence for `/agent-smith:10x-pipeline` proves the prerequisite formerly recorded as skill-dir-variable row 3.5: Claude substitutes the actual plugin cache path and router initialization returns `action: "run"` with a step, without `--plugin-dir`.
- Fresh installed-plugin evidence for `/agent-smith:openspec-pipeline` proves the prerequisite formerly recorded as skill-dir-variable row 3.6: Claude resolves the sibling shared router and initialization returns `action: "run"` with an OpenSpec step, without `--plugin-dir`.

**Implementation gate**: Both Manual criteria must be proved before Phase 2 skill edits. They are unproved at planning time. An unavailable live environment is a reason to wait, not a successful check or authority to install outside the permitted workspace.

## Phase 2: Quote the commands and prove the contract

### Overview

Apply the mechanical fix to the integrated skills, retain all existing semantics, and verify both text coverage and real shell argument handling.

### Changes Required

#### 1. Command examples in both skills

**Files**: `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`.

**Intent**: Prevent shell splitting at every executable use of the three script variables, including diagnostic and recovery examples.

**Contract**: Double-quote the script argument and preserve every other token, root selection, timeout instruction, terminal order and host/provider rule. Keep existing quoted `PREPARE_RUN` and `RUN_CODEX` calls. Preserve OpenSpec's selector and report-path distinctions. Quote a policy path only if it appears inside an executable command after integration. Leave anti-stall bytes unchanged and equal across chains. Both skills land together.

#### 2. Existing pinned assertions

**Files**: `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`, `skills/10x-pipeline/test/archive-gate.test.mjs`, `skills/10x-pipeline/test/pr-comment.test.mjs`.

**Intent**: Re-pin the new spelling without weakening any behavioral assertion or retaining obsolete pre-rewrite text structure.

**Contract**: Update filters, regular expressions, literal calls, position comparisons and occurrence counts together. OpenSpec discovery must still find commands, require init/next/status/usage/verify-archive and check the selector on every occurrence. For ordered calls, first assert both anchors exist, then compare positions. Cover usage before status and PR handling in done, before PR handling in halt, and before status, the manual gate and archive dispatch in archive, respecting the integrated shared-usage structure if present. Preserve single PR-comment ownership, archive report selection, six anti-stall rules and exact parity. Keep original-root fallback checks separate from selected-run-root checks.

#### 3. Regression coverage and test index

**Files**: `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/README.md`.

**Intent**: Detect any newly unquoted invocation and demonstrate that the documented command shape actually survives spaced paths. Extend the existing test file and its index row; no new test file is required.

**Contract**: Add a both-chain guard over all executable snippets, including Start and recovery text. It rejects bare target variables (also braced spellings), requires quoted occurrences for all three names, and cannot pass because a matcher finds zero calls. Honor existing `SKILL_PATH` and `OPENSPEC_SKILL_PATH` overrides. Keep assertions independent of the historic count of 12, because the rewrite may consolidate usage calls.

Add a small hermetic shell fixture using Node built-ins: take representative init, PR-comment and open-PR command snippets from each skill, substitute only their known placeholders, and execute them with each script variable pointing to a harmless Node argv/cwd recorder under a plugin path containing spaces. Preserve the OpenSpec sibling directory layout. Use a distinct run root containing spaces and start the shell elsewhere so the `cd` prefix is exercised. Assert the whole script path is one argument, cwd equals the selected root, and command arguments, chain selectors, quoted goal and report path survive. Never invoke real PR scripts or an agent. Use bounded child-process timeouts and the existing `removeTree` cleanup owner; when running under this worktree restriction, place scratch/TMPDIR inside the worktree. Direct `spawnSync(node, [script, ...])` alone is insufficient, because it bypasses shell expansion.

Prove the negative case with separate scratch skill copies through the existing overrides: remove one pair of quotes for each of the three variable names in each chain and require the named regression to fail. Each mutation starts from the clean fixed text. Do not modify live skill files for mutation testing or treat unrelated test failures as regression evidence.

### Success Criteria

#### Automated Verification

- Every target invocation is quoted; root prefixes, OpenSpec selectors, usage ordering, PR-report behavior and unchanged equal anti-stall sections pass the updated content assertions.
- The both-chain regression fails for each isolated unquoted ROUTER, PR_COMMENT and OPEN_PR mutation and passes on the fixed skills.
- Representative init, PR-comment and open-PR snippets in both chains reach the harmless Node fixture through spaced plugin and run-root paths with the expected argv and cwd.
- The focused content and compatibility tests listed in Testing Strategy pass, with live GitHub checks left disabled and any expected skips reported explicitly.
- The complete current repository test suite passes on Node 24+ and `git diff --check` passes; failures and unavailable prerequisites are reported rather than hidden by new skips.

#### Manual Verification

- The fixed installed plugin under an actual cache path containing spaces starts the router through `/agent-smith:10x-pipeline`, with source revision, expanded command and `action: "run"` evidence recorded in this change.
- The fixed installed plugin under an actual cache path containing spaces starts the shared router through `/agent-smith:openspec-pipeline`, preserving `--chain openspec`, with source revision, expanded command and `action: "run"` evidence recorded in this change.

**Acceptance limit**: These two final Manual rows may remain pending when the live environment is unavailable, as the ticket permits. Record each reason in `evidence/unproven.md`. Do not describe the fix as fully accepted for installed plugins until both are proved.

## Testing Strategy

### Content and shell regression

Run the four affected suites plus the neighboring ownership, provider and usage contracts:

`node --test --test-concurrency=2 skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/late-usage.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/host-integration.test.mjs`

The current no-write planning baseline covered only skill-loop, openspec-skill and archive-gate: 71 passed. The new regression, four-file repinning, runtime fixture and full suite are future implementation verification, not completed work.

### Repository gate

Use the current AGENTS.md command, including the relocated OpenSpec suites:

`node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`

Start every shell command with the required `cd` to this run worktree. For tests that create scratch projects, set TMPDIR to a dedicated directory inside this worktree before launching Node. Keep live GitHub tests disabled. Report any environment limitation honestly; do not change CI or add silent skips to make this quotation fix green. Run `git diff --check`, then inspect the scoped diff for unintended edits. The implementation commit includes both skills and the tests that pin them; use a Conventional Commit subject and AI co-author trailer. This planning step makes no commit.

### Manual Testing Steps

1. For Phase 1, a live Claude Code host with the required toolkits installs the integrated baseline as a plugin through a local marketplace sourced from the run worktree. This is a human/live-host operation outside the current unattended step's filesystem scope. The archived plan-review explains why installing a marketplace revision from main can test the wrong code. Do not use `--plugin-dir`.
2. Record which revision the installed cache actually contains. In separate valid scratch 10x and OpenSpec projects, invoke the two slash commands, capture the expanded router cache path and successful `init` output. Use a normal cache path for this prerequisite so the known unquoted-space defect does not obscure whether substitution works. A setup failure or JSON halt does not satisfy the criterion.
3. After the fix, repeat with the fixed revision installed into an **actual cache path containing spaces**, not merely a spaced marketplace source directory. Record the loaded skill path and expanded script command. Include the OpenSpec sibling traversal and chain selector. A project path containing spaces alone is not this acceptance test.
4. Keep checks in scratch projects, stop after the observed router start through the live host, and retain transcripts as evidence. The current unattended subagent must not launch another agent to obtain them. If prerequisites/toolkits/cache placement cannot be established, leave the corresponding row unchecked with the exact reason. Never update the archived plan to backfill acceptance.

## Performance Considerations

No production runtime or routing change. Shell fixtures add only bounded local Node launches; no model, network or GitHub call is needed for automated regression coverage.

## Migration Notes

No data migration. Skills are installed text, so final acceptance must load the fixed revision rather than a stale cache. Roll back the paired skill/test change through a normal revert if necessary; no run-state edits are required. The rewrite integration must preserve its consolidated structure rather than restoring old paragraphs.

## References

- Task authority: `context/changes/quote-router-in-skill-loops/change.md`.
- Ownership: `context/changes/WAVES.md:11`, `context/changes/WAVES.md:131`, `context/changes/skill-md-context-diet/change.md`.
- Prerequisite and origin: `context/archive/2026-11-12-skill-dir-variable/evidence/unproven.md`, `context/archive/2026-11-12-skill-dir-variable/reviews/impl-review.md`, `context/archive/2026-11-12-skill-dir-variable/reviews/plan-review.md` (read-only).
- Commands: both `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md`, Start, Loop, PR comment, Pull request and Tuning sections.
- Tests: the four files in Phase 2; existing `SKILL_PATH` and `OPENSPEC_SKILL_PATH` override patterns.
- Fixture ownership: `skills/10x-pipeline/test/helpers.mjs`, `skills/10x-pipeline/scripts/remove-tree.mjs`.
- Layer and execution constraints: `AGENTS.md`, `context/foundation/lessons.md`.
- `context/foundation/roadmap.md` has no item with this Change ID; leave it unchanged.

## Progress

### Phase 1: Establish prerequisites and the integration baseline

#### Automated

- [x] 1.1 The completed Wave 7 rewrite is integrated on this run branch, and `evidence/command-contracts.md` records its commit, the current invocation inventory and all affected test locations without changing `WAVES.md` or archives. — f81bdb5

#### Manual

- [x] 1.2 Fresh installed-plugin evidence for `/agent-smith:10x-pipeline` proves the prerequisite formerly recorded as skill-dir-variable row 3.5: Claude substitutes the actual plugin cache path and router initialization returns `action: "run"` with a step, without `--plugin-dir`. Accepted by the owner on 2026-11-23 with a caveat: the plugin resolved to the repository checkout (directory marketplace), not a cache path; see `evidence/command-installed-plugin-substitution.md`.
- [x] 1.3 Fresh installed-plugin evidence for `/agent-smith:openspec-pipeline` proves the prerequisite formerly recorded as skill-dir-variable row 3.6: Claude resolves the sibling shared router and initialization returns `action: "run"` with an OpenSpec step, without `--plugin-dir`. Accepted by the owner on 2026-11-23 with the same caveat as row 1.2.

### Phase 2: Quote the commands and prove the contract

#### Automated

- [x] 2.1 Every target invocation is quoted; root prefixes, OpenSpec selectors, usage ordering, PR-report behavior and unchanged equal anti-stall sections pass the updated content assertions.
- [x] 2.2 The both-chain regression fails for each isolated unquoted ROUTER, PR_COMMENT and OPEN_PR mutation and passes on the fixed skills.
- [x] 2.3 Representative init, PR-comment and open-PR snippets in both chains reach the harmless Node fixture through spaced plugin and run-root paths with the expected argv and cwd.
- [x] 2.4 The focused content and compatibility tests listed in Testing Strategy pass, with live GitHub checks left disabled and any expected skips reported explicitly.
- [x] 2.5 The complete current repository test suite passes on Node 24+ and `git diff --check` passes; failures and unavailable prerequisites are reported rather than hidden by new skips.

#### Manual

- [ ] 2.6 The fixed installed plugin under an actual cache path containing spaces starts the router through `/agent-smith:10x-pipeline`, with source revision, expanded command and `action: "run"` evidence recorded in this change.
- [ ] 2.7 The fixed installed plugin under an actual cache path containing spaces starts the shared router through `/agent-smith:openspec-pipeline`, preserving `--chain openspec`, with source revision, expanded command and `action: "run"` evidence recorded in this change.
