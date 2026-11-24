---
date: 2026-11-24T00:00:00+01:00
researcher: Claude
git_commit: 79b6cc36bd9a8bbf70c0bc32e782c6d5fc1ab65f
branch: main
repository: agent-smith
topic: "Where and how can init stop treating a missing Claude capture launcher as advisory?"
tags: [research, codebase, init-usage, route, isolation, claude-capture, policy]
status: complete
last_updated: 2026-11-24
last_updated_by: Claude
---

# Research: init gate for missing Claude token capture

**Date**: 2026-11-24
**Git Commit**: 79b6cc36bd9a8bbf70c0bc32e782c6d5fc1ab65f
**Branch**: main (change folder is untracked)
**Repository**: agent-smith

## Research Question

`frame.md` says `init` detects an unbound Claude session but only warns. Which code decides that, which existing pattern can halt instead, and what else the change touches (cases that cannot be satisfied, tests, policy validation, docs, ADRs).

## Summary

- On the inspected `init` path (`route.mjs:1134`), `initUsageWarning` writes one stderr line and returns nothing, so no capture state can stop the run.
- `claudeCaptureReadiness()` returns `disabled`, `unusable` or `ready` (`claude-capture-data.mjs:102-113`). `claudeWarning` turns the first two into messages (`init-usage.mjs:53-58`).
- A halting precedent exists: `isolation.require` (policy.json:118-119) is read by `isolationOn` (`isolation.mjs:289`) and checked by `isolationCheck` before any write (`route.mjs:1132`). Its halt text names the opt-out as a policy snippet (`isolation.mjs:286`).
- A gate on "readiness is not `ready`" would halt runs that cannot be fixed: the `host === "codex"` Claude case (headless Claude on Codex) always returns a duration-only message (`init-usage.mjs:40-43`), and a Claude child session sets `AGENT_SMITH_CLAUDE_SESSION`, which makes readiness `disabled` (`claude-capture-data.mjs:104`). The gate must only cover a native Claude host.
- Every test project is created with `isolation.require: false` injected by `helpers.mjs:95`; a capture gate defaulting on needs the same injection or the suite's `init` calls halt.

## Detailed Findings

### Detection and warning (what exists)

- `claudeCaptureReadiness(env)` returns `"disabled"` when `CAPTURE_ENV` is unset or `AGENT_SMITH_CLAUDE_SESSION` is set; `"ready"` when binding, both source files and `assertCaptureAvailable` pass; otherwise `"unusable"` (`claude-capture-data.mjs:102-113`).
- `claudeWarning(host)` (`init-usage.mjs:39-60`): for `host === "codex"` it returns the duration-only message and never probes readiness; for other hosts it maps `disabled` and `unusable` to messages, `ready` to `null`.
- `initUsageWarning(policy, selection, neutralReplay)` (`init-usage.mjs:62-76`) collects Claude and OpenAI warnings by assigned provider, writes `Warning: Usage capture preflight. ... See docs/REFERENCE.md#accounting-activation-and-rollback.` to fd 2, and swallows a write failure.
- The one call site is `route.mjs:1134`, after `isolationCheck` (`route.mjs:1132`) and `initPermissionWarnings` (`route.mjs:1133`), before `cleanupStateTemps`, `mkdirSync` and the meta write (`route.mjs:1135-1138`). Nothing has been written at that point.
- Tests assert the warning only (`init-usage.test.mjs:117-130`, `:176-186`); `init` still returns `action: "run"` in those cases (`:245`, `:286`, `:302`).

### Precedent for a halting gate

- `isolation` block: `require: true`, plus branch settings (`policy.json:118-126`). `isolationOn` is true only for the boolean `true` (`isolation.mjs:289`).
- `isolationCheck` calls `halt(... "Nothing was written.")` on each failure, and each message tells how to opt out via `{ "isolation": { "require": false } }` in `context/foundation/agent-smith-policy.json` (`isolation.mjs:286-318`).
- It runs only when `isolationOn(policy)`; otherwise `branch` is `null` (`route.mjs:1132`).
- Policy is validated at load for `init`, `next` and `usage` by `policyProblems` before any write (`ADR-022`, `route.mjs:808`, `route.mjs:1040`). A new policy key needs a validation rule there.
- Flags precedent: `--archive`, `--chrome`, `--pr-comment` accept bare/`true`/`false`, checked before writes, and `init` halts on unknown flags (`route.mjs:1012 and the checks before it`). `INIT_FLAGS` lists accepted flags.

### Cases a gate cannot satisfy

- **Claude steps on a Codex host.** `claudeWarning("codex")` returns a message that no launcher can clear: headless Claude records duration only (`init-usage.mjs:40-43`, `docs/REFERENCE.md:501`). The gate must not halt on it.
- **Headless child.** `AGENT_SMITH_CLAUDE_SESSION` forces `disabled` (`claude-capture-data.mjs:104`). That is the child runner's env (`run-claude.mjs:316`), not the orchestrator `init` runs in, so it does not affect the orchestrator, but a test that sets it (`init-usage.test.mjs:186`) must keep returning a warning-only path or opt out.
- **Neutral replay.** `initUsageWarning` evaluates only the saved dispatch's provider when `neutralReplay` is set (`init-usage.mjs:62-64`). A gate on a replay of an OpenAI step must not require a Claude launcher.
- **Resume.** The docs already say to start a fresh launcher session and resume with the saved host and provider mode (`docs/REFERENCE.md:501`, `init-usage.mjs:40-43`); `init` is resumable and `host`/`providerMode` are stored (`route.mjs:1105`). A halt before any write leaves state unchanged, so relaunch plus resume works.

### Version gate

`claudeCaptureSupported` accepts any `x.y.z` at or above `CLAUDE_CAPTURE_MIN_VERSION = "2.1.311"` (`claude-capture-data.mjs:21-28`); the launcher and collector call it (`claude-capture.mjs:74`, `claude-usage.mjs:108`). ADR-018 Amendment 6 records the floor. The "exact version" wording in the archived `change.md` is out of date.

### Other readers and touchpoints

- Docs: `docs/REFERENCE.md:26`, `:68` ("off by default"), `:501`, `:507` (off instructions), README "Observed token coverage" (`README.md:154-158`, "The run can continue", "Ordinary `claude` starts with capture off").
- ADRs: ADR-018 Amendment 5 (opt-in native capture) and ADR-019 Amendment 2 (late intake from opt-in capture).
- `SKILL.md` step 4 runs `init` and reads its JSON output; a halt is the existing `{ action: "halt" }` shape handled by the loop. The openspec skill shares the router.
- Both skills' `## Anti-stall rules` sections must stay equal if SKILL text changes (AGENTS.md).

## Code References

- `skills/10x-pipeline/scripts/init-usage.mjs:39-76` - `claudeWarning`, `initUsageWarning`
- `skills/10x-pipeline/scripts/route.mjs:1132-1134` - isolation check, permission warnings, usage warning
- `skills/10x-pipeline/scripts/isolation.mjs:286-318` - `isolationOn`, `isolationCheck` halts
- `skills/10x-pipeline/scripts/claude-capture-data.mjs:21-28,102-113` - version floor, readiness
- `skills/10x-pipeline/policy.json:118-126` - `isolation` block
- `skills/10x-pipeline/test/helpers.mjs:86-95` - test policy injection for isolation
- `skills/10x-pipeline/test/init-usage.test.mjs:117-330` - current warning tests

## Architecture Insights

- Router decisions belong in `route.mjs` and its modules plus `policy.json` (AGENTS.md); a gate lives next to `isolationCheck`, with its policy block in `policy.json` and overrides in `agent-smith-policy.json`.
- `init-usage.mjs` imports only from `state.mjs` and `codex-startup.mjs`; the module order rule says `route.mjs` keeps `init`, so the halt decision either stays in `route.mjs` or `initUsageWarning` returns a structured result.

## Historical Context (from prior changes)

- `context/archive/2026-11-19-claude-token-figures-default/frame.md` - owner decision (2026-11-21): opt-in hook, no capture by default. This change overturns it (the owner's decision of 2026-11-24 in `change.md`).
- `context/changes/usage-capture-preflight/change.md` - issue #232; the optional `--require-usage` flag was deliberately out of scope; this change builds the strict mode on its warning.
- `context/changes/usage-capture-preflight/plan-brief.md` - "One advisory per eligible init, including resumes".

## Related Research

None applicable.

## Open Questions

1. Opt-out surface: a policy block (`usageCapture: { require }`, default true, project override) like `isolation`, a per-run flag, or both.
2. Should the Codex floor check (`codexWarning`) halt when the CLI is missing or below 0.169.0, or stay a warning.
3. Policy key placement and `provenance.ignore` (`policy.json:101`): does the new key change the provenance hash, as `coAuthor` is ignored.
4. Test strategy: inject `{ usageCapture: { require: false } }` in `helpers.mjs` like isolation, and keep `init-usage.test.mjs` cases that assert the warning.
