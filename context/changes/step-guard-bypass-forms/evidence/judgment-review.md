# Judgment for rows 1.4, 2.4 and 3.5

Method: read `skills/10x-pipeline/scripts/step-guard.mjs` (`commands`, `longFlag`, `gitOptions`, `gitProblem`, `commandProblem`, `wrappers`, `unwrap`, `resolve`, `eventProblem`) and drove the real hook CLI with about 100 extra commands through `script-guard-probe.mjs` (an `agent-smith:step` PreToolUse event per command). `node --test skills/10x-pipeline/test/step-guard.test.mjs` also passes: 33 tests, 0 fail.

## 1.4 Scanner and resolve code, cases the table does not name

Probed and all denied as wanted:
- wrapper options with a value: `timeout --signal=KILL 5 git push`, `timeout -s KILL 5 git push`, `nice --adjustment 5 git push`, `env -C /x git push`, `env --unset X git push`, `sudo -u root -- git push`, `xargs -n 1 -P 4 git push`, `exec -a name git push`, `time -f %e git push`.
- redirect glued to a quoted word: `echo hi >"out file" ; git push` is denied (the push is found), `git status >"a b"` is allowed.
- other shapes: `case x in x) git push;; esac`, `! { git push; }`, `<<<x git push`, `git status |& git push`, `exec 3>f git push`, `diff <(git status) <(git push)`, `echo $(echo $(git push))`, `\git push`, `git "push"`, `/usr/bin/git push`.
- false-positive checks stay allowed: `echo "git push"`, `grep -r "rm -rf" .`, `git commit -m "rm -rf x; git push"`, a quoted-delimiter heredoc holding `git push`.
Candidate gap checked: `git -ccore.hooksPath=/x commit` is allowed. Git itself rejects the attached `-c<name>` form (only `-c <name>=<value>` is valid), so it is not a bypass. The only reachable gap is `find -exec sh -c "git push"`, which the plan and `docs/REFERENCE.md` list as out of scope (`sh -c`). No unnamed case found that the guard should deny and allows. Row supported.

## 2.4 Deny lists against the always-true rules, no needed safe form blocked

Quoted rule (`skills/10x-pipeline/rules/top.md`): "preserve every affected version in a commit or ref before proceeding" and "MUST NOT force-push, rewrite pushed history, pass `--no-verify`, or delete a branch, tag, ref or worktree holding commits reachable from nowhere else".
Allowed by the probe, so a step can still do it: `git commit -am "msg"`, `git commit --amend --no-edit`, `git -C sub commit -m x`, `git switch -c feat`, `git branch feat`, `git branch -m a b`, `git update-ref refs/preserve/x HEAD`, `git tag v1`, `git tag -a v1 -m x`, `git stash`, `git stash push -m x`, `git reset --soft HEAD~1`, `git reset HEAD file`, `git rm --cached f`, `git clean -n`, `git worktree add ../w`, `git commit -m "--no-verify"`.
Denied and consistent with the rules: `git switch -C`, `git reset --keep`, `git tag -f`, `git read-tree --reset`, `git rm -r -f`, `git send-pack`, `git http-push`. `git checkout -b new` is denied, but plain `checkout` was already denied before this change (existing test denies `git checkout change.md`), and `git switch -c` is the allowed equivalent. Row supported.

## 3.5 Changed paragraphs in docs/REFERENCE.md and README.md against the tests

`docs/REFERENCE.md` (guard paragraph) claims: assignment prefixes, subshells and groups, reserved words, `function` bodies, `$(...)` and backticks also in double quotes, process substitutions, glued redirects, wrappers `env command exec nohup time timeout nice sudo xargs` up to eight deep, `find -exec/-execdir/-ok/-okdir`, `env -S` and `sudo -s/-i` denied with guidance, unterminated substitution fails closed, prefix abbreviations, the listed discarding Git forms, global options with a value, `core.hooksPath`, and `--no-verify` only for hook-running subcommands. Each claim matched a probe result above or a test in `step-guard.test.mjs` (for example line 280 holds `cat <(git push)` and `echo "$(git push)"`). The out-of-scope paragraph (`sh -c`, `bash -c`, `eval`, variables, interpreters, `setsid`/`stdbuf`/`ionice`/`builtin`/`coproc`/`su -c`/`doas`/`watch`/`parallel`, aliases, hook-skipping env vars, `git config core.hooksPath`) matches the guard: none of those is parsed. `README.md`: "also behind common shell shapes (assignment prefixes, subshells, substitutions, redirects) and simple wrappers such as `env`, `sudo` and `xargs`" matches. The old "wrappers and helper internals" exclusion is gone from the reference as the plan requires. Row supported.
