# Codex step publication guard — Plan Brief

> Full plan: `context/changes/codex-step-publication-guard/plan.md`

## What & Why

A Codex step can run `git push`, `gh pr create` or `gh api`, and it sees the parent's `GH_TOKEN`, because the rule file allows `git` and `gh` as a whole and the runner passes the whole environment. Only `open-pr.mjs` may publish (ADR-017). The Claude host enforces this with a hook; the Codex host has nothing.

## Starting Point

`.codex/rules/project.rules` has blanket allows for `git` and `gh` plus a few exact-prefix `forbidden` rules. `run-codex.mjs` starts `codex` three times (metadata app-server, sandbox probe, `exec`) with no `env`. No step needs `gh` or `git push`.

## Desired End State

Under the project rules `git push` and every `gh` command are `forbidden`; no `codex` child the runner starts holds a GitHub token variable; `docs/REFERENCE.md` says what is enforced and which forms the rules cannot catch.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Rule decision | `forbidden`, not `prompt` | `prompt` goes to the auto reviewer and `exec` has no terminal; `forbidden` refuses outright | Plan (checked with `codex execpolicy check`) |
| Blanket allows | Replace `gh` allow with a blanket `gh` `forbidden`; keep `git` allow | Step commits are local and expected (ADR-010); strictest rule wins, so `git push` forbidden holds | Plan |
| gh forms | Every `gh` command, one blanket rule | No step needs `gh`; `gh auth token` reads the stored token; other families (`gist`, `secret`, `run`) mutate GitHub; the prefix also matches `gh -R <repo> …` | Plan review |
| Env approach | Deny list by name pattern | Codex auth, proxy and custom provider keys vary; an allow list would break installs | Plan |
| Scrub scope | All three spawns | The app-server and probe are also `codex` processes | Plan |
| Tests | In-test rule evaluator, cross-checked with real `execpolicy check` when installed; fake CLI records env | Suite cannot start a model | Plan |

## Scope

**In scope:** rule file, env scrub helper and spawns, tests for both, `docs/REFERENCE.md`, ADR-024 amendment, test index rows.

**Out of scope:** env allow list, stored credentials and SSH agent, `--no-verify` and wrapper forms, a Codex hook, `run-claude.mjs`, `open-pr.mjs`, `.codex/config.toml`.

## Architecture / Approach

Rules refuse the direct commands; the env scrub removes the environment token so a command that slips past a prefix match still lacks it. Both are small and independent, each with its own test, then the reference states the limits plainly.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Rules | Forbidden publishing forms, rule test | Evaluator drifting from Codex; covered by the real-CLI cross-check |
| 2. Env scrub | `codexChildEnv` on three spawns, env tests | Fake CLI template-string escaping |
| 3. Docs and proof | Reference, ADR amendment, full suite, live Codex check | Live check is manual |

**Prerequisites:** Node 24+; Codex 0.169.0 optional for the cross-check.
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks & Assumptions

- Whether `bash -lc "git push"` is refused is unverified; the reference states it as not covered until the live check records it.
- Decisions above were taken without a human from observed evidence; the `forbidden` choice assumes a non-interactive step cannot answer a prompt.
- Rule files apply only when the project is trusted.

## Success Criteria (Summary)

- The rule table and env tests pass and the full suite stays green.
- A live Codex step records refusal of `git push`, `gh pr create` and `gh auth token` with a dummy token set in the shell and a local bare `origin`.
