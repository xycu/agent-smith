---
change_id: step-guard-bypass-forms
title: Make the step guard deny forbidden commands behind common shell shapes
status: implementing
created: 2026-11-19
updated: 2026-11-20
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 5 (must fix). About 250 commands were fed to `skills/10x-pipeline/scripts/step-guard.mjs` as PreToolUse events for an `agent-smith:step` subagent; nothing was executed. A sample was re-tested on 2026-11-19 with the same result.

**Order.** Do this after `step-guard-heredoc-false-positives`. Both changes edit the same parser (`commands()` and `commandProblem()`), and that one unblocks Claude runs today. That change says "every denial it has today stays"; this one adds denials.

**How the guard reports.** A denial is exit 0 with a `permissionDecision: "deny"` JSON on stdout. Exit 2 is only the fail-closed path (bad JSON, input over 64 KiB, an unterminated quote or escape). An allowed command prints nothing.

**The defect.** `commands()` (lines 8-55) splits only on `;`, `&`, `|` and newline, and `commandProblem()` (lines 109-119) takes `words[0]` as the executable. Any shape that puts something in front of the command, or wraps it, passes. Long options are compared as exact strings (lines 94-103), while git accepts any unique prefix.

**Forms that pass today (each confirmed).**
- Assignment prefix: `X=1 git push`, `GH_TOKEN=x gh api repos/o/r`, `HUSKY=0 git commit -m x`, `TMPDIR=/x rm -rf build`.
- Subshell or group: `(git push)`, `(cd sub && git reset --hard)`, `{ rm -rf build; }`, `git add -A && git commit -m "x" && (git push || true)`.
- Reserved words: `if [ -d build ]; then rm -rf build; fi`, `for d in a b; do rm -rf "$d"; done`, `while ! git push; do sleep 1; done`, `! git push`.
- Substitution: `PR_URL=$(gh pr create --fill)`, a command in backticks, backticks inside a double-quoted commit message.
- `xargs` and `-exec`: `find . -name '*.tmp' | xargs rm -rf`, `find build -exec rm -rf {} +`.
- Redirect glued to a word: `git push>/dev/null`, `2>/dev/null git push`.
- Abbreviated long options: `git commit --no-verif -m x`, `git reset --har`, `git branch --delet old`, `rm --recursiv build`. With git 2.54.0, `git commit --no-verif` skipped a failing pre-commit hook and `git reset --har` discarded a working change.
- Verbs the guard does not know: `git switch -f main`, `git switch --discard-changes main`, `git switch -C main origin/main`, `git reset --merge`, `git reset --keep HEAD~1`, `git branch -f main HEAD~3`, `git tag -f v1 HEAD~1`, `git rm -rf src`, `git checkout-index -f -a`, `git read-tree --reset -u HEAD`, `git update-ref` forms, `git send-pack origin HEAD`. Because every `git checkout` is denied, a step is pushed toward `git switch`, where the discarding flags are open.
- Global options with a separate value: `git --exec-path /x push`; and `git -c core.hooksPath=/dev/null commit`, which skips hooks.
- Simple wrappers: `env git push`, `command git push`, `time git reset --hard`, `timeout 60 git push`, `sudo rm -rf x`, `nohup`, `exec`.

**One false denial found on the way.** `git log -S "--no-verify"`, `git log --grep "--no-verify"` and `git grep -e --no-verify` are denied, because the `--no-verify` check (line 94) applies to every git subcommand. A step that audits this repository hits it.

**Scope that the reference sets today.** `docs/REFERENCE.md:51` bounds runtime coverage to direct forms and lists aliases, dynamic shell construction, wrappers, unrecognized syntax and interpreters as out of scope. A test asserts that `bash -c 'git push'` and `echo "$(git push)"` pass. `README.md:32` describes the guard as covering common direct unsafe commands. So most of the list is a gap in scope, not a broken promise. The owner decides how far the scope moves; the assignment prefix, the subshell, `then`/`do`, `$(...)` and the abbreviated options are forms an AI step writes by habit and are the ones that matter. During the audit itself, a `$(git push)` inside a double-quoted grep pattern ran a real `git push` by accident.

**Direction (for the plan to confirm).**
- Treat `(`, `)`, `{`, `}`, backtick and `$(` as command separators.
- Before matching, drop leading `NAME=value` words and the reserved words `if`, `then`, `elif`, `else`, `do`, `while`, `until`, `!`.
- For `env`, `command`, `exec`, `nohup`, `time`, `timeout`, `nice`, `sudo` and `xargs`, check the command that follows. For `find`, deny `-exec rm` with a recursive flag.
- Strip a glued `>` or `<` tail from a word.
- Match the denied long options by unique prefix with a minimum length (for example at least 5 characters of `--no-verify`), and apply the `--no-verify` check only to `commit`, `merge`, `push`, `am`, `rebase`, `cherry-pick` and `revert`.
- Add the discarding and ref-rewriting forms of `git switch`, `git reset`, `git branch`, `git tag`, `git rm`, `git checkout-index`, `git read-tree` and `git update-ref`; treat `--exec-path`, `--super-prefix` and `--attr-source` as options that take a value; deny `-c core.hooksPath=`.
- State in `docs/REFERENCE.md` what stays out of scope (`sh -c`, `eval`, variables holding a command name, interpreters, aliases) and why.

**Related, not in this change.** Codex step children have no runtime guard: `.codex/rules/project.rules` allows `git` and `gh` by prefix, so `git push --force` and `gh pr merge` are allowed, and `run-codex.mjs:288` passes the orchestrator's whole environment, including `GH_TOKEN`, to the child. That needs its own change.

**Constraints.**
- No npm dependencies; `node:` built-ins only (ADR-006). The parser stays hand-written in `step-guard.mjs`, and `hooks/hooks.json` keeps `timeout: 5`.
- The guard must not become a shell interpreter. When a form cannot be parsed with confidence, fail closed for a step subagent and say which form to use instead.
- Every new denial gets an allow case next to it, so a normal command of the same shape still runs: `X=1 git status`, `(cd sub && git status)`, `if [ -d build ]; then ls build; fi`, `git switch feature`, `git reset --soft HEAD~1`.
- A session that is not an `agent-smith:step` subagent is never affected.

**Done when.**
- `skills/10x-pipeline/test/step-guard.test.mjs` has one deny test per form the plan takes into scope and one allow test next to each.
- The three `--no-verify` search commands are allowed.
- `docs/REFERENCE.md` and `README.md` describe the new coverage and the forms that remain out of scope.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- A Manual row covers a live check in an `agent-smith:step` subagent with the plugin installed: `X=1 git push` and `(git push)` are denied, and `X=1 git status` runs.
