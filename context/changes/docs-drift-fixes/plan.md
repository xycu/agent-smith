# Documentation Drift Fixes Implementation Plan

## Overview

Reconcile the seven findings against current code and merged Waves 1–5. Correct current guidance, annotate six historical ADRs, and extend the existing manifest guard to enforce description equality. The single Progress section below owns execution state.

## Current State Analysis

The starting point is Wave 5 maintenance commit 356d7c1, following release 3971ce9 (1.10.2). The original observations date from 2026-11-12. Several fixes have already merged.

| Item | Current evidence | Planned disposition |
| --- | --- | --- |
| 1. Isolated report location | The 10xDevs Quick start gives an unqualified context/changes/<change-id>/agent-smith/report.md path. paths() resolves run state from the working directory, and isolation defaults to true. | Explain the run-relative path, default worktree and branch, and successful archive destination. |
| 2. PR-comment references | Both skills now contain executable PR-comment steps. The old handoff to the README has disappeared. The reference already contains the recovery command. | Record the resolved finding and add a discoverable README link to the reference instructions. |
| 3. Duplicate run-lock prose | REFERENCE.md line 343 describes the current execution/router lock, including status --report. The copy at line 455 describes older behavior inside Orchestrator anti-stall. | Retain the current paragraph and remove the older duplicate only. |
| 4. OpenSpec live-run history | The final reference bullet claims the whole skill has never run. Archived plan row 5.6 and the checked-in openspec-project-rules report and verification prove completion on 2026-11-09. | Correct the history and link surviving archived evidence. |
| 5. ADR amendments and pointers | ADR-005 says seven ladder tiers, ADR-009 names two ignored provenance sections, ADR-003 describes pre-move commenting, and ADR-008 assumes a pre-1.0 release. ADR-003, ADR-010 and ADR-013 contain obsolete README pointers. | Add adjacent amendment notes and repair documentation destinations while preserving decisions. |
| 6. Prompt placeholders and unknown rendering | The prompt index already lists all 17 supported placeholders, including artifacts, authority and failure, and documents unknown-name rejection under ADR-022. render() still substitutes empty text for missing variables internally. | Preserve the validated-template contract and clarify the internal fallback and narrow template scopes. |
| 7. Manifest descriptions | Wave 5 commit 68c377a aligned both descriptions and added a repository equality assertion to skill-loop.test.mjs. The standalone version guard still checks only versions and forbidden entry version keys. | Reuse the aligned wording and existing assertion. Add description validation to the standalone guard and its fixture tests. |

### Scope and Wave 6 ownership

Implementation edits are confined to these regions and files.

- README.md in the 10xDevs Quick start report paragraph and the existing --pr-comment options-table cell.
- docs/REFERENCE.md in the obsolete duplicate Run lock bullet and the final OpenSpec live-run history bullet.
- Six records under docs/ADR/, ADR-003, ADR-005, ADR-008, ADR-009, ADR-010 and ADR-013, in the stale claims and pointers specified in Phase 2.
- skills/10x-pipeline/prompts/README.md in the opening placeholder explanation.
- tools/version-check.mjs and tools/test/version-check.test.mjs for the equality guard and regression coverage.
- skills/10x-pipeline/test/README.md in the existing version-check test-index row.
- This change's planning artifacts and lifecycle metadata.

The manifest description fields belong to this change if reconciliation becomes necessary during implementation. They already agree at this baseline. Preserve their exact explicit-invocation wording.

Sibling change-id-length-cap owns ID validation and the 100-character guidance in the skills, README and reference. Sibling nested-subagent-hard-stop owns ADR-018, harness hardening and related nesting guidance. Keep the anti-stall hand-back paragraphs, nesting paragraphs and ID-limit paragraphs outside this change's hunks. The obsolete Run lock bullet is a separate deletion within the shared anti-stall region. Sibling step-prompt-by-file owns dispatch output, policy and Loop step 2. Sibling coverage-and-failed-undo-test owns CI test commands and rollback tests. Use the current chain-local OpenSpec paths introduced by PR #155.

## Desired End State

Every finding has a documented current disposition and corresponding evidence. Readers can locate reports from the run root, follow PR-comment recovery instructions, find one current Run lock paragraph and see the recorded OpenSpec live-run outcome. Historical decisions retain their original text and carry local amendment guidance. The prompt index explains supported placeholders, validation and rendering accurately.

The existing version-check CLI succeeds when the three release-owned versions are valid and equal, plugin entries carry no version, and the two plugin descriptions are valid identical strings. Description drift produces an actionable diagnostic and exit 1. Existing version diagnostics and the exported version collection remain compatible.

### Key Discoveries

- Run-relative report paths are owned by paths() in state.mjs. Worktree setup and archive lifecycle determine the root and change folder. See skills/10x-pipeline/scripts/state.mjs:446.
- PROMPT_PLACEHOLDERS lists 17 names. NARROW_PLACEHOLDERS limits archive, frame-authority, worktree, suffix and chain-default templates. render() retains its missing-variable fallback. See skills/10x-pipeline/scripts/steps.mjs:665.
- promptProblem rejects unsupported template names before writing commands execute. Existing policy-validate tests cover unknown names and narrow scopes. See skills/10x-pipeline/scripts/flow.mjs:891 and skills/10x-pipeline/test/policy-validate.test.mjs:167.
- The existing repository content test compares plugin.description and marketplace.plugins[0].description. The standalone guard should enforce this same pair. See skills/10x-pipeline/test/skill-loop.test.mjs:32.
- collect(root) exports three [label, version] pairs. check(root) returns diagnostics, and CI already invokes its CLI. See tools/version-check.mjs:35 and .github/workflows/ci.yml:68.
- Release commit 9fceddd and the changelog record 1.0.0 on 2026-11-09. The original 1.5.0 observation has since advanced to 1.10.2. See CHANGELOG.md:283.

## Boundaries

Runtime routing, prompt templates, isolation, locking and PR posting remain owned by existing code and sibling changes. This task changes documentation and the manifest guard. Wave scheduling and archived workflow records are protected. Version updates belong to release-please.

## Implementation Approach

Use three phases with automated acceptance. Current code, merged commits and preserved evidence settle the implementation decisions. The unattended invocation replaces the skill's interview and structure confirmations with the assumptions below.

1. Reconcile current user guidance and placeholder documentation.
2. Add local ADR amendments and repair stale section pointers.
3. Extend the manifest guard and its regression tests, then run the complete suite.

### Assumptions

- Complexity is medium because documentation, historical records and a CLI guard interact. Three bounded phases and zero interview questions fit the explicit unattended instructions and concrete fixes in change.md.
- Findings already satisfied by merged code count as reconciled once their evidence is recorded and checked. Wave 6 explicitly follows pr-comment-flag-in-meta and skills-disable-model-invocation.
- Preserve the exact description introduced by 68c377a. It names both workflows, explicit slash commands, subagents and model/effort routing, and the existing content test checks these properties.
- Compare plugin.description with marketplace.plugins[0].description, matching this single-plugin repository's existing equality assertion and layout. Require both values to be nonblank strings and compare their original bytes exactly.
- Historical updates use the actual superseding source. The 1.0.0 release and prices addition have dated commit evidence. Cite that evidence directly where a later ADR does not establish the change.
- Local source checks, preserved run evidence and automated tests cover this change. The historical live-run correction is bounded to the recorded 2026-11-09 run. Its report contains partial usage telemetry and current-host acceptance belongs to its owning changes.

## Phase 1: Reconcile current guidance

### Overview

Resolve findings 1–4 and 6 with focused prose changes, preserving the merged PR-comment procedures.

### Changes Required

#### 1. Report location and PR-comment navigation

**Files** README.md, 10xDevs Quick start and the --pr-comment options-table cell.

**Intent** Explain where the isolated report can be read and make the existing manual posting instructions discoverable.

**Contract** Qualify context/changes/<change-id>/agent-smith/report.md as relative to the run root. Identify the default .claude/worktrees/agent-smith-<change-id>/ worktree and agent-smith/<change-id> branch, with the run branch's pull request carrying the report. Explain that a successful 10x archive moves it to context/archive/<created-date>-<change-id>/agent-smith/report.md in that worktree. Add a link from the flag row to docs/REFERENCE.md, naming its “PR comment (opt-in)” section. That label is plain text today, so link to the file without inventing a heading anchor. Keep ID-limit and nesting guidance in sibling-owned regions.

#### 2. Single current lock description and OpenSpec history

**File** docs/REFERENCE.md, duplicate Run lock bullet under Orchestrator anti-stall and final OpenSpec limits/history bullet.

**Intent** Remove contradictory lock documentation and replace the stale live-run claim with the recorded outcome.

**Contract** Keep exactly one Run lock paragraph, retaining the modern execution and status --report contract at its existing Late usage figure location. Remove the older duplicate bullet as a self-contained hunk. Replace the nonexistent active context/changes/openspec-pipeline/evidence/check-3-live.md pointer with archived probe evidence. Record that openspec-project-rules completed on 2026-11-09 with verification PASS, zero critical findings and zero warnings, and was archived. Link archived plan row 5.6 and openspec/changes/archive/2026-11-09-openspec-project-rules/agent-smith/report.md using valid relative paths.

#### 3. Placeholder contract

**File** skills/10x-pipeline/prompts/README.md, opening explanation.

**Intent** Explain rendering accurately using current validation and reuse the complete placeholder list.

**Contract** Preserve all 17 supported names and ADR-022's rejection of unknown template placeholders by init, next and usage. Document render() substituting empty text for missing or null variables internally. State the scopes from NARROW_PLACEHOLDERS, including chain defaults receiving only id and suffix receiving none. JSON examples retain their current treatment. This is a documentation change to existing behavior.

### Success Criteria

#### Automated Verification

- Report and PR-comment guidance resolves from the run root, exactly one current Run lock bullet remains, and OpenSpec history links resolve to the recorded 2026-11-09 evidence.
- The prompt index agrees with all 17 names, narrow scopes, unknown-name validation and missing-variable fallback in steps.mjs and flow.mjs.
- Focused content and policy tests pass using the Phase 1 command in Testing Strategy.

## Phase 2: Amend historical ADRs and repair pointers

### Overview

Resolve finding 5 through additive historical notes and localized link corrections in exactly six ADRs.

### Changes Required

#### 1. Superseded claims

**Files** docs/ADR/ADR-003-rigor-gated-routing.md, docs/ADR/ADR-005-baseline-usage-comparison.md, docs/ADR/ADR-008-release-packaging-and-semver.md and docs/ADR/ADR-009-managed-agent-patterns.md.

**Intent** Let readers follow a local amendment from each original decision to current behavior.

**Contract** Preserve the original claims and add these adjacent notes with working source links.

- ADR-005 Decision, “seven ladder tiers” at line 19. Cite ADR-010 for the eight-rung ladder and confirm eight entries in current policy and baseline policy.
- ADR-009 “What each feature covers”, provenance.ignore at line 64. Record the current list compare, provenance, prices, coAuthor. Cite the 2026-11-09 run-cost-estimate addition (6a906fb, also described in ADR-005's cost consequence) for prices, and ADR-021 for coAuthor.
- ADR-003 original PR-comment Decision at line 132. Cite ADR-017 for commenting after archive movement and pull-request creation. Point the old task-based intent text to existing Amendment 1 for stored router intent. Preserve Amendment 1's distinction that the router emits the archive action before the move while the orchestrator posts afterward.
- ADR-008 Consequences, the 0.x assumption at line 41. Add a dated note citing the 1.0.0 release on 2026-11-09, its changelog entry and release commit. Point to existing Decision rules for major bumps at 1.0.0 and above. Preserve release-owned values and retain the original version assumption as history.

Use the existing local “Amended by ADR-…” style where an ADR supplies the supersession. A dated release or commit note supplies direct provenance for the other transitions. Add no ADR number.

#### 2. Stale documentation pointers

**Files** docs/ADR/ADR-003-rigor-gated-routing.md, docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md and docs/ADR/ADR-013-openspec-pipeline.md.

**Intent** Send readers to documentation that exists while retaining decision history.

**Contract** Repair ADR-003's Budget pointer at line 377 and baseline override pointer at line 385. Repair ADR-010's Baseline comparison pointers at lines 14 and 95 and its additional Budget pointer at line 96. Point these to ../REFERENCE.md with the actual plain-text section name. In ADR-013 D12 at line 129, annotate the old README layout instruction with current AGENTS.md Layout and the reference's OpenSpec section, alongside ADR-013 Amendment 1 for chain-local paths. Keep the old layout instruction as historical text. Link destinations must exist and any fragment must resolve to a real heading.

### Success Criteria

#### Automated Verification

- Four superseded claims have adjacent evidence-backed amendments, all six ADRs retain historical decisions, and every identified obsolete README pointer has a valid current destination.
- ADR and deletion-rule checks pass using the Phase 2 command in Testing Strategy.

## Phase 3: Enforce description equality

### Overview

Complete finding 7 by extending the standalone guard and tests, reusing the aligned manifest descriptions.

### Changes Required

#### 1. Existing manifest guard

**File** tools/version-check.mjs.

**Intent** Make the command CI already runs detect description drift as well as version drift.

**Contract** collect(root) keeps returning exactly the three existing version pairs. check(root) keeps returning error strings and continues all SemVer, equality and marketplace-entry-version checks. Validate plugin.description and marketplace.plugins[0].description as nonblank strings, followed by exact equality. Missing entries, missing fields and wrong types produce diagnostics naming the affected file and field. A mismatch names both description fields. All failures follow the existing returned-error and CLI exit-1 path. Make the CLI failure heading cover version and description problems. Preserve successful output in the form version-check: OK (<version>) and read-only behavior. Use existing JSON-reading and error-handling patterns with node built-ins.

#### 2. Focused regression coverage

**File** tools/test/version-check.test.mjs.

**Intent** Prove the new failure path while preserving release guard coverage and preventing undefined values from passing equality.

**Contract** Extend makeRoot with matching valid descriptions by default and focused overrides. Cover identical descriptions, changed plugin text, changed marketplace text, missing values, non-string values, blank strings and a missing first entry. Preserve the check of every marketplace entry for a forbidden version. Adapt malformed-marketplace fixtures to the description invariant while keeping their original version assertions. Assert that collect(root) exposes only version fields. Exercise CLI exit 1 and field-specific diagnostics with a scratch copy of the script beside fixture manifests, and verify that execution leaves manifests unchanged. Reuse existing scratch setup and removeTree cleanup. Scratch files stay under the run worktree in this run.

#### 3. Test index and final reconciliation

**File** skills/10x-pipeline/test/README.md, existing version-check.test.mjs row.

**Intent** Keep the established test index accurate and close the seven-item evidence trail.

**Contract** Expand the existing row to mention description equality and invalid/missing descriptions. Recheck the seven dispositions against the implementation. Verify hunks stay within ownership, protected scheduling/archive files retain identical bytes, and all three release-owned version fields retain baseline values. Preserve the manifest wording protected by skill-loop.test.mjs.

### Success Criteria

#### Automated Verification

- Version-check tests cover equality, drift, invalid and absent descriptions, CLI failure and read-only behavior while preserving prior version guarantees.
- The repository version-check CLI and focused version-check tests pass using the Phase 3 commands in Testing Strategy.
- The full suite passes using the repository command in Testing Strategy, with every environment-dependent skip identified.
- The seven-item reconciliation and diff pass ownership, historical-text, protected-path and release-version checks, and git diff --check succeeds.

## Testing Strategy

Run commands from the run root using the required explicit cd prefix. Use Node 24 or later.

### Phase 1 command

node --test --test-concurrency=2 skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/policy-validate.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs

### Phase 2 command

node --test --test-concurrency=2 skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs

### Phase 3 commands

- node tools/version-check.mjs
- node --test tools/test/version-check.test.mjs

### Full repository suite

node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs

### Source and integration checks

Compare edited prose with source contracts and referenced evidence, count current lock bullets, and resolve edited local links. These checks can be performed through commands and source inspection during automated implementation. Reuse existing manifest equality, placeholder validation and skill content tests. Exercise the normal CLI on the repository and a drifted fixture. CI already runs the guard.

Scratch fixtures created during this run belong under the worktree, with TMPDIR set there for tests using os.tmpdir(). List and check leftovers, unlink intended files individually through the established cleanup helper, and remove empty directories deepest first. Record optional tool availability and skip reasons with the final suite result.

## Migration and Risk Notes

The guard becomes stricter for missing or malformed descriptions. Fixtures need valid defaults, and the repository already supplies them. Documentation changes in historical ADRs are additive except for repaired link targets.

Concurrent Wave 6 merges may require context adjustments. Preserve sibling additions and the region boundaries above. Archived evidence proves a dated run. Current-host acceptance remains with its owning changes.

## References

- Seven original findings in context/changes/docs-drift-fixes/change.md.
- Wave 6 ownership and merged prerequisites in context/changes/WAVES.md.
- Documentation-search and nested-worker lessons in context/foundation/lessons.md.
- Report, lock and template owners in skills/10x-pipeline/scripts/state.mjs:446, state.mjs:948, steps.mjs:665, steps.mjs:673, steps.mjs:678, flow.mjs:891 and route.mjs:203.
- Guard and callers in tools/version-check.mjs:35, tools/version-check.mjs:50, tools/test/version-check.test.mjs:15, skills/10x-pipeline/test/skill-loop.test.mjs:32 and .github/workflows/ci.yml:68.
- Historical sources in ADR-010, ADR-017, ADR-021 and ADR-022, plus ADR-013 Amendment 1.
- Live-run completion in context/archive/2026-11-09-openspec-pipeline/plan.md:475, row 5.6, and openspec/changes/archive/2026-11-09-openspec-project-rules/agent-smith/report.md and verify.md.
- Release evidence in CHANGELOG.md:283 and commit 9fceddd. Description alignment in 68c377a. Pricing provenance in 6a906fb.

## Progress

### Phase 1: Reconcile current guidance

#### Automated

- [x] 1.1 Report and PR-comment guidance resolves from the run root, exactly one current Run lock bullet remains, and OpenSpec history links resolve to the recorded 2026-11-09 evidence.
- [x] 1.2 The prompt index agrees with all 17 names, narrow scopes, unknown-name validation and missing-variable fallback in steps.mjs and flow.mjs.
- [x] 1.3 Focused content and policy tests pass using the Phase 1 command in Testing Strategy.

### Phase 2: Amend historical ADRs and repair pointers

#### Automated

- [ ] 2.1 Four superseded claims have adjacent evidence-backed amendments, all six ADRs retain historical decisions, and every identified obsolete README pointer has a valid current destination.
- [ ] 2.2 ADR and deletion-rule checks pass using the Phase 2 command in Testing Strategy.

### Phase 3: Enforce description equality

#### Automated

- [ ] 3.1 Version-check tests cover equality, drift, invalid and absent descriptions, CLI failure and read-only behavior while preserving prior version guarantees.
- [ ] 3.2 The repository version-check CLI and focused version-check tests pass using the Phase 3 commands in Testing Strategy.
- [ ] 3.3 The full suite passes using the repository command in Testing Strategy, with every environment-dependent skip identified.
- [ ] 3.4 The seven-item reconciliation and diff pass ownership, historical-text, protected-path and release-version checks, and git diff --check succeeds.
