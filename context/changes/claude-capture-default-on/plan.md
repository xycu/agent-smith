# Claude capture default-on gate Implementation Plan

## Overview

A native Claude-hosted run whose token capture is not ready today starts anyway, with one stderr line, and ends with `-` and `capture-disabled` for every step. This plan makes `init` halt in that case, before anything is written, naming the launcher command and how to resume. A new policy block `claudeCapture.require` (default `true`, opt-out in `context/foundation/agent-smith-policy.json`, validated at load) is modelled on `isolation.require`. Codex stays a warning. Version-range work is out of scope: `claudeCaptureSupported` is already a floor.

## Current State Analysis

- `claudeCaptureReadiness()` returns `disabled`, `unusable` or `ready` (`skills/10x-pipeline/scripts/claude-capture-data.mjs:102-113`). `disabled` also covers a set `AGENT_SMITH_CLAUDE_SESSION`, the env of a headless Claude child.
- `claudeWarning(host)` in `skills/10x-pipeline/scripts/init-usage.mjs:39-60` maps the readiness to a message; for `host === "codex"` it returns a duration-only message and never probes. `initUsageWarning` (`:62-76`) writes one `Warning: Usage capture preflight.` line to fd 2 and returns nothing.
- The only call site is `skills/10x-pipeline/scripts/route.mjs:1134`, after `isolationCheck` (`:1132`) and `initPermissionWarnings` (`:1133`), before `cleanupStateTemps` and the first write (`:1135-1138`).
- `isolationOn(policy)` / `isolationCheck` (`skills/10x-pipeline/scripts/isolation.mjs:286-318`) is the halting precedent: policy block `isolation.require` in `skills/10x-pipeline/policy.json:118-119`, halt text that names the opt-out as a JSON snippet, "Nothing was written."
- Policy is validated for `init`, `next` and `usage` by `policyProblems` (`skills/10x-pipeline/scripts/state.mjs:219`, called at `route.mjs:1040`) before any write; `isolation` itself is not validated there (a block of another shape reads as off). A default-on gate must not read a typo such as `"require": "false"` as on or off silently, so the new block is validated.
- Test projects get `isolation.require: false` injected by `writeOverride` (`skills/10x-pipeline/test/helpers.mjs:94-95`). Several tests overwrite the override file directly with only the isolation opt-out (for example `skills/10x-pipeline/test/compare.test.mjs:754`, `prepare-run.test.mjs:39,86,172`, `score.test.mjs:223,229`, `prompt-handoff.test.mjs:472`) and would halt at `init` once the gate defaults on.
- Docs and ADRs that say "opt-in" or "the run can continue": `docs/REFERENCE.md` (the preflight sentence near line 26, the accounting paragraph near line 68, "Accounting activation and rollback" near line 495-507), README "Observed token coverage" (`README.md:154-165`), ADR-018 Amendment 5 and ADR-019 Amendment 2.

## Desired End State

- `init` on a native Claude host (host `claude`, at least one Claude-assigned step or a Claude neutral replay, no `AGENT_SMITH_CLAUDE_SESSION`) with readiness `disabled` or `unusable` and `claudeCapture.require` true returns `{ action: "halt", reason }` with exit status 1 and writes nothing. The reason names the cause (off or unavailable), the exact launcher command with the plugin's absolute `claude-capture.mjs` path, how to resume (start the launcher session outside Claude Code, then run the same pipeline command again with the same change id and the same flags: a first `init` halts before anything is stored, so nothing is saved yet; a run that already has a `meta.json` resumes with its saved host and provider mode), and the opt-out snippet.
- Readiness `ready` passes with no warning. With the opt-out, behaviour is exactly today's: the stderr advisory and a run.
- Never halts for: Claude steps on a Codex host, a set `AGENT_SMITH_CLAUDE_SESSION`, or a neutral replay of a non-Claude step. The OpenAI/Codex floor check stays a warning in every case.
- A malformed `claudeCapture` block halts at `init`, `next` and `usage` with a message naming the key and the override file.
- Verify: the new and existing tests below pass; `docs/REFERENCE.md`, README and ADR-018/019 describe the default-on behavior.

### Key Discoveries:

- A halt before any write leaves state untouched. A run that already has a `meta.json` is resumable with its stored `host` and `providerMode` (`route.mjs:1105`); a first `init` stores nothing before the halt, so the repeated command must carry the same flags (`--goal`, `--provider-mode`, `--host`). Relaunch plus a repeated `init` is the resume path in both cases; no new resume mechanism is needed.
- The launcher refuses to start inside Claude Code (`claude-capture.mjs` settings preflight rejects `CLAUDECODE`), so the halt text must say to start it from a terminal, not from the current session.
- `init-usage.mjs` may import only from `state.mjs` and `codex-startup.mjs` (AGENTS.md module order); `route.mjs` keeps `init`. The gate function lives in `init-usage.mjs` and returns a message; `route.mjs` halts.
- `policyProblems` returns the first fault and never halts; `main()` halts for `init`, `next` and `usage` (`route.mjs:1038-1042`).
- Provenance hashes every policy section not listed in `provenance.ignore`; `isolation` is hashed. The new block follows that precedent: it is hashed, `provenance.ignore` is unchanged, and `provenance.test.mjs` derives its expected section list from the shipped policy keys.

## What We're NOT Doing

- No per-run flag. The opt-out is the policy key only (the task says to model it on `isolation.require`).
- No Codex halt. `codexWarning` stays an advisory; the Codex floor check does not join the gate.
- No version-range work: `claudeCaptureSupported` already accepts any release at or above `CLAUDE_CAPTURE_MIN_VERSION`.
- No attempt to relaunch the host, set telemetry env or edit user settings; the plugin still enables no telemetry on its own.
- No halt at `next` for a missing capture (isolation has such a guard; capture does not, since each step is already bound to the init check and a resume repeats `init`).
- No halt when readiness cannot be determined (the capture module fails to import): that case stays the existing "could not check" warning, because a definite loss of figures is not proven.
- No change to `SKILL.md` files (the loop already relays a `halt` reason) and none to the anti-stall rules, so the two skills' sections stay equal.
- No change to `usage.mjs` reason texts (`capture-disabled` remains correct for opted-out and headless entries).
- No ADR-022 amendment; the validation is described in `docs/REFERENCE.md`.

## Implementation Approach

Two phases. Phase 1 adds the policy block, its validation, the gate function, the `route.mjs` wiring and the tests, together with the test-helper opt-out so the suite stays green. Phase 2 updates the docs and the two ADR amendments. The halt message is built in `init-usage.mjs` from the existing readiness result, so the off/unavailable wording of the advisory and of the halt cannot drift.

Assumptions (decided from codebase evidence, no human available):

- Block name `claudeCapture` rather than `usageCapture`: the gate covers Claude only and Codex stays a warning. Shape `{ "require": true }`.
- Isolation order: `isolationCheck` runs first (a main-checkout halt needs no relaunch), then the capture gate, then the permission and usage warnings.
- The hashed (not ignored) provenance section follows `isolation` and avoids touching five docs and tests; revisit only if an owner wants arms compared across the opt-out.

## Phase 1: Policy block, gate and tests

### Overview

Ship the default-on gate end to end in code, with the test suite opted out by default and new tests for both states.

### Changes Required:

#### 1. Policy default

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Ship the gate on by default, next to `isolation`.

**Contract**: new top-level block `"claudeCapture": { "require": true }`. No other key.

#### 2. Validation at load

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: A default-on gate must not misread a wrong type, so `policyProblems` checks the block and halts `init`, `next` and `usage` with the existing `bad(...)` message shape.

**Contract**: after the existing checks and before `return null`, if `p.claudeCapture !== undefined` it must be an object (`bad("claudeCapture", "an object", ...)`) and `p.claudeCapture.require` must be a boolean (`bad("claudeCapture.require", "a boolean", ...)`); the missing-`require` case is accepted (reads as the shipped default through the merge). Update the "checked in a fixed order" comment to name the new check as last.

#### 3. Gate function

**File**: `skills/10x-pipeline/scripts/init-usage.mjs`

**Intent**: Return the halt reason for a native Claude host whose capture is definitely not ready, or `null`. Reuse one readiness helper for both this gate and `claudeWarning` so both read the same result.

**Contract**: `export async function claudeCaptureStop(policy, selection, neutralReplay, id, chain)` returns `string | null`.

- `null` when `policy.claudeCapture?.require !== true`.
- `null` when `hostOf(selection) !== "claude"`.
- `null` when `process.env.AGENT_SMITH_CLAUDE_SESSION` is set (headless child).
- `null` when Claude is not an assigned provider: use the same set as `initUsageWarning` (`neutralReplay ? providerOf(neutralReplay) : providersByStep(policy, selection)`), so a neutral replay of a non-Claude step never halts.
- `null` when readiness is `ready`, or cannot be determined (import failure): the existing warning path reports that.
- Otherwise the reason, in this order: cause sentence (off in this session, or launcher capture unavailable, reusing the existing wording), the launcher command ``node "<SKILL_DIR>/scripts/claude-capture.mjs"`` with the absolute path from `SKILL_DIR` (`state.mjs`), "run it from a terminal outside Claude Code in the project root", the resume sentence ("then run `/agent-smith:<10x|openspec>-pipeline <id>` again in that session with the same flags; a run that already has steps resumes with its saved host and provider mode"), the opt-out `{ "claudeCapture": { "require": false } } in context/foundation/agent-smith-policy.json`, and the closing "Nothing was written." Keep it one paragraph without the tilde or relative paths.

Refactor `claudeWarning` to call a small shared `claudeReadiness()` that returns `"ready" | "disabled" | "unusable" | "unknown"`; messages and tests of the warning stay as they are.

#### 4. Wiring

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Run the gate next to `isolationCheck`, before the permission and usage warnings and before any write.

**Contract**: import `claudeCaptureStop`; right after the `const branch = ...isolationCheck...` line (`:1132`) add `const captureStop = await claudeCaptureStop(policy, selection, neutralReplay, id, chain); if (captureStop) halt(captureStop);`. Update the comment above (`:1129`) to mention the capture gate.

#### 5. Test helper opt-out

**File**: `skills/10x-pipeline/test/helpers.mjs`

**Intent**: Every scratch project opts out of the gate unless it states its own block, as with `isolation` and `manualVerify`.

**Contract**: in `writeOverride`, `if (!Object.hasOwn(value, "claudeCapture")) value = { ...value, claudeCapture: { require: false } };`, and extend the comment above the function. The helper's output is asserted exactly in `skills/10x-pipeline/test/score.test.mjs:131-152` (`readOverride` `deepEqual`, five expectations that list `score`, `isolation`, `manualVerify`); add `claudeCapture: { require: false }` to each. Update the `helpers.mjs` sentence in `skills/10x-pipeline/test/README.md:119` that lists the injected keys.

#### 6. Direct override writers

**Files**: tests that overwrite or create the override file without `writeOverride`: `skills/10x-pipeline/test/compare.test.mjs` (`copiedOverride`), `prepare-run.test.mjs` (`override` helper and the writes at the lines that set only `isolation`), `score.test.mjs` (the `ISOLATION_OFF` writes), `prompt-handoff.test.mjs` (`fixtureDefaults`), `isolation.test.mjs` (the full override rewrite at `:311`, followed by an `initIn` that expects `run`; the rewrites at `:285-296` expect halts before the capture gate and stay as they are), and any other file the full-suite run shows halting at `init` with the capture reason.

**Intent**: Keep their `init` calls on the old path by adding `claudeCapture: { require: false }` beside the isolation opt-out. Find the rest with `grep -rn "isolation: { require: false }\|ISOLATION_OFF" skills tools` and a full-suite run.

**Contract**: no behavior change; each fixture keeps its meaning. Tests that assert a policy file's exact bytes or keys (for example `prepare-run.test.mjs` cases that list override values) keep their expectations by adding the key only where `init` is run.

#### 7. New and extended tests

**File**: `skills/10x-pipeline/test/init-usage.test.mjs` (extend; no new file, so the test README row only needs its description widened)

**Intent**: Cover both states and the cases that must never halt.

**Contract**: a `haltInit` helper next to `init` that asserts exit status 1, `action: "halt"`, and returns the reason. With project policy `{ claudeCapture: { require: true } }`, for both chains:

- not ready, off (`CAPTURE_ENV` empty): halt reason matches the off wording, contains the quoted absolute launcher path ending `scripts/claude-capture.mjs`, the resume sentence with the project id and the right skill name for the chain, the opt-out snippet, and ends "Nothing was written."; the change directory holds no `agent-smith/` state afterwards.
- not ready, unusable (a damaged launcher binding from the existing `capture` fixture): halt with the unavailable wording.
- ready (`capture(project)` root): `init` returns `run`, no warning; a repeat after the halt on the same project (relaunch plus resume) succeeds.
- opt-out (`require: false`): runs with the existing advisory.
- no halt with `require: true` for: `--host codex --provider-mode split` (headless Claude on Codex, advisory kept); `AGENT_SMITH_CLAUDE_SESSION=headless` set; `--provider-mode codex` on a Claude host with a Codex CLI below the floor (advisory kept, no halt); a neutral replay of an OpenAI step on a Claude host (reuses the seeded-run pattern of the neutral replay test). A neutral replay of a Claude step on a Claude host that is not ready halts.

**File**: `skills/10x-pipeline/test/policy-validate.test.mjs`

**Intent**: The new key follows the existing case table.

**Contract**: add `"claudeCapture is a string": [{ claudeCapture: "x" }, "claudeCapture"]` and `"claudeCapture.require is a string": [{ claudeCapture: { require: "false" } }, "claudeCapture.require"]` to `CASES`, and one assertion that the shipped `policy.json` ships `claudeCapture.require === true` and passes `policyProblems`. `assertHalt` expects `policy.<key> must be`, which the new messages follow; add no new helper.

### Success Criteria:

#### Automated Verification:

- Gate and warning tests pass on both chains: `node --test --test-concurrency=2 skills/10x-pipeline/test/init-usage.test.mjs`
- Policy validation tests pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/policy-validate.test.mjs skills/10x-pipeline/test/provenance.test.mjs`
- Tests that write the override directly still reach `run` at init: `node --test --test-concurrency=2 skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/score.test.mjs skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs skills/10x-pipeline/test/isolation.test.mjs`
- A grep finds no scratch override that sets `isolation` off without a `claudeCapture` key where the test then runs `init`: `grep -rn "isolation: { require: false }" skills tools` reviewed against the test list above
- Full suite has no new failure: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Smoke check halts as designed in a scratch project with only the isolation opt-out and no capture binding: `init <id> --goal "x"` returns `action: "halt"` with the launcher path, and the same call with `{ "claudeCapture": { "require": false } }` returns `action: "run"`

#### Manual Verification:

- From plain `claude` (no launcher), `init` halts with a command the owner can paste; from the launcher session the same `/agent-smith:10x-pipeline <id>` resumes the run and its steps show figures.
- The halt text reads clearly in the orchestrator's output (cause, command, resume, opt-out).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; the corresponding `- [ ]` checkboxes live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Docs and ADR amendments

### Overview

Make the documents say what the router now does, and record the decision that overturns the 2026-11-21 opt-in choice.

### Changes Required:

#### 1. Reference

**File**: `docs/REFERENCE.md`

**Intent**: Replace "advisory, the run can continue" and "off by default" with the default-on gate, and document the policy block.

**Contract**: update (a) the sentence near line 26 about the independent usage capture preflight, (b) the accounting paragraph near line 68 ("Native Agent token capture is off by default"), (c) "Accounting activation and rollback": the opening paragraph (advisory for Codex and for the opt-out; halt for a native Claude host), the native Claude bullet, the launcher paragraph (halt text, resume), and the "To turn capture off" paragraph (now the `claudeCapture.require: false` opt-out plus ordinary `claude`), (d) add a short bullet list or sentence naming `claudeCapture.require` (ships `true`, strict boolean validated at load, hashed by provenance like `isolation`), the exempt cases (Codex host, `AGENT_SMITH_CLAUDE_SESSION`, neutral replay of a non-Claude step, undeterminable readiness), and the release note (a Claude-hosted run started in an ordinary session now halts at `init`; ships as a breaking change decision for the owner). Then grep every doc for the old wording per lessons.md: `grep -rn "off by default\|capture off\|run can continue\|opt in\|opt-in" README.md docs skills --include='*.md'` (quote the glob: an unquoted `*.md` aborts the command in zsh), and fix each hit that describes the Claude default.

#### 2. README

**File**: `README.md`

**Intent**: The coverage paragraph (`README.md:154-165`) says the default is now the launcher.

**Contract**: replace "The run can continue" and "Ordinary `claude` starts with capture off. To opt in..." with: init halts on a native Claude host when capture is not ready, the launcher command stays, resume by repeating the same command with the same flags in the launcher session (a run with steps keeps its saved host and provider mode), and the one-line opt-out. Keep the Codex advisory sentence and the `--versions` note.

#### 3. ADR amendments

**Files**: `docs/ADR/ADR-018-no-nested-subagents.md`, `docs/ADR/ADR-019-late-usage-figure.md`, `docs/ADR/README.md`

**Intent**: Update the `Status` line of ADR-018 ("as amended through opt-in native capture", line 3, with its `#amendment-5--opt-in-claude-native-capture` link) to name the default-on amendment too, and the ADR-019 status line if it names opt-in capture. Record that Amendment 5 (opt-in native capture) and ADR-019 Amendment 2 (late intake from opt-in capture) are superseded on the default, not on the mechanism.

**Contract**: ADR-018 `## Amendment 8 — Claude capture expected by default` (date 2026-11-24, change `claude-capture-default-on`): launcher-based capture is unchanged; the default moves from opt-in to expected; `init` halts on a native Claude host when readiness is not `ready` unless `claudeCapture.require` is false; exempt cases; Codex remains a warning; the version floor of Amendment 6 is unchanged; the opt-in decision of `context/archive/2026-11-19-claude-token-figures-default/frame.md` (2026-11-21) is overturned by the owner's decision of 2026-11-24. ADR-019 `## Amendment 3 — Default-on capture and late intake`: late intake still needs a bound launcher capture or authorized sources; default-off entries now arise only from the opt-out, a headless child or a replay of a non-Claude step. Append "Amendment 8 (2026-11-24)" and "Amendment 3 (2026-11-24)" mentions to the ADR-018 and ADR-019 index rows in `docs/ADR/README.md` in the same style as the ADR-024 row. Do not edit `context/archive/`.

#### 4. Test index

**File**: `skills/10x-pipeline/test/README.md`

**Intent**: Keep the index accurate.

**Contract**: widen the `init-usage.test.mjs` row to mention the halting gate, and the `policy-validate.test.mjs` row to mention `claudeCapture`.

### Success Criteria:

#### Automated Verification:

- No doc still calls Claude capture off by default: `grep -rn "off by default\|The run can continue\|starts with capture off" README.md docs skills --include='*.md'` returns nothing that describes the Claude default
- Both skills' anti-stall sections are unchanged and equal: `node --test --test-concurrency=2 skills/10x-pipeline/test/skill-loop.test.mjs`
- Docs-referencing tests and the version check still pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/init-usage.test.mjs skills/10x-pipeline/test/policy-validate.test.mjs && node tools/version-check.mjs`
- Commit subjects lint: `node tools/commit-lint.mjs main..HEAD`

#### Manual Verification:

- The owner reads the README coverage paragraph and the ADR-018/019 amendments and confirms they state the 2026-11-24 decision.
- The owner decides the release type (breaking `feat!` as for `isolation.require`, or not) when the run PR title is derived.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- Gate truth table in `init-usage.test.mjs`: not ready off, not ready unusable, ready, opt-out, Codex host, headless env, non-Claude neutral replay, Claude neutral replay not ready.
- Policy validation cases for a wrong type of `claudeCapture` and `claudeCapture.require`.

### Integration Tests:

- `init` through the real router CLI on both chains: halt writes nothing, repeat with a ready binding resumes and returns `run`.
- Existing suites that run `init` against overridden policy files keep passing with the injected opt-out.

### Manual Testing Steps:

1. In the project, start plain `claude`, run `/agent-smith:10x-pipeline <id>`: expect the halt with the launcher command.
2. Exit, run the printed command from a terminal, run the same pipeline command: expect `run` and, after steps, verified figures in `status <id>`.
3. Set `{ "claudeCapture": { "require": false } }` in the override and run from plain `claude`: expect the old advisory and a run.

## Performance Considerations

The gate adds one readiness probe (file stats) at `init`, and a second one in the ready case through the warning path. No model or network call.

## Migration Notes

A Claude-hosted run started or resumed from an ordinary `claude` session now halts at `init` until the launcher session or the opt-out is used. A halt writes nothing: a first `init` is repeated with the same flags, and a run that already has steps resumes with its saved host and provider mode. The worktree created by `prepare-run.mjs` stays; the resume reattaches to it. Runs already executing in a launcher session are unaffected. The new hashed `claudeCapture` section adds `claudeCapture` to `provenance.drift` of a run started before the upgrade at its first resume (`recordDrift`, `isolation.mjs:157`); that only feeds `compare` warnings, as when `isolation` was added.

## References

- Frame: `context/changes/claude-capture-default-on/frame.md`
- Related research: `context/changes/claude-capture-default-on/research.md`
- Halting precedent: `skills/10x-pipeline/scripts/isolation.mjs:286-318`, `skills/10x-pipeline/policy.json:118-126`
- Current warning: `skills/10x-pipeline/scripts/init-usage.mjs:39-76`, `skills/10x-pipeline/scripts/route.mjs:1132-1134`
- Prior decision overturned: `context/archive/2026-11-19-claude-token-figures-default/frame.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Policy block, gate and tests

#### Automated

- [x] 1.1 Gate and warning tests pass on both chains: `node --test --test-concurrency=2 skills/10x-pipeline/test/init-usage.test.mjs`
- [x] 1.2 Policy validation and provenance tests pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/policy-validate.test.mjs skills/10x-pipeline/test/provenance.test.mjs`
- [x] 1.3 Tests that write the override directly still reach run at init: compare, score, prepare-run, prompt-handoff and isolation test files
- [x] 1.4 No scratch override sets isolation off without a claudeCapture key where the test then runs init
- [x] 1.5 Full suite has no new failure: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 1.6 Smoke check in a scratch project halts without a capture binding and runs with the opt-out

#### Manual

- [ ] 1.7 From plain claude, init halts with a pasteable launcher command, and the launcher session resumes the run with figures
- [ ] 1.8 The halt text reads clearly in the orchestrator output

### Phase 2: Docs and ADR amendments

#### Automated

- [x] 2.1 No doc still calls Claude capture off by default
- [x] 2.2 Anti-stall sections of both skills stay equal: `node --test --test-concurrency=2 skills/10x-pipeline/test/skill-loop.test.mjs`
- [x] 2.3 Init-usage and policy-validate tests and the version check still pass
- [x] 2.4 Commit subjects lint: `node tools/commit-lint.mjs main..HEAD`

#### Manual

- [ ] 2.5 The owner confirms the README paragraph and ADR-018 and ADR-019 amendments state the 2026-11-24 decision
- [ ] 2.6 The owner decides the release type when the run PR title is derived
