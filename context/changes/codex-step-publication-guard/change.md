---
change_id: codex-step-publication-guard
title: Stop Codex steps from pushing, publishing or reading GitHub tokens
status: new
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 14 (should fix). Found by reading the rule file and the launcher. Codex was not started for the audit, so no case here was run against a live `codex exec`.

**The defect.** A Claude step runs behind `step-guard.mjs`, a hook that denies publication and history-rewriting commands. A Codex step has no such hook. Its only limits are the prefix rules in `.codex/rules/project.rules` and the permission profile in `.codex/config.toml`. Those are weaker in three ways.

1. **`git` and `gh` are allowed as a whole.** `.codex/rules/project.rules:2-3` hold `prefix_rule(pattern = ["git"], decision = "allow")` and the same for `["gh"]`. The `forbidden` rules match exact prefixes only: `git push --force`, `git push --force-with-lease`, `git push -f`, `git push --mirror`, `git commit --no-verify`, `gh repo delete`, `gh release delete`, `gh issue delete`, `rm -r…`. The file itself says: "Prefix guards cover direct forms only."
2. **Reordered arguments pass.** By the rules as written, these are allowed: `git push origin main --force`, `git commit -m x --no-verify`, `git commit -n`, plain `git push`, `gh pr create`, `gh pr merge`, `gh api`.
3. **The child inherits the whole environment.** `skills/10x-pipeline/scripts/run-codex.mjs:288` calls `spawn("codex", args, { cwd: ROOT, stdio: [...], detached: ... })` with no `env`. The step therefore sees `GH_TOKEN`, `GITHUB_TOKEN` and every API key of the parent shell. The `agent-smith` permission profile enables network access.

**Why it matters.** The project rule is that only `open-pr.mjs` pushes and opens the pull request, never with force and never merging (ADR-017), and that a step never passes `--no-verify`. On the Claude host a guard enforces that. On the Codex host only the prompt does. A step that decides to "finish the job" can push to `main`, merge its own pull request or skip the hooks.

**Relation to other changes.** `step-guard-bypass-forms` and `step-guard-heredoc-false-positives` fix the Claude guard and name this gap as a separate change. Do not merge the three; the mechanisms differ.

**Direction (for the plan to confirm).**
- In `.codex/rules/project.rules`, move `git push`, `gh pr`, `gh api`, `gh release` and `gh repo` from the blanket allow to `forbidden` (or to `prompt`, which a non-interactive `codex exec` cannot answer; the plan checks which one Codex treats as a refusal in `exec` mode). Keep read-only `gh` forms that a step needs, if any.
- In `run-codex.mjs`, pass an explicit `env` that drops `GH_TOKEN`, `GITHUB_TOKEN`, `GH_ENTERPRISE_TOKEN` and `GITHUB_ENTERPRISE_TOKEN`. The plan decides between a deny list and an allow list, and names what Codex itself needs (its own API key, `PATH`, `HOME`, proxy variables).
- Prefix rules cannot catch a flag after other arguments. For `--no-verify` and `--force` say so in the reference and rely on the token removal for the push case.

**Constraints.**
- The plan first reads the current Codex documentation for rule files and `exec` mode; the audit did not verify how `prompt` behaves without a terminal.
- A Codex step still commits nothing by itself that the router does not expect; step commits stay the router's job (ADR-010).
- `open-pr.mjs` runs outside the Codex child and keeps its token.
- No npm dependencies (ADR-006).

**Done when.**
- A test on the rule file: no blanket allow for `git push` or `gh pr`; the forbidden forms are listed.
- A test on `run-codex.mjs`: the child environment holds no GitHub token when the parent has one.
- `docs/REFERENCE.md` states what the Codex host enforces and what it cannot.
- A human runs one live Codex step that tries `git push` and records the refusal, because the suite cannot start Codex.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
