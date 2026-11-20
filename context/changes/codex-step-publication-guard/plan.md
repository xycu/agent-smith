# Codex step publication guard Implementation Plan

## Overview

A Codex step can push, open or merge pull requests and read GitHub tokens, because `.codex/rules/project.rules` allows `git` and `gh` as a whole and `run-codex.mjs` hands the child the parent's full environment. This plan makes the Codex host refuse `git push` and the publishing `gh` forms through rules, removes GitHub tokens from the environment of every `codex` process the runner starts, tests both, and records in `docs/REFERENCE.md` what that enforces and what it cannot.

## Current State Analysis

- `.codex/rules/project.rules:2-3` hold `prefix_rule(pattern = ["git"], decision = "allow")` and the same for `["gh"]`. Only exact prefixes such as `git push --force` are `forbidden` (`:20-23`).
- `skills/10x-pipeline/scripts/run-codex.mjs` starts `codex` three times with no `env`: the metadata app-server (`:32`), and inside `launch` the sandbox probe (`:225`) and `exec` (`:285`) through one `spawn` call (`:177`). Each inherits `GH_TOKEN`, `GITHUB_TOKEN` and every other variable.
- No step prompt, rule file or skill needs `gh` or `git push`. The only `gh` and `git push` users are `open-pr.mjs` and `pr-comment.mjs`, which run in the orchestrator outside the Codex child (ADR-017).
- `.codex/config.toml` sets `approval_policy = "on-request"` with `approvals_reviewer = "auto_review"` and a network-enabled profile.

## Desired End State

- `git push` in any argument order after `push`, and every `gh pr`, `gh api`, `gh release`, `gh repo`, `gh issue`, `gh auth` and `gh workflow` form, evaluate to `forbidden` under the project rules. No blanket `gh` allow remains. `git` stays allowed otherwise, because step commits are local and the router expects them (ADR-010).
- A child started by `run-codex.mjs` (probe, exec and app-server) has no variable named `GH_TOKEN`, `GITHUB_TOKEN`, `GH_ENTERPRISE_TOKEN`, `GITHUB_ENTERPRISE_TOKEN`, and keeps everything else.
- `docs/REFERENCE.md` lists what the Codex host enforces and the forms it cannot stop.
- Verify: the new rule and env tests pass, and the full suite passes. One human live step, listed under Manual, proves the refusal in a real `codex exec`.

### Key Discoveries:

- `codex execpolicy check --rules <absolute path> <command...>` (Codex 0.169.0) evaluates a rule file without a model. The strictest decision wins when several rules match, so a `forbidden` rule beats the `["git"]` allow. A relative `--rules` path silently matched nothing in the audit run; use an absolute path.
- Observed with that command: `git push origin main --force` is `forbidden` under a `["git","push"]` rule; `git -C . push`, `/usr/bin/git push`, `env git push`, `bash -lc "git push"` and `gh -R a/b pr create` match no forbidden rule.
- `prompt` is not a refusal under `approval_policy = "on-request"` with `auto_review`: the reviewer may approve it, and no terminal exists in `codex exec`. `forbidden` refuses without a question.
- `run-codex.mjs` exports `runCodex` and runs `main()` only when it is the entry script (last lines of the file), so a new exported helper is importable by tests.
- The fake CLI in `skills/10x-pipeline/test/codex-helpers.mjs` already records argv, stdin and cwd per call; it can record the environment too.

## What We're NOT Doing

- Passing an env allow list. Codex needs `PATH`, `HOME`, `CODEX_HOME`, its own API key variable, proxy variables and any `env_key` a user's `config.toml` provider names; an allow list would break authentication on installs we cannot enumerate.
- Hiding credentials the environment does not hold: `gh` stored credentials (`hosts.yml`, keychain), git credential helpers and `SSH_AUTH_SOCK`. Scrubbing `SSH_AUTH_SOCK` would also break SSH commit signing.
- Guarding `git commit --no-verify` or `-n` beyond the existing direct-prefix rule, or `git -C … push`, wrappers and absolute paths. Prefix rules cannot match them; the reference says so.
- A Codex hook equivalent of `step-guard.mjs`, a change to `.codex/config.toml`, or changes to `run-claude.mjs` (headless Claude on a Codex host).
- Changing `open-pr.mjs` or `pr-comment.mjs`; they keep their token.

## Implementation Approach

Two independent mechanisms plus the documentation: rules refuse the direct publishing commands, the environment scrub removes the token so a push or API call that slips past the prefix match still lacks the HTTPS credential held in the environment. Rules and env scrub land as separate phases with their own tests; docs and the full suite close the change. Decisions taken without a human, each from evidence above: `forbidden` rather than `prompt`; deny list rather than allow list; scrub all three spawns; drop the blanket `gh` allow rather than keep it beside forbidden rules; add `gh issue`, `gh auth` and `gh workflow` to the four forms named in the goal because `gh auth token` reads the stored token and the other two publish.

## Phase 1: Publishing forms refused by rule

### Overview

Take `git push` and the publishing `gh` forms out of the allow and test the rule file.

### Changes Required:

#### 1. Rule file

**File**: `.codex/rules/project.rules`

**Intent**: Remove the blanket `gh` allow, add `forbidden` rules for `git push` and for the publishing `gh` subcommands, and say in the header comment that publication belongs to `open-pr.mjs` and `pr-comment.mjs`. Leave the blanket `git` allow, the `prompt` rules and the existing forbidden lines.

**Contract**: `["git", "push"]` forbidden with a justification naming ADR-017; `["gh", ["pr", "api", "release", "repo", "issue", "auth", "workflow"]]` forbidden with a justification. No rule with pattern `["gh"]`. Other `gh` forms match no rule and fall to the host's approval path.

#### 2. Rule test

**File**: `skills/10x-pipeline/test/codex-rules.test.mjs` (new)

**Intent**: Prove the rule file refuses the forms and still allows ordinary git. A small in-test evaluator reads the `prefix_rule(...)` lines, matches token prefixes (alternation lists supported) and applies strictest-wins (`forbidden` over `prompt` over `allow`). When `codex execpolicy check` runs on this machine, the same table is also checked against it with an absolute `--rules` path, so the evaluator cannot drift; without Codex that part is skipped.

**Contract**: Table expects `forbidden` for `git push`, `git push origin main`, `git push origin main --force`, `gh pr create`, `gh pr merge 1`, `gh pr view 1`, `gh api repos/x/y`, `gh release create v1`, `gh repo create`, `gh issue comment 1`, `gh auth token`, `gh workflow run x`; `allow` for `git status`, `git add -A`, `git commit -m x`, `git log`. The file has no rule whose pattern is exactly `["gh"]` and none that allows `["git","push"]`.

#### 3. Test index

**File**: `skills/10x-pipeline/test/README.md`

**Intent**: Add the `codex-rules.test.mjs` row next to the other Codex rows.

### Success Criteria:

#### Automated Verification:

- Rule table and file-shape assertions pass: `node --test skills/10x-pipeline/test/codex-rules.test.mjs`
- Rule file has no blanket gh allow: `! grep -nE 'pattern = \["gh"\], decision = "allow"' .codex/rules/project.rules`
- Rule file refuses git push through the real evaluator, when Codex is installed: `codex execpolicy check --rules "$PWD/.codex/rules/project.rules" git push origin main --force` prints `"decision":"forbidden"`

#### Manual Verification:

- None for this phase; the live refusal is Phase 3.

**Implementation Note**: After completing this phase and all automated verification passes, continue to Phase 2 without a pause; both phases are independent and the manual check is in Phase 3.

---

## Phase 2: Token-free environment for every codex child

### Overview

Start all three `codex` processes of the runner with an environment that holds no GitHub token variable.

### Changes Required:

#### 1. Environment scrub

**File**: `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent**: Add an exported helper that returns a copy of `process.env` without GitHub token variables, and pass it as `env` in the app-server `spawn` (`:32`) and the `launch` `spawn` (`:177`), which covers the sandbox probe and `exec`.

**Contract**: `codexChildEnv(env = process.env)` returns a new object; it drops every key matching `/^(GH|GITHUB)_([A-Z0-9]+_)*TOKEN$/i` (so `GH_TOKEN`, `GITHUB_TOKEN`, `GH_ENTERPRISE_TOKEN`, `GITHUB_ENTERPRISE_TOKEN`), keeps every other key including `GH_HOST`, `OPENAI_API_KEY`, `CODEX_HOME`, `PATH`, `HOME` and proxy variables, and never mutates its input. Both spawns pass `env: codexChildEnv()`. A deny list stays a deny list: a new token name is a one-line pattern edit, recorded in the reference.

#### 2. Fake CLI records the environment

**File**: `skills/10x-pipeline/test/codex-helpers.mjs`

**Intent**: Let tests see which token-like variables each fake `codex` process received: add a filtered `env` object to each `calls.jsonl` record (sandbox and exec), and write the same filtered object to `server-env.json` when the fake app-server starts. The filter keeps names matching `TOKEN` and a marker variable `CODEX_TEST_KEEP`, so unrelated host variables never land in fixtures.

**Contract**: `calls(fixture)[i].env` and `<fixture>/server-env.json` hold only filtered variables. The fake is a template string: write the filter without backticks, `${` or backslashes.

#### 3. Runner tests

**File**: `skills/10x-pipeline/test/codex-runner.test.mjs`

**Intent**: Two tests. First, `codexChildEnv` on a plain object with the four names in upper and lower case plus `PATH`, `GH_HOST`, `OPENAI_API_KEY` and `CODEX_TEST_KEEP` drops exactly the four and leaves the input untouched. Second, for each chain, run the runner with the four tokens added to `w.env` and a metadata-reading mode: the sandbox probe call, the exec call and the app-server record show none of the four names and still show `CODEX_TEST_KEEP`; the result still completes.

**Contract**: Reuse `codexFixture`, `execute`, `calls` from `codex-helpers.mjs`; the metadata-reading mode is the existing `pages`/`threadMetadata` fixture used by the settled-descendant tests near `codex-runner.test.mjs:548`.

#### 4. Test index

**File**: `skills/10x-pipeline/test/README.md`

**Intent**: Extend the `codex-runner.test.mjs` and `codex-helpers.mjs` rows with the environment scrub and the recorded environment.

### Success Criteria:

#### Automated Verification:

- Runner tests pass, including the new environment tests: `node --test skills/10x-pipeline/test/codex-runner.test.mjs`
- Other Codex suites using the helper pass: `node --test skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/codex-usage.test.mjs`
- No recursive delete was introduced: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual Verification:

- None for this phase; the live check is Phase 3.

**Implementation Note**: Continue to Phase 3 once the automated criteria pass.

---

## Phase 3: Reference, decision record and live proof

### Overview

Write down what the Codex host enforces and what it cannot, then run the full suite and the one live check the suite cannot do.

### Changes Required:

#### 1. Reference

**File**: `docs/REFERENCE.md`

**Intent**: Add one paragraph after the sandbox-probe paragraph (the one beginning "Before launching, a model-free native sandbox probe", line 35) under the Codex dispatch section, titled in bold "Codex publication guard".

**Contract**: States, with only what was observed or is a plain consequence of the rules: **Enforced** — direct `git push` (any arguments) and `gh pr|api|release|repo|issue|auth|workflow` are `forbidden` by `.codex/rules/project.rules`, and the strictest matching rule wins; the child, its probe and the metadata server start without `GH_TOKEN`, `GITHUB_TOKEN`, `GH_ENTERPRISE_TOKEN` and `GITHUB_ENTERPRISE_TOKEN` (deny list; other variables, Codex's own key and proxy variables pass). **Cannot enforce** — prefix rules match the leading tokens only: `git -C <dir> push`, `git -c <k=v> push`, `gh -R <repo> pr …`, an absolute executable path, `env` or shell wrappers and API equivalents are not matched by this file; `git commit -m x --no-verify` and `-n` are not refused (only the direct `git commit --no-verify` is); the scrub removes only named environment variables, not stored `gh` credentials, git credential helpers or the SSH agent; rules load only when the project is trusted, and a user-level configuration or approval mode can still change what a step may run; no model-command hook exists on this host, so `step-guard.mjs` has no Codex equivalent. State that `forbidden` was chosen because `prompt` goes to the auto reviewer and a non-interactive `codex exec` has no terminal to answer, and that the live refusal of a real step is a recorded Manual check. Grep the docs for the old behaviour first (lessons: grep every doc when behaviour changes) and edit any statement that claims `git` or `gh` is allowed as a whole.

#### 2. Decision record

**File**: `docs/ADR/ADR-024-openai-codex-support.md`

**Intent**: Append a short dated amendment: rules forbid publication forms, deny-list env scrub for all three spawns, and the choice of `forbidden` over `prompt` and of a deny list over an allow list, with a pointer to the reference paragraph.

**Contract**: Same amendment heading style as the existing "## Amendment — …" sections; no new ADR file and no index row.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Reference names the guard: `grep -n "Codex publication guard" docs/REFERENCE.md`
- Version fields still agree: `node tools/version-check.mjs`
- Commit subjects are Conventional Commits: `node tools/commit-lint.mjs main..HEAD`

#### Manual Verification:

- A human runs one live Codex step (`codex exec` in a trusted scratch clone with this rule file) that is told to run `git push origin HEAD`, then `gh pr create`, then `gh auth token`, with `GH_TOKEN` set in the shell, and records that each is refused and that `env` inside the step shows no GitHub token; the record goes in `context/changes/codex-step-publication-guard/evidence/live-codex-refusal.md`.
- The same human notes in that record whether `bash -lc "git push"` is refused, so the reference statement about wrappers can be tightened or confirmed.

---

## Testing Strategy

### Unit Tests:

- Rule evaluator table, with the real `codex execpolicy check` cross-check when installed.
- `codexChildEnv` on a plain object: removed names, kept names, case, no mutation.

### Integration Tests:

- Fake CLI through the real runner on both chains: probe, exec and app-server environments hold no token and keep the marker variable.

### Manual Testing Steps:

1. In a trusted scratch clone, export a dummy `GH_TOKEN`, start `codex exec` with the project rule file and ask it to push, open a PR and print the token.
2. Record the refusal text and the environment listing in the evidence file.

## Performance Considerations

None; the scrub copies one object per spawn.

## Migration Notes

A user-level `~/.codex/rules` file or project override that allows `git push` keeps working only if it is stricter-or-equal; since the strictest decision wins, a user allow cannot undo the project `forbidden`. No state or policy migration.

## References

- Change notes: `context/changes/codex-step-publication-guard/change.md`
- Rule file: `.codex/rules/project.rules:1-23`
- Spawn sites: `skills/10x-pipeline/scripts/run-codex.mjs:32`, `:177`, `:225`, `:285`
- Fake CLI: `skills/10x-pipeline/test/codex-helpers.mjs` (`FAKE`, `codexFixture`, `calls`)
- ADR-017 (only `open-pr.mjs` publishes), ADR-024 (Codex support), ADR-010 (router git writes)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Publishing forms refused by rule

#### Automated

- [ ] 1.1 Rule table and file-shape assertions pass: `node --test skills/10x-pipeline/test/codex-rules.test.mjs`
- [ ] 1.2 Rule file has no blanket gh allow: `! grep -nE 'pattern = \["gh"\], decision = "allow"' .codex/rules/project.rules`
- [ ] 1.3 Rule file refuses git push through the real evaluator, when Codex is installed: `codex execpolicy check --rules "$PWD/.codex/rules/project.rules" git push origin main --force` prints `"decision":"forbidden"`

### Phase 2: Token-free environment for every codex child

#### Automated

- [ ] 2.1 Runner tests pass, including the new environment tests: `node --test skills/10x-pipeline/test/codex-runner.test.mjs`
- [ ] 2.2 Other Codex suites using the helper pass: `node --test skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/codex-usage.test.mjs`
- [ ] 2.3 No recursive delete was introduced: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

### Phase 3: Reference, decision record and live proof

#### Automated

- [ ] 3.1 Full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 3.2 Reference names the guard: `grep -n "Codex publication guard" docs/REFERENCE.md`
- [ ] 3.3 Version fields still agree: `node tools/version-check.mjs`
- [ ] 3.4 Commit subjects are Conventional Commits: `node tools/commit-lint.mjs main..HEAD`

#### Manual

- [ ] 3.5 A human runs one live Codex step that tries git push, gh pr create and gh auth token with GH_TOKEN set, and records the refusals and a token-free environment in the evidence file
- [ ] 3.6 The same human notes whether bash -lc "git push" is refused, so the wrapper statement in the reference is confirmed or tightened
