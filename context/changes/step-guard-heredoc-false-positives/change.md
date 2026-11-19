---
change_id: step-guard-heredoc-false-positives
title: Stop the step guard blocking heredocs and oversized commands it should allow
status: impl_reviewed
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Review of the past week's changes on 2026-11-19 (session review, not a pipeline run). Two defects in `skills/10x-pipeline/scripts/step-guard.mjs`, the PreToolUse Bash hook that `hooks/hooks.json` registers with `onFailure: "block"`. Both make Claude Code refuse commands that are safe.

**Defect 1: heredoc bodies are parsed as shell words.** `commands(text)` is a hand-written word splitter. It splits on `;`, `&`, `|` and newline, tracks quotes and escapes, and throws `Unterminated shell quote.` (line 52). It has no notion of a heredoc, so the body of `<<EOF ... EOF` is read as more commands. Reproduced live on Claude Code 2.1.311 with the installed plugin 1.13.0, inside an `agent-smith:step` subagent:

- `cat <<EOF` with a body line `it doesn't matter` is blocked with `Step guard failed closed. Unterminated shell quote.`
- A heredoc whose body holds the text `rm -rf build` (for example a note written to a file) is denied as a recursive deletion.
- `git commit -m "$(cat <<'EOF' ... EOF)"` is blocked when the message holds an unbalanced `"` or an apostrophe.

The last form is the commit-message pattern Claude Code itself teaches, so an `implement` or `commit` step can stall on an ordinary commit message. `skills/10x-pipeline/test/step-guard.test.mjs` has no heredoc case, and neither `skills/10x-pipeline/rules/top.md` nor `agents/step.md` tells a step to avoid heredocs.

**Defect 2: the 64 KiB input cap fires before the agent check.** `MAX_INPUT_BYTES = 64 * 1024` (line 3) is enforced while reading stdin (line 142). The check that limits the guard to step subagents, `event.agent_type !== "agent-smith:step" || event.agent_id === undefined` (line 124), runs only after the event is parsed. So a Bash command larger than about 64 KB exits 2 with `Step guard failed closed. Hook input exceeds 64 KiB.` in every session that has the plugin enabled: the main session, other plugins' subagents and work that has nothing to do with the pipeline. Reproduced locally with a 70 KB command on stdin (exit 2).

**What the fix must keep.** The guard stays fail-closed for a step subagent, and every denial it has today stays: `gh`, `git push`, the publication scripts, `--no-verify`, `git restore` and `git checkout`, `reset --hard`, `clean`, `stash drop` and `clear`, branch and tag deletion, `worktree remove` and `prune`, `rm -r`, `find -delete`. A heredoc body is data only when it feeds a command that does not execute it. A body fed to a shell or an interpreter (`sh`, `bash`, `zsh`, `node`, `python` and the like, also behind a pipe) is still code and must not become a way around the guard. The plan decides whether to scan such bodies or to deny that form outright; denying is acceptable if the message says what to do instead.

**Direction (for the plan to confirm).**
- Teach `commands()` the heredoc forms `<<WORD`, `<<'WORD'`, `<<"WORD"` and `<<-WORD`, and skip the body up to the delimiter line. Keep here-strings (`<<<`) as ordinary words.
- For the cap: a session that is not an `agent-smith:step` subagent must never be blocked by this hook. Either decide the agent identity before the size limit applies, or raise the bound and fail closed on oversize only for a step subagent. The memory bound itself should stay.
- If a class of command cannot be parsed safely, the denial message names the form and the alternative (for example "write the text to a file with the Write tool"), so a step does not retry the same command.

**Constraints.**
- No npm dependencies; `node:` built-ins only, Node 24+ (ADR-006). The parser stays in `step-guard.mjs`.
- `hooks/hooks.json` keeps `timeout: 5`, so the guard must stay fast on a large command.
- Do not weaken the guard to get a green test: a new allow case needs a matching deny case next to it.

**Done when.**
- `step-guard.test.mjs` has cases for: a heredoc with an apostrophe (allowed), a heredoc body that mentions `rm -rf` as text (allowed), `git commit -m "$(cat <<'EOF' ... EOF)"` with quotes in the message (allowed), a heredoc fed to a shell that holds `git push` (denied), a denied command placed after the heredoc's closing delimiter (denied), and an unterminated heredoc (fails closed for a step subagent).
- An event larger than 64 KiB from a session that is not a step subagent exits 0; the same event from a step subagent is either checked or fails closed, as the plan decides, and a test pins the choice.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- A Manual row covers a live check in an `agent-smith:step` subagent with the plugin installed: the three reproduced commands above run, and `gh --version` is still denied.
