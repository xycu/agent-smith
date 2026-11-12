# Skill directory variable for script paths Implementation Plan

## Overview

Replace the prose placeholder `<this skill's base directory>` in both `SKILL.md` files with the documented Claude Code substitution `${CLAUDE_SKILL_DIR}`, so the orchestrator never works out where the plugin is installed. Update the content tests that pin these lines, state the minimum Claude Code version in the README, and leave one Manual row for a live run of an installed plugin.

## Current State Analysis

- `skills/10x-pipeline/SKILL.md:25-27` names `ROUTER`, `PR_COMMENT` and `OPEN_PR` as `<this skill's base directory>/scripts/...`; `:132` names `<this skill's base directory>/policy.json` in `## Tuning`.
- `skills/openspec-pipeline/SKILL.md:28-30` does the same through `<this skill's base directory>/../10x-pipeline/scripts/...`; `:141` names `<this skill's base directory>/../10x-pipeline/policy.json` in `## Tuning`.
- Pinned by tests: `skills/10x-pipeline/test/skill-loop.test.mjs:92` (OPEN_PR line, 10x), `skills/10x-pipeline/test/openspec-skill.test.mjs:79` (ROUTER), `:82` (PR_COMMENT), `:155` (OPEN_PR). `pr-comment.test.mjs:715` only checks `PR_COMMENT=` is present, so it keeps passing.
- Not affected: `agents.test.mjs:303-316` and `provenance.test.mjs:64-67` copy the plugin tree and spawn the copy's `route.mjs`; neither reads SKILL.md text. Provenance hashes policy sections, prompts and `agents/`, not SKILL.md.
- The SKILL.md loop writes `node $ROUTER ...`; `$ROUTER` is prose notation for the path, not a shell variable that persists. The PR script steps already say "Quote the script path ... for the shell" (`10x SKILL.md:96,109`; openspec `:104,117`). The `ROUTER` line has no quote instruction today.
- README has no requirements section and no Claude Code version statement. The per-call `effort` parameter of the Agent tool is the other version-bound feature (the Agent call in the loop passes `effort`).

## Desired End State

Both SKILL.md files name every script path through `${CLAUDE_SKILL_DIR}`; no `<this skill's base directory>` remains in either `SKILL.md` or in docs. The two content tests name the old placeholder only to assert its absence, and fail if it returns. The README states the minimum Claude Code version. A live run of an installed plugin confirms the substituted path is the plugin cache path and the router starts.

### Key Discoveries:

- Claude Code changelog (`anthropics/claude-code` CHANGELOG.md, read 2026-11-12): `${CLAUDE_SKILL_DIR}` was added in 2.1.69 ("Added `${CLAUDE_SKILL_DIR}` variable for skills to reference their own directory in SKILL.md content"). The `effort` parameter of the Agent tool was added in 2.1.292 ("Added an `effort` parameter to the Agent tool"). The README minimum is therefore 2.1.292, the higher of the two.
- The openspec skill reaches the shared router through `${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts`; the existing test already checks that the target files exist relative to `skills/openspec-pipeline`.
- The substitution applies to the skill's markdown content (documented, skills page), so the pinned lines carry the literal text `${CLAUDE_SKILL_DIR}` in the file; tests match that literal text.

## What We're NOT Doing

- Narrowing `allowed-tools: Bash` to the scripts (change.md: out of scope; the orchestrator also runs git).
- Changing router, policy, prompts or `docs/REFERENCE.md` routing text.
- Using `${CLAUDE_PLUGIN_ROOT}` (not the documented skill-content variable).
- Adding a fallback to the old placeholder for Claude Code below 2.1.69; the README minimum covers it.
- Editing `context/archive/` or any `run.jsonl`/`meta.json`.

## Implementation Approach

One phase for the SKILL.md files and the tests that pin them (they must change together or the suite fails), one for the README minimum version, one for full verification and the live run. The edit is textual; keep line shapes (`Router: ...`, `PR comment script: ...`, `Pull request script: ...`) so tests keep finding lines by prefix.

## Phase 1: SKILL.md files and their content tests

### Overview

Swap the placeholder for `${CLAUDE_SKILL_DIR}` in both skills and re-pin the tests.

### Changes Required:

#### 1. 10x skill

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Name the three scripts and the `policy.json` in Tuning through `${CLAUDE_SKILL_DIR}` so Claude Code substitutes the real directory. Add a short note on the `Router:` line that the path is quoted for the shell, as the PR script steps already say.

**Contract**: Lines 25-27 become `Router: \`ROUTER="${CLAUDE_SKILL_DIR}/scripts/route.mjs"\`. ...`, `PR comment script: \`PR_COMMENT="${CLAUDE_SKILL_DIR}/scripts/pr-comment.mjs"\`. ...`, `Pull request script: \`OPEN_PR="${CLAUDE_SKILL_DIR}/scripts/open-pr.mjs"\`. ...`; the first sentence of each line (and the "Only the ... step runs it" tails) stay. Tuning (line 132): `${CLAUDE_SKILL_DIR}/policy.json holds the defaults ...` in backticks. The `Router:` line ends with "When you put the path in a command, quote it for the shell." (the loop's `node $ROUTER` calls stay as they are, so the note must tell the orchestrator to quote when it substitutes the path) Do not touch the `## Anti-stall rules` section or any `node $ROUTER` call (tests pin those).

#### 2. OpenSpec skill

**File**: `skills/openspec-pipeline/SKILL.md`

**Intent**: Same swap, reaching the shared files through `${CLAUDE_SKILL_DIR}/../10x-pipeline/...`.

**Contract**: Lines 28-30 become `ROUTER="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/route.mjs"`, `PR_COMMENT="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/pr-comment.mjs"`, `OPEN_PR="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/open-pr.mjs"`; Tuning (line 141): `${CLAUDE_SKILL_DIR}/../10x-pipeline/policy.json`. Same quote note on the `Router:` line. The skill must stay free of model, effort and tier words beyond the 10x skill (AGENTS.md hard rule).

#### 3. Content tests

**Files**: `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/openspec-skill.test.mjs`

**Intent**: Pin the new lines and forbid the old placeholder, for the ROUTER, PR_COMMENT, OPEN_PR and Tuning paths of each skill.

**Contract**: In `skill-loop.test.mjs` update the OPEN_PR assertion (`:92`) to ``OPEN_PR="${CLAUDE_SKILL_DIR}/scripts/open-pr.mjs"``, and add tests that (a) the whole file contains no `<this skill's base directory>`; (b) the `Router:`, `PR comment script:` and `OPEN_PR` lines and the Tuning `policy.json` bullet each include a path starting `${CLAUDE_SKILL_DIR}/` (use the literal string, not a template literal: write `"${CLAUDE_SKILL_DIR}"` in a normal quoted string or escape the `$`). In `openspec-skill.test.mjs` update `:79`, `:82`, `:155` to the `${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/...` forms and add the same no-placeholder and Tuning checks. Keep the existing file-exists assertions. Both tests have a path override (`SKILL_PATH` in `skill-loop.test.mjs`, `OPENSPEC_SKILL_PATH` in `openspec-skill.test.mjs`), so run the deliberate break from success criterion 1.4 for each file; the parenthetical in 1.4 saying the openspec test has no override is out of date.

### Success Criteria:

#### Automated Verification:

- No old placeholder remains in skills or tests: `! grep -rn "this skill's base directory" skills/*/SKILL.md` (and the tests no longer pin it, only assert its absence)
- 10x skill content tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs`
- OpenSpec skill content tests pass: `node --test skills/10x-pipeline/test/openspec-skill.test.mjs`
- Deliberate break: with the old placeholder put back in a scratch copy of a SKILL.md, the new tests fail: `SKILL_PATH=<scratch copy> node --test skills/10x-pipeline/test/skill-loop.test.mjs` exits non-zero (the openspec test has no path override; check by reasoning from its assertions or add the same override as `skill-loop.test.mjs` uses)
- Rules and agents tests still pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/provenance.test.mjs`

#### Manual Verification:

- Read both changed SKILL.md heads and confirm each script path line reads naturally and still tells the orchestrator to run `node` from the run root

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: README minimum Claude Code version

### Overview

State the version the plugin needs so a user on an older Claude Code knows why the variable or the `effort` parameter is missing.

### Changes Required:

#### 1. README

**File**: `README.md`

**Intent**: Add a short requirement line in the `## 📦 Install` section (no new heading) naming the minimum Claude Code version and the two features behind it, next to the existing install commands.

**Contract**: One or two sentences: Claude Code 2.1.292 or later; `${CLAUDE_SKILL_DIR}` in skill content needs 2.1.69 and the `effort` parameter of the Agent tool needs 2.1.292, so 2.1.292 covers both. README already states Node.js 24+ in the two `Needs:` lines of Quick start, so do not repeat it in Install. Check that `README.md`, `plugin.json` and `marketplace.json` descriptions stay aligned (no change to those fields).

### Success Criteria:

#### Automated Verification:

- README names the version: `grep -n "2.1.292" README.md`
- Version fields still consistent: `node tools/version-check.mjs`
- Tools tests pass: `node --test tools/test/*.test.mjs`

#### Manual Verification:

- The README sentence is accurate against the Claude Code changelog entries for 2.1.69 and 2.1.292

---

## Phase 3: Full suite, CI and live check

### Overview

Run the whole suite, push through the run's pull request, and prove the substitution on an installed plugin.

### Changes Required:

#### 1. Verification only

**Intent**: No code change. Run the suite and check CI on the run's pull request; do the live check by hand.

**Contract**: Live check procedure: install the plugin from a local marketplace pointing at this run's worktree (`/plugin marketplace add <run worktree path>` then `/plugin install agent-smith@agent-smith`, not `--plugin-dir`; adding `xycu/agent-smith` would install `main`, which still has the old placeholder) in a scratch project, run `/agent-smith:10x-pipeline` on a throwaway change (or ask Claude to print the `Router:` line of the loaded skill), and confirm the path shown is under the plugin cache (a version folder), contains `scripts/route.mjs`, and `node <path> status <id>` starts the router. Repeat for `/agent-smith:openspec-pipeline` (path ends `/../10x-pipeline/scripts/route.mjs` and resolves).

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Router starts in a scratch project: `node skills/10x-pipeline/scripts/route.mjs init <scratch-id> --goal "check"` then `node skills/10x-pipeline/scripts/route.mjs status <scratch-id>` print valid JSON
- Commit subjects are Conventional Commits: `node tools/commit-lint.mjs main..HEAD`
- CI is green on the run's pull request: `gh pr checks`

#### Manual Verification:

- Installed plugin (not `--plugin-dir`): the substituted `ROUTER` path in `/agent-smith:10x-pipeline` is the plugin cache path and the router starts
- Installed plugin: the same for `/agent-smith:openspec-pipeline` through `../10x-pipeline`

---

## Testing Strategy

### Unit Tests:

- `skill-loop.test.mjs` and `openspec-skill.test.mjs`: each script path line starts with `${CLAUDE_SKILL_DIR}`; the old placeholder string is absent from the whole file; the target script files exist.

### Integration Tests:

- None new. `agents.test.mjs` and `provenance.test.mjs` run the copied plugin tree and stay unchanged.

### Manual Testing Steps:

1. Install the plugin from a local marketplace on the run's worktree in a scratch project.
2. Load each skill and read the `Router:` line as Claude Code substituted it.
3. Run `node <that path> status <id>` and confirm JSON.

## Performance Considerations

None.

## Migration Notes

A Claude Code below 2.1.69 would leave `${CLAUDE_SKILL_DIR}` unsubstituted; the README minimum (2.1.292) rules that out, and the Agent tool's `effort` parameter already needs 2.1.292.

## References

- Change: `context/changes/skill-dir-variable/change.md`
- Claude Code changelog: `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` (2.1.69, 2.1.292)
- Pinned lines: `skills/10x-pipeline/test/skill-loop.test.mjs:92`, `skills/10x-pipeline/test/openspec-skill.test.mjs:79,82,155`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: SKILL.md files and their content tests

#### Automated

- [ ] 1.1 No old placeholder remains in skills or tests: `! grep -rn "this skill's base directory" skills/*/SKILL.md` (and the tests no longer pin it, only assert its absence)
- [ ] 1.2 10x skill content tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs`
- [ ] 1.3 OpenSpec skill content tests pass: `node --test skills/10x-pipeline/test/openspec-skill.test.mjs`
- [ ] 1.4 Deliberate break: with the old placeholder put back in a scratch copy of a SKILL.md, the new tests fail: `SKILL_PATH=<scratch copy> node --test skills/10x-pipeline/test/skill-loop.test.mjs` exits non-zero (the openspec test has no path override; check by reasoning from its assertions or add the same override as `skill-loop.test.mjs` uses)
- [ ] 1.5 Rules and agents tests still pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/provenance.test.mjs`

#### Manual

- [ ] 1.6 Read both changed SKILL.md heads and confirm each script path line reads naturally and still tells the orchestrator to run `node` from the run root

### Phase 2: README minimum Claude Code version

#### Automated

- [ ] 2.1 README names the version: `grep -n "2.1.292" README.md`
- [ ] 2.2 Version fields still consistent: `node tools/version-check.mjs`
- [ ] 2.3 Tools tests pass: `node --test tools/test/*.test.mjs`

#### Manual

- [ ] 2.4 The README sentence is accurate against the Claude Code changelog entries for 2.1.69 and 2.1.292

### Phase 3: Full suite, CI and live check

#### Automated

- [ ] 3.1 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 3.2 Router starts in a scratch project: `node skills/10x-pipeline/scripts/route.mjs init <scratch-id> --goal "check"` then `node skills/10x-pipeline/scripts/route.mjs status <scratch-id>` print valid JSON
- [ ] 3.3 Commit subjects are Conventional Commits: `node tools/commit-lint.mjs main..HEAD`
- [ ] 3.4 CI is green on the run's pull request: `gh pr checks`

#### Manual

- [ ] 3.5 Installed plugin (not `--plugin-dir`): the substituted `ROUTER` path in `/agent-smith:10x-pipeline` is the plugin cache path and the router starts
- [ ] 3.6 Installed plugin: the same for `/agent-smith:openspec-pipeline` through `../10x-pipeline`
