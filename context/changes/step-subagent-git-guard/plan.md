# Step subagent Git and deletion safety implementation plan

## Overview

Carry repository Git, deletion and publication rules into every routed task through the existing always-true rule hierarchy. Keep planning and plan-review acceptance executable before publication, and add a scoped Claude Code hook for common direct unsafe shell commands.

This plan addresses the three incidents recorded in `change.md`. Complexity is HIGH because prompt ownership, native dispatch identity, archive dispatch, historical retries and provenance intersect. The unattended instruction delegates decisions to researched evidence, including the interview and phase approvals normally requested by `/10x-plan`.

## Current State Analysis

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

## Desired End State

Every newly assembled task carries always-true Git/deletion/publication rules, including both archive tasks, overridden templates and file-handoff task bodies. Allowed typed implementation commits and archive commits remain usable. The router retains ownership of snapshots, rollback and run state, and orchestrator scripts retain publication ownership.

Every planning variant produces Automated criteria that can run locally before publication. Plan reviews catch PR-dependent Automated rows and preserve immutable Progress identities while applying an actionable correction. OpenSpec proposal tasks follow the equivalent boundary.

New Claude dispatches use a dedicated inherited-tool agent unless an existing restricted mapping selects another agent. A plugin-level hook recognizes that dedicated agent and denies the documented direct-command subset. Its supported-host evidence and bypass limits are explicit. OpenAI task prompts receive the same safety rules and keep their existing execution/permission controls.

## Scope boundaries

Scope covers rule files, a small native hook and its routed identity, focused regression tests, provenance, rule/prompt/test indexes, reference documentation and amendments to the existing decisions. The complete rule semantics apply to actions through any tool or API. The shell hook provides the narrower runtime coverage specified below.

Excluded work includes remote-ref polling, remote mutation during verification, a general shell parser, an OpenAI permission-profile redesign, dependency additions, version changes, tier/model changes, and edits to `WAVES.md` or `context/archive/`.

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

## Testing Strategy

### Prompt and planning matrix

Exercise every shipped step tail, every planning variant, initial/confirmation review, both archive paths, isolated and opt-out runs, suffix/template replacement and file handoff. Assert each named Git prohibition individually and ensure RESULT remains last. A fixture requiring real PR CI belongs to Manual. A fixture testing PR-script behavior through fake clients remains Automated. Content assertions prove delivery of instructions, and the live probe verifies model adherence.

### Guard matrix

Use JSON payloads, never live dangerous commands. Direct denied cases include push with ordinary/force flags, `gh` PR operations, hook bypass, unsnapshotted hard reset, path checkout, destructive restore, clean, stash drop/clear, recursive `rm` flag variants, `find` deletion, and direct publication-script execution. Stage-only restore is denied, including the case where HEAD, index and working-copy contents all differ. Use inert payload assertions for that denial and verify that a denied call reaches no recording executable. Positive cases include status/log/diff, add and typed commit, clean with `--dry-run`, stash listing, a file named like a flag after `--`, single-file cleanup, empty-directory removal, harmless quoted examples, and the same publication-script command in an orchestrator event. Include simple leading `cd` and chained commands used by the skills. A restore combining staged and worktree flags follows the same denial. Confirm neutral output never grants permission, and assert the fail-closed registration fields alongside payload decisions. Explicitly test and document the bounded syntax limits instead of presenting unknown forms as verified coverage.

### Commands

Run from the selected run root, with Node 24+. The focused set grows with each phase. Once scripts, prompts or policy-related runtime behavior change, run the repository-required gate after that phase.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

Plugin validation is model-free.

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

## Progress

### Phase 1: Shared safety and planning rules

#### Automated

- [ ] 1.1 All routed rule tails and representative real run/archive actions carry the Git, deletion and publication invariants, including overrides and file-handoff bodies.
- [ ] 1.2 Every planning and plan-review variant carries the pre-publication criterion rule, including the OpenSpec planning equivalent and safe local fake-client examples.
- [ ] 1.3 Rule-form, layered-rule, deletion, nested-subagent and prompt-handoff regression files pass with their safety assertions intact.

### Phase 2: Scoped Claude guard and dispatch compatibility

#### Automated

- [ ] 2.1 New Claude run and archive actions on both chains select the guarded identity, retain explicit restricted selections where already supported, and preserve exact legacy neutral retries.
- [ ] 2.2 Hook payload tests deny the documented direct Git/publication/delete forms and permit safe commits, read-only Git, stage-only restore, inspected file unlink/empty rmdir, orchestrator calls and unrelated agents.
- [ ] 2.3 Hook tests cover scoped malformed input, invalid JSON, oversized input, quoted arguments, supported compound commands, harmless quoted command text and plugin paths containing spaces.
- [ ] 2.4 OpenAI dispatch and runner fixtures pass with their original configuration, capability-rejection, usage and lifecycle contracts, and hook/agent/rule byte changes produce the expected independent provenance drift.
- [ ] 2.5 Plugin validation accepts the hook layout and both complete chain/tool suites pass on Node 24 or later.

#### Manual

- [ ] 2.6 A fresh supported Claude host reports the dedicated agent identity in PreToolUse for both chains, blocks inert attempted breach commands before fake executables run, permits typed/archive commits, and allows the orchestrator's recording publication-script calls.
- [ ] 2.7 A live planning/review probe moves a PR-CI-dependent Automated criterion to Manual while retaining a valid local fake-client test criterion and the original Progress identities.

### Phase 3: Documentation and integration acceptance

#### Automated

- [ ] 3.1 Rule/prompt/test/ADR indexes and current reference sections document the selected ownership, planning boundary, upgrade behavior and runtime coverage limits consistently.
- [ ] 3.2 Shared skill contracts preserve router-agent forwarding, provider dispatch, anti-stall equality and terminal publication ownership after available concurrent changes are reconciled.
- [ ] 3.3 The complete repository test command passes and the final diff contains no edits to WAVES.md, context/archive, release fields or unrelated concurrent-change implementations.

#### Manual

- [ ] 3.4 On the resulting run PR after orchestrator publication, a human records PR CI acceptance and reviews any live host checks still pending.
