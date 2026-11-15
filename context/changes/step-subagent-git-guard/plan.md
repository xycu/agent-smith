# Step subagent Git and deletion safety implementation plan

## Overview

Carry repository Git, deletion and publication rules into every routed task through the existing always-true rule hierarchy. Keep planning and plan-review acceptance executable before publication, and add a scoped Claude Code hook for common direct unsafe shell commands.

This plan addresses the three incidents recorded in `change.md`. Complexity is HIGH because prompt ownership, native dispatch identity, archive dispatch, historical retries and provenance intersect. The unattended instruction delegates decisions to researched evidence, including the interview and phase approvals normally requested by `/10x-plan`.

Revision after the 2026-11-15 REJECTED implementation review adds Phase 4 for F1 regression acceptance and F2 packaging cleanup. Phases 1–3 retain their completed Automated rows and pending Manual acceptance. This revision changes planning artifacts only; Phase 4 remains pending.

## Current State Analysis

The following baseline describes the original planning state. Phases 1–3 have since implemented these changes; the review follow-up below describes the remaining work.

The reported incidents involved an implementation step publishing its own PR to satisfy an Automated criterion, a reviewer discarding an edit through checkout, and manual verification using a prohibited scratch cleanup command. The ticket's description of the shared suffix predates ADR-023. Current deletion rules live in `rules/top.md`, outside project overrides. That file carries neither the Git discard rules nor publication ownership. There are no shipped `plan` or `plan-review` step rule files.

`ruleTail` already appends step, chain and top rules to both chains. Normal dispatch and archive dispatch both use it. File handoff stores the complete task in `prompt.md` and sends a short reader instruction. A neutral retry preserves its stored prompt and dispatch exactly. These mechanisms supply the required carriers.

Claude actions currently omit `agent` unless an opt-in restricted mapping selects one. Both skills already forward a supplied `agent` for normal and archive dispatch. A plugin hook can identify a dedicated routed agent through host-provided identity. Existing general-purpose dispatch identifies many unrelated subagents, so matching its name would broaden the guard's reach.

### Key discoveries

- Shared safety rules and precedence already have a fixed-path owner. `top.md` ends with the RESULT contract. [Top rules](../../../skills/10x-pipeline/rules/top.md), [ruleTail and checkRules](../../../skills/10x-pipeline/scripts/flow.mjs#L891), [ADR-023](../../../docs/ADR/ADR-023-layered-rules.md)
- Step files are keyed by step. A `plan.md` rule file covers `plan`, `plan-replan` and `plan-rejected` templates. A `plan-review.md` file covers initial and confirmation reviews. [Rule lookup](../../../skills/10x-pipeline/scripts/flow.mjs#L911), [review routing](../../../skills/10x-pipeline/scripts/flow.mjs#L692)
- `stepAgent` also participates in rejecting unsupported OpenAI opt-ins. Giving that existing restricted-agent lookup an unconditional Claude fallback would reject ordinary OpenAI runs. Keep restricted selection and provider-aware default dispatch distinct. [stepAgent and dispatchProblem](../../../skills/10x-pipeline/scripts/flow.mjs#L981)
- Normal actions store the selected agent in their log entry. Archive actions are assembled separately, and neutral retries replay the stored selection. [Normal assembly](../../../skills/10x-pipeline/scripts/route.mjs#L219), [archive assembly](../../../skills/10x-pipeline/scripts/isolation.mjs#L739), [neutral retry](../../../skills/10x-pipeline/scripts/flow.mjs#L438)
- `open-pr.mjs` owns push and PR creation. `pr-comment.mjs` owns report comments, under the terminal action's strict opt-in. Steps and the router cannot call `gh`. [ADR-017](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md), [ADR-024](../../../docs/ADR/ADR-024-openai-codex-support.md)
- Rule files and agent definitions already have provenance sections. Hook configuration and implementation currently have no section. [Provenance hashing](../../../skills/10x-pipeline/scripts/isolation.mjs#L52)

### Planning evidence

Baseline inspection on 2026-11-15 confirmed deletion rules in both chain tails, absent shared Git/publication rules, absent planning step files and a null default `plan` agent. Node was 24.19.0, Claude Code 2.1.311 and Codex CLI 0.169.0.

Six focused files passed with 86 tests, zero failures and zero skips. They were `rule-levels.test.mjs`, `rules.test.mjs`, `agents.test.mjs`, `provenance.test.mjs`, `no-recursive-delete.test.mjs` and `nested-subagents.test.mjs`, under `skills/10x-pipeline/test/`.

Scratch tests ran within this worktree to obey the task's filesystem boundary. An initial attempt inherited the containing repository and changed fixture routing. The successful rerun used a scratch-root `.git` file pointing to an absent directory inside that scratch root, which stopped parent Git discovery. Test-created repositories supplied their own metadata. The existing `removeTree` helper removed the scratch contents afterward.

### Implementation-review follow-up

The [implementation review](reviews/impl-review.md) records one critical finding and one warning. Its REJECTED verdict describes the implementation before its own fixes; it must not be rewritten as acceptance of the follow-up.

| Finding | Verified current state | Planned disposition |
| --- | --- | --- |
| F1: Git option values mistaken for flags | Commit `19affb2e3c16a2de2508e5c06be09e2d02be28ab` already fixes `gitProblem` and adds the inert-payload regression. `step-guard.mjs:71–99` consumes option values before classifying flags and chooses the last real dry-run setting; `step-guard.test.mjs:72` covers the reported failures. | Reuse the correction and regression. Phase 4 verifies that they remain effective; it does not require another parser implementation. |
| F2: tracked operating-system metadata | `git ls-files --stage -- .DS_Store "**/.DS_Store"` reports only the root `.DS_Store`; `.gitignore:1` currently contains only `.claude/worktrees/`. The review records `ARCHIVE_OS_METADATA_FILE` even though strict validation exits zero. | Add the narrowly scoped tracking cleanup to this plan: retain local bytes, remove the root file from the index and ignore `.DS_Store` at every depth. Validate a clean export of the candidate tracked tree. |

The review's [verification record](evidence/impl-review-verification.txt) reports 11 passing guard tests and 1,570 passing tests out of 1,573, with three expected skips. Its [inert-payload evidence](evidence/impl-review-guard-regression.txt) records the F1 before/after decisions. Those are prior implementation results, not tests run by this plan revision. Manual rows 2.6, 2.7 and 3.4 still need their original evidence.

## Desired End State

Every newly assembled task carries always-true Git/deletion/publication rules, including both archive tasks, overridden templates and file-handoff task bodies. Allowed typed implementation commits and archive commits remain usable. The router retains ownership of snapshots, rollback and run state, and orchestrator scripts retain publication ownership.

Every planning variant produces Automated criteria that can run locally before publication. Plan reviews catch PR-dependent Automated rows and preserve immutable Progress identities while applying an actionable correction. OpenSpec proposal tasks follow the equivalent boundary.

New Claude dispatches use a dedicated inherited-tool agent unless an existing restricted mapping selects another agent. A plugin-level hook recognizes that dedicated agent and denies the documented direct-command subset. Its supported-host evidence and bypass limits are explicit. OpenAI task prompts receive the same safety rules and keep their existing execution/permission controls.

The F1 option-value correction remains covered by the existing regression. The tracked plugin and its clean export contain no `.DS_Store`; local metadata remains intact and ignored, and package validation no longer reports `ARCHIVE_OS_METADATA_FILE` for that export.

## Scope boundaries

Scope covers rule files, a small native hook and its routed identity, focused regression tests, provenance, rule/prompt/test indexes, reference documentation and amendments to the existing decisions. The complete rule semantics apply to actions through any tool or API. The shell hook provides the narrower runtime coverage specified below.

The review revision additionally covers F1 verification, the F2 root `.DS_Store` tracking removal and `.gitignore` entry, and follow-up evidence within this change folder. These are Phase 4 implementation targets; this planning step edits only `plan.md` and `plan-brief.md`.

Excluded work includes remote-ref polling, remote mutation during verification, a general shell parser, an OpenAI permission-profile redesign, dependency additions, version changes, tier/model changes, and edits to `WAVES.md` or `context/archive/`.

F2 does not authorize deleting local metadata, rewriting history, broader packaging tooling, unrelated metadata patterns or fixing the existing missing-icon warning. The original review and its evidence remain historical records.

## Implementation Approach

### Decisions and assumptions

| ID | Decision | Evidence and tradeoff |
| --- | --- | --- |
| A1 | Put shared Git/publication invariants in `rules/top.md`, and planning invariants in step files | ADR-023 fixes ownership outside overrides. Reusing `ruleTail` covers all templates and archive assembly. Every task pays the added safety-rule tokens. |
| A2 | Use a plugin-level `PreToolUse` command hook and a dedicated default `agent-smith:step` Claude agent | Host identity separates routed calls from the orchestrator and unrelated agents. Both skills already forward the router's agent. This introduces a required plugin agent for new ordinary Claude dispatches. |
| A3 | Preserve explicit restricted mappings and OpenAI capability checks | ADR-009 and ADR-024 establish these public contracts. Custom agent mappings receive prompt rules, with their runtime guard coverage documented separately. |
| A4 | Support a bounded direct Bash-command guard | The observed breaches use ordinary commands. A small guard can block those forms while allowing local commits and tests. Arbitrary shell programs, helpers, interpreters and MCP actions require host permissions and the semantic prompt rules. |
| A5 | Put PR CI and post-publication checks in Manual criteria | `open-pr.mjs` runs at the end. ADR-012's manual verifier can leave these rows pending with a reason under its existing external-write prohibition. |
| A6 | Preserve exact historical pending dispatches | ADR-015 and file-handoff tests require byte-identical neutral retries. New rules and agent identity apply when a new dispatch is assembled. Existing pending prompts have a documented upgrade limit. |
| A7 | Preserve Wave 7 ownership through the existing dispatch interface | `skill-md-context-diet` owns both skills wholesale, and `quote-router-in-skill-loops` owns path quoting. This design needs neither skill edited. Shared text and test integration receive a final compatibility check. |
| A8 | Reuse the applied F1 fix and add pending verification rather than duplicate it | Review F1, commit `19affb2` and the current classifier/regression establish that the correction already exists. New Phase 4 acceptance does not change completed rows. |
| A9 | Include the minimal F2 cleanup in the follow-up and preserve the local file | The user requests that review findings become planned work and delegates unattended decisions. Review F2 recommends tracking removal and an ignore rule; the Git inventory shows one root file. Index-only removal is reversible and keeps all local bytes. This resolves the review's deferred scope choice for planning, without performing cleanup here. |
| A10 | Judge package cleanliness on a clean export and inspect validation diagnostics | The review verification records exit 0 alongside `ARCHIVE_OS_METADATA_FILE`. Preserving the ignored local file can leave that warning in the working directory; the candidate tracked export is the acceptance target. No package submission or publication is needed. |

### Options from change.md

| Option | Selection | Reason |
| --- | --- | --- |
| 1. Shared safety text | Adopt through `rules/top.md` | The ticket's suffix/new-template carrier was superseded by ADR-023. An override must retain these rules. |
| 2. Planning and review checks | Adopt through step rules | One carrier covers each step's variants, including re-plans and confirmation reviews. |
| 3. Step-specific harness guard | Adopt with bounded Claude coverage | Current documentation supports identity-bearing plugin hooks inside subagents. A dedicated routed identity avoids applying pipeline restrictions to unrelated agents. |
| 4. Router checks remote refs afterward | Drop | Detection occurs after publication, adds network failure modes and misses PR/comment/delete side effects. The router stays network-free. |

### Harness evidence and limits

The documented hook input includes `agent_id` and `agent_type`. `PreToolUse` supports a deny decision, and command hooks can set `onFailure` to `block` on Claude Code 2.1.295+. Use a plugin-level command hook with an argument vector and the plugin-root path. Pass-through emits no permission grant. The inspected local host is 2.1.311. The plugin currently advertises Claude Code 2.1.292+ in `README.md`. Preserve that overall compatibility baseline and document the separate 2.1.295+ requirement for this fail-closed guard in the README and reference. Hosts below 2.1.295 retain semantic prompt rules and existing permission controls, with runtime guard enforcement unverified. A successful install or plugin validation alone establishes no fail-closed guarantee on those hosts. Live delivery of the scoped identity remains a Manual acceptance check. [Hooks reference](https://code.claude.com/docs/en/hooks)

Settings and plugin hooks apply inside subagents. Plugin-shipped agent frontmatter ignores `hooks` and `permissionMode`. Declare the hook at the plugin level. Inherit tools in the new agent so toolkit skills, shell execution and connected tools keep their normal entry points. [Subagent documentation](https://code.claude.com/docs/en/sub-agents)

`hooks/hooks.json` is a supported automatically loaded plugin location. This avoids skill-frontmatter edits during Wave 7 and avoids duplicating registration in the manifest. [Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference)

The runtime subset covers direct destructive Git forms named in the incident, direct publication calls, direct recursive `rm` and `find` deletion, and direct invocation of the two publication scripts. Recognize the simple quoted arguments and shell separators required by the regression matrix. Keep detection bounded and explicit. Test safe command text in quoted output as well as real command positions.

The guard does not inspect programs launched by an otherwise permitted command. Aliases, dynamic command construction, unrecognized shell syntax, alternative executables, recursive deletion inside interpreters, filesystem tools and MCP/API actions remain outside that runtime subset. The prompt rules cover their semantics. Existing source scanning continues to cover prohibited deletion calls in repository code. Runtime enforcement for OpenAI children and arbitrary user-supplied custom Claude agents remains under existing host controls.

Identity-bearing events for `agent-smith:step` are the guard's supported scope. Valid orchestrator events without a subagent id and events for unrelated types pass through. An identified guarded agent with malformed command input is denied. Malformed hook JSON, startup failure and timeout fail closed. A broken hook can therefore also block matching orchestrator Bash calls before identity is established. Disabled hooks, older identity schemas and managed settings that suppress plugin hooks provide no runtime guarantee.

### Rule semantics

The shared rules must explicitly cover each repository prohibition and the supported safe procedure.

- Preserve uncommitted work. Name `git reset --hard`, path checkout, destructive `git restore`, `git clean`, and stash drop/clear. Preserve the repository's recoverability condition, while reserving run rollback and `refs/agent-smith/` mutation to the router. Treat staged-only versions as uncommitted work too. `git restore --staged` replaces the index from HEAD by default and can discard a unique staged version when the working copy differs. Permit a restore that replaces index contents only after its affected contents are preserved in a commit or ref. The stateless hook cannot establish that preservation, so its direct-command subset denies stage-only restore as well as worktree restore.
- Forbid force-push and rewriting pushed history, bypassing hooks with `--no-verify`, and deleting the only reachable copy of commits through branch, tag, ref or worktree deletion. State-dependent operations retain their repository recoverability condition.
- Carry GitHub prohibitions on deleting repositories, releases, tags, issues and comments, and changing repository settings or protection. Carry the human review/merge boundary of ADR-017.
- Forbid step publication through push, `gh`, PR creation, PR/report comments or equivalent APIs. A step cannot invoke `open-pr.mjs` or `pr-comment.mjs` to perform publication indirectly. The orchestrator runs those scripts at the existing terminal points and with the existing comment authorization.
- Preserve the file-by-file deletion procedure and helper ownership. Ensure the rule names recursive shell deletion and recursive Node filesystem forms, including `fs.rmdir`/`fs.rmdirSync`, consistently with the source guard.
- Retain step-specific restrictions such as manual verification's read-only Git and OpenSpec archive's stricter commit rules. Keep every new rule in GIVEN/WHEN/THEN form with one bold RFC 2119 keyword, ahead of the final RESULT line.

### Concurrent-change reconciliation

| Concurrent work | Boundary for this change |
| --- | --- |
| `skill-md-context-diet` | Leave both `SKILL.md` files to its rewrite. Router-selected `agent` already flows through normal and archive calls. Preserve that contract when integrating shared tests and reference text. |
| `quote-router-in-skill-loops` | Leave command quoting to its owner. Use argument-vector hook registration, and test plugin paths containing spaces. |
| `stale-last-result-cleanup` | Restrict `flow.mjs` edits to dispatch selection. Leave `attachResult`, stale-file handling and result-consumption ordering to that change. |
| `commit-lint-merge-prefix`, `workflow-pins-local-actions` | Their tool implementations are outside this change. Run the shared tools suite at the final gate. |

The current wave rules permit shared reference and skill-test integration in separate regions. This design avoids the skill rewrite entirely, so a wave-table edit or a new scheduling prerequisite is unnecessary. If integration produces a conflict, reconcile only the affected hunks on this run branch with an ordinary merge that preserves both changes. Use the committed concurrent artifacts available then, and verify the forwarding and anti-stall contracts again. Leave `WAVES.md` untouched. [Concurrent change definitions](../WAVES.md), [skill rewrite](../skill-md-context-diet/change.md), [path quoting](../quote-router-in-skill-loops/change.md), [result cleanup](../stale-last-result-cleanup/change.md)

## Phase 1: Shared safety and planning rules

### Overview

Close the prompt gap at its existing owners before adding runtime dispatch behavior.

### Changes Required

#### 1. Always-true safety rules

**File** `skills/10x-pipeline/rules/top.md`

**Intent** Carry the rule semantics above into every routed task, preserving the existing deletion procedure and final RESULT contract.

**Contract** Fixed-path top-level rules are independent of project prompt overrides. They permit authorized implementation/archive commits and router-owned recovery while prohibiting step publication.

#### 2. Planning boundaries

**Files** `skills/10x-pipeline/rules/steps/plan.md`, `skills/10x-pipeline/rules/steps/plan-review.md`, `skills/openspec-pipeline/rules/steps/os-propose.md`

**Intent** Keep implementation acceptance achievable before publication and require reviewers to detect the original failure pattern.

**Contract** Planning variants forbid Automated rows that require a pushed branch, an open PR, PR CI or an external PR comment. Use local deterministic checks where they prove the claim, and Manual rows for post-publication observations. OpenSpec keeps publication-dependent follow-up outside executable apply tasks, in the planning artifacts. Reviews inspect both phase Success Criteria and canonical Progress. Move an actionable pending PR-dependent row intact to Manual, preserve its id/title/tick state, synchronize its Success Criteria and brief, and add a separate local row only when it proves a distinct claim. Ticked or otherwise immutable contradictions follow existing finding/needsHuman handling. Local tests using fake Git/GitHub clients are valid Automated criteria.

#### 3. Prompt regressions and indexes

**Files** new `skills/10x-pipeline/test/step-safety.test.mjs`, existing `skills/10x-pipeline/test/rule-levels.test.mjs`, `skills/10x-pipeline/test/rules.test.mjs`, `skills/10x-pipeline/test/no-recursive-delete.test.mjs`, `skills/10x-pipeline/test/prompt-handoff.test.mjs`, `skills/10x-pipeline/rules/README.md`, `skills/10x-pipeline/prompts/README.md`, `skills/openspec-pipeline/prompts/README.md`, `skills/10x-pipeline/test/README.md`

**Intent** Pin safety content to its actual carriers and index every new file. Use existing scratch-copy, rule-tail and CLI fixtures.

**Contract** A removed prohibition or missing planning carrier fails a focused assertion. Cover shipped step tails, planning variants, both real archive assembly paths, suffix/template overrides and file-handoff task bodies. Keep stronger deletion-scanner assertions and existing precedence/format checks. Fixture strings describing denied commands are inert data, and remain subject to the existing source-safety scan.

### Success Criteria

#### Automated Verification

- All routed rule tails and representative real run/archive actions carry the Git, deletion and publication invariants, including overrides and file-handoff bodies.
- Every planning and plan-review variant carries the pre-publication criterion rule, including the OpenSpec planning equivalent and safe local fake-client examples.
- Rule-form, layered-rule, deletion, nested-subagent and prompt-handoff regression files pass with their safety assertions intact.

## Phase 2: Scoped Claude guard and dispatch compatibility

### Overview

Add runtime denial for the direct-command subset using a supported identity boundary and the existing orchestrator forwarding contract.

### Changes Required

#### 1. Routed identity

**Files** new `agents/step.md`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/isolation.mjs`

**Intent** Supply a stable plugin-scoped identity to new ordinary Claude actions through one shared provider-aware dispatch choice. Extend the normal and archive action owners.

**Contract** New Claude actions use `agent-smith:step` when no usable existing restricted mapping selects a type. Preserve restricted-agent lookup and OpenAI rejection semantics. Preserve the existing archive treatment of restricted mappings, adding the fixed guarded Claude identity there. OpenAI actions acquire no Claude agent. The new agent inherits tools and defines no model, effort, hooks, permission mode or additional worktree isolation. Store normal dispatch identity in the existing `agent` field. Replay historical neutral retries exactly, including a historically absent field. Missing agent resolution follows existing failure handling with no general-purpose retry.

#### 2. Native hook

**Files** new `hooks/hooks.json`, new `skills/10x-pipeline/scripts/step-guard.mjs`

**Intent** Deny common direct unsafe Bash commands before execution when the caller has the dedicated routed identity.

**Contract** One synchronous `PreToolUse` Bash hook launches Node using an argument vector and `${CLAUDE_PLUGIN_ROOT}`, with bounded execution and `onFailure: block`. The script reads bounded JSON from stdin, validates the event and scope, and returns the documented deny decision or neutral pass-through. It performs no shell execution, Git/network calls, filesystem mutation or routing. Scope and runtime coverage follow the limits above. A denial explains the applicable rule and the safe route through preservation, inspected per-file cleanup, or orchestrator-owned publication. State-dependent discard/delete behavior retains the repository's recoverability semantics, and unprovable safety gets a deny within the guarded command subset. This includes stage-only restore because an index-only version may be unique and the hook performs no repository-state proof. The retained Progress row 2.2 includes stage-only restore in its original permit list. For that case, implement and verify conservative denial, preserving the immutable row title and its other positive cases.

Review F1 clarifies the existing literal-command contract: consume separate and attached option values before flag classification or interpreting `--` as a terminator. Exclusion patterns and commit messages are data, and the last actual dry-run setting controls the clean exception. The applied fix owns this behavior; Phase 4 supplies its explicit follow-up acceptance without altering row 2.2.

#### 3. Provenance and regressions

**Files** `skills/10x-pipeline/scripts/isolation.mjs`, new `skills/10x-pipeline/test/step-guard.test.mjs`, `skills/10x-pipeline/test/agents.test.mjs`, `skills/10x-pipeline/test/provenance.test.mjs`, `skills/10x-pipeline/test/neutral.test.mjs`, `skills/10x-pipeline/test/codex-chain.test.mjs`, `skills/10x-pipeline/test/prompt-handoff.test.mjs`, `skills/10x-pipeline/test/archive.test.mjs`, `skills/10x-pipeline/test/archive-gate.test.mjs`, `skills/openspec-pipeline/test/openspec-archive.test.mjs`, `skills/10x-pipeline/test/no-recursive-delete.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent** Make the hook's effective bytes visible to comparison and verify the changed dispatch contract without weakening restricted-agent or OpenAI assertions.

**Contract** Add a deterministic `hookFiles` provenance section over the shipped hook JSON and guard script, using existing hashing/error conventions. Keep historical stored provenance immutable. Scratch plugin copies exercising that section include the new files. Update exact-field assertions for the intentional default Claude `agent` addition. Keep arbitrary custom mapping behavior and old neutral dispatches compatible. Tests feed inert hook payloads and use recording fake executables, so prohibited operations never execute. Pin the shipped hook registration's synchronous Bash matcher, Node argument vector, bounded timeout and `onFailure: block`, so removing fail-closed configuration fails a regression independently of plugin schema validation. Extend the existing deletion scan to the new root `hooks/` directory and cover hook JSON discovery with a scratch fixture.

### Success Criteria

#### Automated Verification

- New Claude run and archive actions on both chains select the guarded identity, retain explicit restricted selections where already supported, and preserve exact legacy neutral retries.
- Hook payload tests deny the documented direct Git/publication/delete forms and permit safe commits, read-only Git, stage-only restore, inspected file unlink/empty rmdir, orchestrator calls and unrelated agents.
- Hook tests cover scoped malformed input, invalid JSON, oversized input, quoted arguments, supported compound commands, harmless quoted command text and plugin paths containing spaces.
- OpenAI dispatch and runner fixtures pass with their original configuration, capability-rejection, usage and lifecycle contracts, and hook/agent/rule byte changes produce the expected independent provenance drift.
- Plugin validation accepts the hook layout and both complete chain/tool suites pass on Node 24 or later.

#### Manual Verification

- A fresh supported Claude host reports the dedicated agent identity in PreToolUse for both chains, blocks inert attempted breach commands before fake executables run, permits typed/archive commits, and allows the orchestrator's recording publication-script calls.
- A live planning/review probe moves a PR-CI-dependent Automated criterion to Manual while retaining a valid local fake-client test criterion and the original Progress identities.

## Phase 3: Documentation and integration acceptance

### Overview

Record ownership, compatibility, supported guard coverage and remaining host acceptance explicitly.

### Changes Required

#### 1. Reference and decisions

**Files** `README.md`, `docs/REFERENCE.md`, `docs/ADR/ADR-009-managed-agent-patterns.md`, `docs/ADR/ADR-016-no-recursive-force-delete.md`, `docs/ADR/ADR-017-run-branch-always-pushed-for-review.md`, `docs/ADR/ADR-023-layered-rules.md`, `docs/ADR/ADR-024-openai-codex-support.md`, `docs/ADR/README.md`

**Intent** Amend current behavior while preserving historical decision context. Explain the shared semantic rules and the bounded host-specific enforcement.

**Contract** ADR-009 records the guarded Claude default separately from opt-in tool restriction and corrects its broad historical hook claim. ADR-016 records the supported direct-shell guard and remaining deletion limits. ADR-017 records step publication prohibitions, indirect script calls and pre-publication acceptance boundaries. ADR-023 indexes the new step owners. ADR-024 records provider-specific enforcement limits. Reference updates reach provider dispatch, restricted agents, provenance, deletion, publication, planning and upgrade limits. The README prerequisites and reference state both the existing 2.1.292+ plugin baseline and the separate 2.1.295+ fail-closed guard requirement, including the older-host enforcement limitation. Search active docs for stale claims that archive never carries an agent, defaults never carry one, or plugin hooks cannot run inside subagents. Keep the distinction between unsupported agent-frontmatter hooks and supported plugin hooks precise.

#### 2. Concurrent integration and final gate

**Files** the changed rule/prompt/test indexes and affected shared reference/test hunks

**Intent** Verify the new dispatch works with the Wave 7 skill rewrite and path-quoting work through the established interface.

**Contract** Both skills still forward `agent`, retain provider dispatch and unchanged anti-stall equivalence, and invoke terminal publication scripts in the required order. Re-run relevant contracts after integrating available concurrent changes. Keep model/tier logic in its existing owners. Pending host checks retain truthful Manual status and reasons.

### Success Criteria

#### Automated Verification

- Rule/prompt/test/ADR indexes and current reference sections document the selected ownership, planning boundary, upgrade behavior and runtime coverage limits consistently.
- Shared skill contracts preserve router-agent forwarding, provider dispatch, anti-stall equality and terminal publication ownership after available concurrent changes are reconciled.
- The complete repository test command passes and the final diff contains no edits to WAVES.md, context/archive, release fields or unrelated concurrent-change implementations.

#### Manual Verification

- On the resulting run PR after orchestrator publication, a human records PR CI acceptance and reviews any live host checks still pending.

## Phase 4: Implementation-review follow-up

### Overview

Close the review's remaining scope gap through a reversible packaging cleanup and verify the already-applied parser correction. Preserve all previous Progress rows and keep live-host and PR acceptance in their existing Manual rows.

### Changes Required

#### 1. Applied F1 correction and regression

**Files** `skills/10x-pipeline/scripts/step-guard.mjs`, `skills/10x-pipeline/test/step-guard.test.mjs` (verification targets; no new edits required if the applied correction passes)

**Intent** Retain the reviewed fix at the owning classifier and prove the original destructive false negatives and safe-commit false positives remain corrected.

**Contract** Reuse the existing inert-payload test for option values. Deny clean commands whose apparent dry-run token is an exclusion value, or whose last real setting is `--no-dry-run`; allow a genuine final dry-run setting. Consume commit messages, trailers and other recognized option values before interpreting `--` or hook-bypass flags. Preserve safe attached messages and deny actual `--no-verify`/`-n`. Run the whole guard test file; never execute prohibited commands as a reproduction. Keep the existing bounded parser, identity, neutral-output and dependency limits. Only a failing acceptance check justifies a further focused correction.

#### 2. F2 tracking cleanup

**Files** `.gitignore`, tracked root `.DS_Store`

**Intent** Remove accidental operating-system metadata from the distributable plugin and prevent ordinary bookkeeping staging from adding it again.

**Contract** Record the local file's digest, add the basename pattern `.DS_Store` to the existing root ignore file, and remove only the root file from tracking with `git rm --cached -- .DS_Store`. Keep the working-copy file byte-identical; do not use forced removal or discard other staged work. Verify that no `.DS_Store` remains tracked and that root and representative nested paths match the repository ignore rule. Preserve `.claude/worktrees/` and every unrelated ignore entry. No recursive cleanup or history rewrite is involved.

#### 3. Package validation and evidence

**File** new `context/changes/step-subagent-git-guard/evidence/review-follow-up-verification.txt`

**Intent** Prove the candidate package is clean without deleting local preferences or treating a zero validator exit as sufficient acceptance.

**Contract** Export the candidate tracked tree after cleanup (the staged index tree or cleanup commit) into worktree-local scratch, using Git's existing export facilities. Record the exact tree/commit and verify the export contains no `.DS_Store`. Run `claude plugin validate . --strict` from that export and inspect both its exit status and diagnostics: `ARCHIVE_OS_METADATA_FILE` must be absent, while the pre-existing `ICON_MISSING` warning is recorded separately. Do not claim that the working directory containing the retained ignored file is clean. Record guard results, tracking/ignore checks and before/after local-file digests in the new evidence file; leave the review and previous evidence unchanged. Use the existing scratch isolation and `removeTree` conventions. No new package script, dependency or permanent test is needed for the ignore-only change. Reuse the review's complete-suite result for unchanged runtime code; rerun the required complete command if scripts, prompts, policy or tools change, or a new failure warrants it.

### Success Criteria

#### Automated Verification

- F1's existing option-value regression and the complete guard test file pass, covering real dry-run precedence, flag-looking values, hook bypass and safe attached commit messages with inert payloads only.
- F2's root .DS_Store is untracked, the root and nested metadata paths match the repository ignore rule, and the retained local file has the same digest as before cleanup.
- A clean export of the candidate tracked tree contains no .DS_Store, strict plugin validation reports no ARCHIVE_OS_METADATA_FILE, and follow-up evidence records the export identity, diagnostics, focused results and applicable complete-suite evidence.

## Testing Strategy

### Prompt and planning matrix

Exercise every shipped step tail, every planning variant, initial/confirmation review, both archive paths, isolated and opt-out runs, suffix/template replacement and file handoff. Assert each named Git prohibition individually and ensure RESULT remains last. A fixture requiring real PR CI belongs to Manual. A fixture testing PR-script behavior through fake clients remains Automated. Content assertions prove delivery of instructions, and the live probe verifies model adherence.

### Guard matrix

Use JSON payloads, never live dangerous commands. Direct denied cases include push with ordinary/force flags, `gh` PR operations, hook bypass, unsnapshotted hard reset, path checkout, destructive restore, clean, stash drop/clear, recursive `rm` flag variants, `find` deletion, and direct publication-script execution. Stage-only restore is denied, including the case where HEAD, index and working-copy contents all differ. Use inert payload assertions for that denial and verify that a denied call reaches no recording executable. Positive cases include status/log/diff, add and typed commit, clean with `--dry-run`, stash listing, a file named like a flag after `--`, single-file cleanup, empty-directory removal, harmless quoted examples, and the same publication-script command in an orchestrator event. Include simple leading `cd` and chained commands used by the skills. A restore combining staged and worktree flags follows the same denial. Confirm neutral output never grants permission, and assert the fail-closed registration fields alongside payload decisions. Explicitly test and document the bounded syntax limits instead of presenting unknown forms as verified coverage.

Review F1 adds explicit boundary cases already present in `step-guard.test.mjs:72`: clean exclusion values resembling `-n`/`--dry-run`, attached short-option values, later `--no-dry-run` and later real dry-run overrides, `--` consumed as a commit option value, and safe attached messages containing `n`. Preserve both denial and neutral expectations. Run `node --test skills/10x-pipeline/test/step-guard.test.mjs` for Phase 4; change neither parser nor fixtures merely to create new work.

### Packaging follow-up

Use `git ls-files -- .DS_Store "**/.DS_Store"` to check tracked contents and `git check-ignore -v --no-index -- .DS_Store nested/.DS_Store` to confirm the root `.gitignore` owns both matches. Verify the original local digest after index removal. Validate the clean tracked export described in Phase 4, capturing diagnostics as well as the process exit. These are local Automated checks with no PR or external-write dependency.

### Commands

Run from the selected run root, with Node 24+. The focused set grows with each phase. Once scripts, prompts or policy-related runtime behavior change, run the repository-required gate after that phase.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

Plugin validation is model-free. For Phase 4, run it from the clean candidate export and inspect the diagnostics as specified above.

```sh
claude plugin validate . --strict
```

Use existing scratch helpers and `removeTree`. A host that restricts writes to the worktree needs a worktree-local scratch directory and a parent-discovery barrier as in planning evidence. Keep production run state under router ownership. The full suite includes fake publication-script tests, so no real branch push or GitHub write is needed for an Automated row.

### Live acceptance

Only the top-level host or a human launches the live probe. Record host version, plugin load method, scoped identity, deny response and fake executable call logs. Use a disposable local repository and fake publication executables. This unattended planning subagent cannot launch that probe under its flat-delegation rule. Accept live rows only with host transcripts and fake executable call logs. Leave unavailable live rows pending with reasons. The actual run PR and its CI are checked after orchestrator publication.

## Performance Considerations

The hook adds one small Node process per matching Bash call in a Claude session with this plugin. Bound input and timeout, perform the identity check before command classification, and avoid repository scans, network calls, persistent caches or extra tracking files. The constant-cost hook replaces the proposed remote-ref polling. Record any visible live overhead with acceptance evidence.

## Migration Notes

No run-state schema rewrite is required. New normal Claude actions intentionally gain the existing optional `agent` field, and new Claude archive actions gain it as well. Existing exact pending dispatches retain their stored selection and prompt until consumed. A fresh session loads the new plugin agent and hooks. OpenAI profiles and parent approvals keep their existing meaning.

New rule files change `ruleFiles`, the new agent changes `agentFiles`, and hook bytes change `hookFiles`. Document expected provenance/compare warnings for in-flight upgrades. Reverting the implementation restores earlier prompt/default-agent behavior through ordinary version control while preserving stored dispatches. No cleanup deletes run evidence, refs or worktrees.

Phase 4 removes only Git tracking for local metadata. The existing local file remains ignored and byte-identical; fresh checkouts and exports omit it. Reverting that cleanup is an ordinary version-control change, without rewriting pushed history. The applied F1 guard bytes already participate in `hookFiles`; verification adds no new provenance schema.

## References

- Task incidents, options and acceptance requirements in `context/changes/step-subagent-git-guard/change.md`.
- Layered rule lookup and precedence in `skills/10x-pipeline/scripts/flow.mjs:891` and `skills/10x-pipeline/rules/README.md`.
- Normal dispatch in `skills/10x-pipeline/scripts/route.mjs:219`, archive assembly in `skills/10x-pipeline/scripts/isolation.mjs:739`, restricted selection in `skills/10x-pipeline/scripts/flow.mjs:981`.
- Exact neutral replay in `skills/10x-pipeline/scripts/flow.mjs:438`, provenance in `skills/10x-pipeline/scripts/isolation.mjs:52`, OpenAI runner configuration in `skills/10x-pipeline/scripts/run-codex.mjs:125`.
- Existing content/CLI patterns in `skills/10x-pipeline/test/rule-levels.test.mjs`, `agents.test.mjs`, `rules.test.mjs`, `no-recursive-delete.test.mjs` and `nested-subagents.test.mjs`.
- Review mutation restrictions in `skills/10x-pipeline/prompts/plan-review-apply.md`. External-write restrictions and pending-evidence behavior in `skills/10x-pipeline/prompts/manual-verify.md`.
- Architecture decisions ADR-009, ADR-010, ADR-012, ADR-015, ADR-016, ADR-017, ADR-023 and ADR-024 in `docs/ADR/`.
- Concurrent boundaries in `context/changes/WAVES.md` and the active change definitions listed above. `context/foundation/lessons.md` supplies the no-nested-subagent and documentation-drift priors. The roadmap has no matching Change ID.
- Authoritative Claude Code hook, subagent and plugin-manifest documentation linked above, inspected 2026-11-15. CLI versions establish local availability, with live behavior reserved for Manual acceptance.
- Implementation-review findings F1/F2 in `context/changes/step-subagent-git-guard/reviews/impl-review.md`, with existing evidence in `evidence/impl-review-verification.txt` and `evidence/impl-review-guard-regression.txt`.
- Applied F1 correction in commit `19affb2e3c16a2de2508e5c06be09e2d02be28ab`, `skills/10x-pipeline/scripts/step-guard.mjs:61` and `skills/10x-pipeline/test/step-guard.test.mjs:72`; F2 inventory from Git's index and current `.gitignore:1`.

## Progress

### Phase 1: Shared safety and planning rules

#### Automated

- [x] 1.1 All routed rule tails and representative real run/archive actions carry the Git, deletion and publication invariants, including overrides and file-handoff bodies. — e513e93
- [x] 1.2 Every planning and plan-review variant carries the pre-publication criterion rule, including the OpenSpec planning equivalent and safe local fake-client examples. — e513e93
- [x] 1.3 Rule-form, layered-rule, deletion, nested-subagent and prompt-handoff regression files pass with their safety assertions intact. — e513e93

### Phase 2: Scoped Claude guard and dispatch compatibility

#### Automated

- [x] 2.1 New Claude run and archive actions on both chains select the guarded identity, retain explicit restricted selections where already supported, and preserve exact legacy neutral retries. — afdd5cb
- [x] 2.2 Hook payload tests deny the documented direct Git/publication/delete forms and permit safe commits, read-only Git, stage-only restore, inspected file unlink/empty rmdir, orchestrator calls and unrelated agents. — afdd5cb
- [x] 2.3 Hook tests cover scoped malformed input, invalid JSON, oversized input, quoted arguments, supported compound commands, harmless quoted command text and plugin paths containing spaces. — afdd5cb
- [x] 2.4 OpenAI dispatch and runner fixtures pass with their original configuration, capability-rejection, usage and lifecycle contracts, and hook/agent/rule byte changes produce the expected independent provenance drift. — afdd5cb
- [x] 2.5 Plugin validation accepts the hook layout and both complete chain/tool suites pass on Node 24 or later. — afdd5cb

#### Manual

- [ ] 2.6 A fresh supported Claude host reports the dedicated agent identity in PreToolUse for both chains, blocks inert attempted breach commands before fake executables run, permits typed/archive commits, and allows the orchestrator's recording publication-script calls.
- [ ] 2.7 A live planning/review probe moves a PR-CI-dependent Automated criterion to Manual while retaining a valid local fake-client test criterion and the original Progress identities.

### Phase 3: Documentation and integration acceptance

#### Automated

- [x] 3.1 Rule/prompt/test/ADR indexes and current reference sections document the selected ownership, planning boundary, upgrade behavior and runtime coverage limits consistently. — f59e3cd
- [x] 3.2 Shared skill contracts preserve router-agent forwarding, provider dispatch, anti-stall equality and terminal publication ownership after available concurrent changes are reconciled. — f59e3cd
- [x] 3.3 The complete repository test command passes and the final diff contains no edits to WAVES.md, context/archive, release fields or unrelated concurrent-change implementations. — f59e3cd

#### Manual

- [ ] 3.4 On the resulting run PR after orchestrator publication, a human records PR CI acceptance and reviews any live host checks still pending.

### Phase 4: Implementation-review follow-up

#### Automated

- [x] 4.1 F1's existing option-value regression and the complete guard test file pass, covering real dry-run precedence, flag-looking values, hook bypass and safe attached commit messages with inert payloads only.
- [x] 4.2 F2's root .DS_Store is untracked, the root and nested metadata paths match the repository ignore rule, and the retained local file has the same digest as before cleanup.
- [x] 4.3 A clean export of the candidate tracked tree contains no .DS_Store, strict plugin validation reports no ARCHIVE_OS_METADATA_FILE, and follow-up evidence records the export identity, diagnostics, focused results and applicable complete-suite evidence.
