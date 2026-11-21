# Init Permission Warnings Implementation Plan

## Overview

Surface missing Codex permission profiles and linked-worktree Git write configuration during `init`, with a targeted remedy for each. A warning is advisory and directs the operator to the relevant setting before a later provider dispatch reaches its permission gate.

## Current State Analysis

- Both chains prepare an isolated run root and call the shared router from it. `init` validates selection and isolation, writes metadata, makes the existing start commit when applicable and enters the normal dispatch path. Provider assignment can differ from the session host, especially in split mode. [route.mjs](../../../skills/10x-pipeline/scripts/route.mjs#L1080) · [state.mjs](../../../skills/10x-pipeline/scripts/state.mjs#L99)
- For OpenAI steps, `codex.profile` selects an optional Codex configuration overlay through `-p`. The effective `default_permissions` value selects a permission profile within that configuration. Codex resolves config precedence, trust and managed requirements. [run-codex.mjs](../../../skills/10x-pipeline/scripts/run-codex.mjs#L20) · [Codex config precedence](https://developers.openai.com/codex/config-basic/#configuration-precedence)
- Git resolves the per-worktree metadata and shared Git directories separately. Both guarded runners already use provider-side probes to prove Git capability at dispatch. Claude documents implicit shared Git writes when launched at the linked-worktree root. An absent explicit entry matters as configuration advice, and actual capabilities depend on the session and its restrictions. [isolation.mjs](../../../skills/10x-pipeline/scripts/isolation.mjs#L291) · [permission-probe.mjs](../../../skills/10x-pipeline/scripts/permission-probe.mjs) · [Claude filesystem isolation](https://code.claude.com/docs/en/sandboxing.md#filesystem-isolation)

## Desired End State

- When a run can dispatch Codex and Codex confirms its selected custom permission profile is undefined, `init` shows a TOML snippet for the named profile in the target's trusted `.codex/config.toml`. The snippet extends `:workspace` and, where Git resolves a common directory, scopes its added write rule to that directory. It points to the active config overlay and project trust when relevant.
- When a run can dispatch Claude and its linked worktree's shared Git directory lacks a covering entry in the inspected Claude write lists, `init` shows the canonical absolute path and a `sandbox.filesystem.allowWrite` JSON entry. The wording explains that this is an explicit settings check and suggests the entry when sandboxed Git writes fail.
- Both skills surface warnings before dispatch. Direct CLI consumers still receive one action JSON object on stdout and the existing action and exit status. A repaired configuration is evaluated afresh on resume.

## Scope Boundaries

The router owns advisory diagnostics. Operators own settings and trust. The provider runners retain runtime capability proofs, and the existing publication guard retains its enforcement and token scrubbing. Docker and gateway reachability belong to [run-root-worktree-readiness](../run-root-worktree-readiness/change.md). [Issue #245](https://github.com/xycu/agent-smith/issues/245)

## Implementation Approach

Medium complexity, one phase. Add `initPermissionWarnings` to the shared router's initialization path after selection and isolation validation and before the first existing state write. Use the selected chain's `providersByStep` assignment, including legacy arrays, so split runs can receive both advisories. Reuse Git for metadata resolution and Codex for native config resolution. Send bounded, sanitized advisory text to stderr and keep stdout as the action protocol.

## Phase 1: Warn about provider permissions at init

### Overview

Implement both checks, wire warning presentation into both chain entry points, and verify the CLI contract with deterministic local fixtures.

### Changes Required

#### 1. Shared init hook and Git identity

**Files** `skills/10x-pipeline/scripts/route.mjs`, new `skills/10x-pipeline/scripts/init-permissions.mjs`

**Intent** Give both chains setup advice once per valid invocation of `init`, including resume.

**Contract** Keep `initPermissionWarnings` outside setup and metadata readers. Run it from the actual run root after existing validation. Resolve the absolute Git directory and common directory with the existing bounded Git runner and compare canonical paths. A linked-worktree warning applies only when Git confirms distinct directories, including linked runs with isolation disabled. The shared path comes from Git, including when it differs from a literal checkout-relative `.git`. Failed resolution yields no path assumption. Probes leave configuration, Git metadata and run state untouched. Keep the existing routing, lock, state writes, start commit and exit behavior.

#### 2. Effective Codex permission profile

**Files** `skills/10x-pipeline/scripts/init-permissions.mjs`, shared Codex startup inputs used by `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent** Let Codex resolve its settings from the target worktree. An optional config overlay and a named permission profile serve different purposes.

**Contract** Use the native, model-free `codex sandbox` command with a fixed no-op payload, run-root cwd, runner-compatible token-scrubbed environment and the same optional `-p` selection. For a neutral resume replaying a stored OpenAI action, use its stored overlay for that replay. Use bounded timeout and output, direct argv, and ambient default resolution. An explicit `-P` would override the setting being checked. Match only a recognized Codex failure identifying an undefined `default_permissions` profile or a missing `[permissions]` table. If Codex confirms a missing table without naming the selector, one bounded model-free retry with temporary CLI override `permissions={}` may recover the name. If it cannot, display a clearly marked placeholder and identify the selector to substitute. Missing tooling, unrelated config failures, timeouts and sandbox startup failures remain indeterminate.

Render quoted TOML keys for the profile name and resolved path. The profile extends `:workspace`; its `filesystem` table contains only the targeted common-directory `"write"` entry when the absolute path is known. Escape or substitute unsafe values and keep diagnostics limited to the intended profile and path. Existing runtime preflight and publication-guard behavior remain authoritative. [Codex permission profiles](https://developers.openai.com/codex/permissions/#extend-a-profile)

#### 3. Linked-worktree Claude write-list advisory

**File** `skills/10x-pipeline/scripts/init-permissions.mjs`

**Intent** Point operators at the shared Git metadata location used by local commits and the settings key that can grant access.

**Contract** Inspect the standard user, project and local `sandbox.filesystem.allowWrite` lists read-only. Honor `CLAUDE_CONFIG_DIR` for user settings. Use the worktree project settings and the documented main-checkout location for local settings when Git can locate it, including the worktree-local fallback. Interpret a literal absolute, home-relative or scope-relative directory using Claude's path rules. A canonical exact match or ancestor covers the path. Compare path segments and handle directory separators, trailing slashes and an equivalent trailing `/**`. Missing files are empty inputs. On unreadable or invalid settings or an unsupported pattern that leaves coverage unresolved, use conditional wording or omit the missing-entry diagnosis. A configured rule is evidence about the inspected list. Managed settings, session-added directories, automatic worktree grants, denials and outer sandbox policy affect live capability.

Render the absolute path as a JSON string in a mergeable `sandbox.filesystem.allowWrite` example and direct operators to preserve existing entries. Mention the automatic worktree grant and when the explicit entry helps. [Claude settings scopes](https://code.claude.com/docs/en/settings.md) · [Claude sandbox path prefixes](https://code.claude.com/docs/en/settings-reference.md#sandbox-path-prefixes)

#### 4. Entry points, reference and local coverage

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, `docs/REFERENCE.md`, `skills/10x-pipeline/test/init-permissions.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent** Surface actionable warnings for skill users while protecting existing JSON consumers and keeping runtime semantics documented.

**Contract** Both skill init steps surface advisory stderr alongside the provider summary and parse stdout separately. The reference explains warning scope, tested native diagnostic support and the runtime evidence limits. Use real disposable linked repositories for Git identity, fake Codex for reproducible outputs, fixture-only settings and existing test helpers and cleanup. Index the new test. Keep provider, isolation and publication guard regressions in the normal suite.

### Success Criteria

#### Automated Verification:

- Fake Codex CLI fixtures verify the undefined-profile and missing-table remedies, optional overlay selection, bounded indeterminate cases and token-scrubbed execution from the run root.
- Linked Git fixtures verify canonical common-directory remediation, covered and uncovered Claude settings, scoped path matching, indeterminate settings and silence outside linked worktrees.
- Router CLI fixtures verify provider and chain scoping, warning recomputation on resume, one stdout action JSON object, unchanged routing and exit behavior, and unchanged settings.
- Run the required Node 24 router, OpenSpec and tools test suite and verify the documented stderr contract in both chain skills.

#### Manual Verification:

- In a disposable trusted project, verify the warning and its clearance after applying the snippet with real Codex on the current and documented baseline CLI, recording the versions and any unsupported diagnostic or outer sandbox restriction.
- In a disposable Claude linked worktree, compare the explicit-entry advisory with the session's sandbox configuration and run a sandboxed local Git write, recording whether the host grants access automatically and whether the applicable settings fix clears the advisory.

## Testing Strategy

### Unit Tests

Check diagnostic recognition and escaping through fixture outputs, including valid built-ins or no selector, failures unrelated to permissions, and paths with spaces or quoting characters. Cover scope-relative paths, true ancestors and same-prefix siblings. Use fixtures for user/project/local settings and a malformed input. Use controlled `PATH`, `CODEX_HOME` and `CLAUDE_CONFIG_DIR` to keep provider and user configuration hermetic.

### Integration Tests

Run `node --test --test-concurrency=2 skills/10x-pipeline/test/init-permissions.test.mjs` while iterating. Drive 10x and OpenSpec through real router CLI calls with fake Codex and real scratch Git. Cover provider-exclusive and split routing, a linked worktree with isolation disabled, an invalid init, and a resume after fixture settings change. Compare stdout's parsed action and exit status with healthy fixtures. Assert config bytes and refs are preserved by the checks, allowing for any existing isolated start commit where enabled. At completion run `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` on Node 24 or later. All automated checks run locally before publication.

### Manual Testing Steps

1. With real Codex, use a disposable trusted worktree and test a custom default with and without a permissions table. Run init and inspect stderr. Apply the displayed profile configuration in the correct scope and repeat. Record startup and sandbox compatibility separately from model execution.
2. With real Claude, launch from a disposable linked worktree and compare the warning with `/sandbox` Config. Check whether sandboxed local Git writes work with the implicit grant and whether the explicit setting helps on a host missing that grant. Keep the verification local and record the session settings and version.

## Performance Considerations

Only `init` pays the diagnostic cost. Check applicable providers once per invocation, bound subprocesses and captured output, and reserve the second Codex startup for its confirmed missing-table diagnostic.

## Migration Notes

The change adds advisory stderr output. Existing state, configuration data and action JSON retain their formats, so old runs can resume directly. Reverting the change removes the advisory with no state conversion. Operators control any configuration change prompted by the warning.

## Assumptions

- Use advisory stderr in one implementation phase. The work is shared across both chains, and existing CLI consumers already treat stdout as the action protocol. [Router output](../../../skills/10x-pipeline/scripts/state.mjs#L15) · [CLI test helper](../../../skills/10x-pipeline/test/helpers.mjs#L133)
- Target the providers selected for the run. Split membership and legacy ladders are already available from `providersByStep`. [Provider mapping](../../../skills/10x-pipeline/scripts/state.mjs#L110)
- Treat Claude's absent explicit grant as configuration advice. The host documents implicit worktree writes and merged settings. Codex's exact diagnostics were observed on 0.171.0 and the documented 0.169.0 behavior belongs to live acceptance. [Claude sandboxing](https://code.claude.com/docs/en/sandboxing.md#filesystem-isolation) · [Runner reference](../../../docs/REFERENCE.md#codex-and-provider-dispatch)

## References

- [Change record](change.md) · [Issue #245](https://github.com/xycu/agent-smith/issues/245)
- [Wave 3 ownership](../WAVES.md#wave-3) · [ADR-024](../../../docs/ADR/ADR-024-openai-codex-support.md)
- [Codex configuration](https://developers.openai.com/codex/config-basic/#configuration-precedence) · [Codex permissions](https://developers.openai.com/codex/permissions/)
- [Claude settings](https://code.claude.com/docs/en/settings.md) · [Claude sandboxing](https://code.claude.com/docs/en/sandboxing.md)

## Progress

> Append the closing commit SHA to completed rows. Preserve the row titles.

### Phase 1: Warn about provider permissions at init

#### Automated

- [ ] 1.1 Fake Codex CLI fixtures verify the undefined-profile and missing-table remedies, optional overlay selection, bounded indeterminate cases and token-scrubbed execution from the run root.
- [ ] 1.2 Linked Git fixtures verify canonical common-directory remediation, covered and uncovered Claude settings, scoped path matching, indeterminate settings and silence outside linked worktrees.
- [ ] 1.3 Router CLI fixtures verify provider and chain scoping, warning recomputation on resume, one stdout action JSON object, unchanged routing and exit behavior, and unchanged settings.
- [ ] 1.4 Run the required Node 24 router, OpenSpec and tools test suite and verify the documented stderr contract in both chain skills.

#### Manual

- [ ] 1.5 In a disposable trusted project, verify the warning and its clearance after applying the snippet with real Codex on the current and documented baseline CLI, recording the versions and any unsupported diagnostic or outer sandbox restriction.
- [ ] 1.6 In a disposable Claude linked worktree, compare the explicit-entry advisory with the session's sandbox configuration and run a sandboxed local Git write, recording whether the host grants access automatically and whether the applicable settings fix clears the advisory.
