# Step guard bypass forms Implementation Plan

## Overview

Make `skills/10x-pipeline/scripts/step-guard.mjs` deny the forbidden commands it already knows when they sit behind common shell shapes (assignment prefix, subshell, group, reserved word, `$(...)`, backticks, simple wrappers, `xargs`, `find -exec`, glued redirects), deny the Git forms it does not know yet (abbreviated long options, discarding `switch`/`reset`/`branch`/`tag`/`rm`/`checkout-index`/`read-tree`/`update-ref` forms, hook-path overrides, `send-pack`), and stop denying `--no-verify` used as a search pattern. The guard stays a hand-written, dependency-free scanner, not a shell interpreter. Docs state the new coverage and what stays out of scope.

## Current State Analysis

`eventProblem` (`step-guard.mjs:501-531`) runs `withoutHeredocData`, then `commands()` (`:373-420`), then `commandProblem(words)` (`:484-494`) on each command. `commands()` splits only on `;`, `&`, `|` and newline. `commandProblem` takes `words[0]` as the executable and `gitOptions` (`:426-463`) takes the first non-dash word as the subcommand. Long options are compared as exact strings (`:469`, `:473`, `:476`), and the `--no-verify` check runs for every Git subcommand, which denies `git log -S "--no-verify"`. The headless commit gate (`:523`) also reads `words[0]`, so `X=1 git commit` skips it.

The change.md line numbers (8-55, 94-119) predate `step-guard-heredoc-false-positives` (merged, archived). That change added the heredoc lexer (`shellWord` `:98`, `shellExpansionEnd` `:135`, `withoutHeredocData` `:248`); the parser is now 747 lines. This plan targets the current code.

## Desired End State

Every form in the `change.md` list is denied in an `agent-smith:step` subagent, each next to an allow test for a normal command of the same shape. `git log -S "--no-verify"`, `git log --grep "--no-verify"` and `git grep -e --no-verify` pass. The full suite is green. `docs/REFERENCE.md` and `README.md` describe the new coverage and the remaining out-of-scope forms. A live check in a real `agent-smith:step` subagent confirms `X=1 git push` and `(git push)` are denied and `X=1 git status` runs.

### Key Discoveries:

- `shellExpansionEnd(text, opening, depth)` (`step-guard.mjs:135`) already finds the end of `$(...)`, `$((...))` and backtick substitutions, tracks quotes via `shellWord`, caps depth at 64 and throws on an unterminated one. Reuse it to find substitution bodies instead of writing a second matcher.
- `withoutHeredocData` removes heredoc bodies before `commands()` runs and leaves the opener (`<<EOF`) in the text. Glued-redirect handling must consume that operator and its delimiter word.
- `skills/10x-pipeline/test/step-guard.test.mjs:250` asserts `echo "$(git push)"` and `bash -c 'git push'` are neutral. The first expectation flips; `bash -c`, `custom-helper` stay neutral (interpreters stay out of scope).
- `skills/10x-pipeline/test/step-guard.test.mjs:398` reads the guard source and forbids the words `import`, `require`, `eval`, `Function`, and calls such as `.exec(`, `spawn(`, `fork(`. New code and comments must avoid them (use `.test()`/`.match()`).
- Git accepts any unique prefix of a long option and rejects an ambiguous one. Verified on the installed Git: `git commit --no-v` fails with "ambiguous option: no-v (could be --no-verbose or --no-verify)"; `git switch --d` fails with "ambiguous option: d". So denying every non-empty prefix of a denied option only ever denies commands Git itself would reject, except where a prefix is the unique abbreviation, which is the bypass.
- `git --exec-path /x status` only prints the exec path and exits, so it is not a bypass in itself. The change.md direction still asks to treat it as taking a value, which is the deny-biased reading and costs nothing.
- Existing false denial: the `clean` dry-run check uses exact `-n`/`--dry-run`, so `git clean --dry -d` is denied today by code reading (`:467`). The shared prefix helper fixes it.

## What We're NOT Doing

- No interpretation of `sh -c`, `bash -c`, `eval`, `source`, variables holding a command name, interpreters (`python -c`, `node -e`), aliases (shell aliases and `git -c alias.X=...`), `function`-body calls or `env -S`/`sudo -s` command strings. `env -S` and `sudo -s`/`-i` with a command string are denied with guidance rather than parsed. The docs list the rest as out of scope and say why.
- No new denial for hook-skipping environment variables (`HUSKY=0`, `SKIP=`, `GIT_CONFIG_*`), for `git config core.hooksPath`, or for `git reset` (mixed) unstaging. They are separate decisions.
- No change to Codex children (`.codex/rules/project.rules`, `run-codex.mjs`); `codex-step-publication-guard` owns that.
- No change to `hooks/hooks.json` (`timeout: 5` stays), the scope predicate (`isGuarded`), the byte cap, the heredoc rules, routing, policy or run state.
- No deny of `git update-ref` that creates or moves a ref in general: the shared rules tell steps to preserve work "in a commit or ref", so a ref write must stay possible. Only `--stdin`, delete forms and `refs/agent-smith/` are denied.
- No edit of `context/foundation/prd.md`, `health-check.md` or ADRs. Their wording ("common direct unsafe commands", "bounded literal-command coverage") stays true.

## Implementation Approach

Three phases, each independently green: (1) command shapes in the scanner and a normalization step that resolves the real command behind prefixes and wrappers; (2) Git option handling on top of normalized words; (3) docs, index, full suite, live check. Phase 2 depends on phase 1 only through the normalized `words` array.

Unattended planning assumptions (no human answered; each is backed by the evidence named):

- Scope moves to every form listed in the goal and `change.md` "Direction", because both name them and the "Done when" list requires a deny test per form taken into scope.
- A form the guard cannot parse with confidence fails closed: an unterminated substitution already exits 2 (existing fail-closed path); wrapper forms that carry a command string (`env -S`, `sudo -s`/`-i` with a string) deny with guidance. Evidence: `change.md` Constraints.
- Abbreviated long options match by any non-empty prefix of the denied name rather than a fixed 5-character floor, because a floor leaves valid abbreviations such as `--ha` (hard) open, and ambiguous prefixes are rejected by Git (see Key Discoveries). Flags that allow a command (`--dry-run`, `--no-dry-run`) follow the same prefix rule so `git clean --dry -d` stops being a false denial.
- `--no-verify` is checked only for `commit`, `merge`, `pull`, `am`, `rebase`, `cherry-pick`, `revert` (`push` is denied anyway). `pull` is included because it forwards merge options.
- `update-ref`: add `--stdin` (its body cannot be inspected); keep ref creation allowed (see What We're NOT Doing).
- `-c core.hooksPath=` and `--config-env core.hooksPath=` are matched case-insensitively, since Git config names are.

## Phase 1: Command shapes and normalization

### Overview

Make `commands()` see the real commands and add a `resolve` step that strips prefixes and unwraps wrappers, so `commandProblem` and the headless commit gate see the effective command.

### Changes Required:

#### 1. Scanner: separators, substitutions, redirects

**File**: `skills/10x-pipeline/scripts/step-guard.mjs`

**Intent**: Extend `commands()` so a command hidden inside a group, substitution or redirect-glued word becomes its own entry.

**Contract**:
- Unquoted `(` and `)` flush the current command like `;`. This covers subshells, `f() {`, `case` patterns and `<(...)`/`>(...)`.
- Outside single quotes, `$(` and a backtick start a substitution, including inside double quotes (a backslash-escaped one is already consumed by the escape branch). Locate its end with `shellExpansionEnd(text, openingIndex, 1)`, run `commands()` on the inner text, append those commands to the result, and continue the outer word after the substitution. `$((...))` takes the same path; its inner `(1+2)` is a harmless command. An unterminated substitution throws and the guard exits 2 (existing path). Nesting is bounded by the helper's depth cap of 64.
- Unquoted `<` and `>` are redirects: end the current word (drop it if it is only digits, the fd), consume following `<>&|` characters, and discard the next word as the redirect target. Any command separator or `(` clears the pending target. This handles `git push>/dev/null`, `2>/dev/null git push`, `2>&1`, `&>x`, `<<EOF` leftovers and `<<<`.
- Track whether the current word was quoted or escaped, so only an unquoted digit-only word counts as an fd.

#### 2. Normalization of the effective command

**File**: `skills/10x-pipeline/scripts/step-guard.mjs`

**Intent**: Add `resolve(words)` returning the list of word arrays to check for one scanned command: the effective command after stripping prefixes and wrappers, plus any commands nested in `find -exec`.

**Contract**: Loop (max 8 rounds) over the leading words:
- Drop `NAME=value` words (`/^[A-Za-z_][A-Za-z0-9_]*\+?=/`).
- Drop reserved words `if then elif else do while until !` and standalone `{` or `}`; drop `function NAME`.
- If `basename(words[0])` is a wrapper, replace the words by the wrapped command, then loop again so `sudo env git push` resolves. A wrapper with no command (`exec 3>&1`, `command -v gh`, `sudo -l`, `sudo -v`) yields nothing to check.
- Wrapper table (what each skips before the command): `env` (`-u`/`--unset` and `-C`/`--chdir` take values, other flags and `NAME=value` skipped, `-S`/`--split-string` denied with guidance); `command` (`-p` skipped, `-v`/`-V` query only, nothing runs); `exec` (`-a NAME` value, `-c`, `-l`); `nohup`; `time` (`-p`, `-v`, `-a`; `-f`, `-o` take values); `timeout` (`-s`, `-k` take values, then one duration word); `nice` (`-n N`, `--adjustment`, or `-N`); `sudo` (`-u -g -C -D -h -p -r -t -T -U` take values, `NAME=value` skipped, `-l -v -k -K -V -e` run nothing, `-s`/`-i` followed by a quoted command string denied with guidance); `xargs` (`-a -d -E -I -L -n -P -s` take values, also attached as `-n1`, `-I{}`).
- If the resolved executable is `find`, also return each `-exec`/`-execdir`/`-ok`/`-okdir` command, up to its `;` or `+` terminator, resolved recursively. `-delete` stays checked on the find words.
- Unknown options of a wrapper are consumed as value-less flags.

Denial with guidance is a thrown `Denial` (a base class of the existing `HeredocDenial`), caught in `eventProblem` the way `HeredocDenial` already is.

#### 3. Use normalized words everywhere

**File**: `skills/10x-pipeline/scripts/step-guard.mjs`

**Intent**: Route both the headless commit/add gate (`:523`) and `commandProblem` through `resolve`, so `X=1 git commit` and `(git add)` meet the same gate.

**Contract**: `for (const scanned of commands(command)) for (const words of resolve(scanned))` wraps the existing gate and `commandProblem` call.

#### 4. Tests for the shapes

**File**: `skills/10x-pipeline/test/step-guard.test.mjs`

**Intent**: One deny test per shape and an allow test next to it, using the existing `denied`/`neutral` helpers.

**Contract**: Tests named `command shapes: <group>` for: assignment prefix, subshell and group, reserved words, `$(...)` and backticks (including inside double quotes and a commit message), glued redirects, wrappers, `xargs`, `find -exec`. Deny: `X=1 git push`, `GH_TOKEN=x gh api repos/o/r`, `TMPDIR=/x rm -rf build`, `(git push)`, `(cd sub && git reset --hard)`, `{ rm -rf build; }`, `if [ -d build ]; then rm -rf build; fi`, `for d in a b; do rm -rf "$d"; done`, `while ! git push; do sleep 1; done`, `! git push`, `PR_URL=$(gh pr create --fill)`, `` echo `git push` ``, ``git commit -m "fix `git push`" ``, `echo "$(git push)"`, `find . -name '*.tmp' | xargs rm -rf`, `find build -exec rm -rf {} +`, `find . -exec git push \;`, `git push>/dev/null`, `2>/dev/null git push`, `env git push`, `command git push`, `exec git push`, `nohup git push`, `time git reset --hard`, `timeout 60 git push`, `nice -n 5 git push`, `sudo rm -rf x`, `sudo -u root env git push`, `env -S 'git push'`, `function f { git push; }`. Allow: `X=1 git status`, `(cd sub && git status)`, `{ ls; }`, `if [ -d build ]; then ls build; fi`, `for d in a b; do echo "$d"; done`, `PR=$(git rev-parse HEAD)`, `echo "$(date +%s)"`, `echo $((1+2))`, ``echo `date` ``, `echo '$(git push)'`, `git status>out.txt`, `git commit -m x 2>&1`, `command -v gh`, `env FOO=1 git status`, `timeout 60 git status`, `sudo -l`, `xargs echo`, `find . -name '*.tmp' -exec ls {} +`, `find . -exec echo {} \;`. Also: unterminated `$(git push` and a backtick fail closed (status 2); `bash -c 'git push'` and `custom-helper` stay neutral; the `:250` test drops `echo "$(git push)"`; the headless-session test adds `X=1 git commit -m x` and `(git add -- f)` denied for a leaf or step without commit permission; the recording-executable test gets `X=1 git restore --staged unique.txt` and `(git push)` denied before the executable; a 60 KiB command of repeated `$(` denies or fails closed inside the 5 s timeout, in a test named `command shapes: nesting stays inside the hook timeout`.

### Success Criteria:

#### Automated Verification:

- Guard tests pass, including every new shape deny/allow pair: `node --test skills/10x-pipeline/test/step-guard.test.mjs`
- Source constraints hold (no forbidden words or calls in the guard): `node --test --test-name-pattern "no execution" skills/10x-pipeline/test/step-guard.test.mjs`
- Pathological nesting finishes inside the hook timeout: `node --test --test-name-pattern "nesting" skills/10x-pipeline/test/step-guard.test.mjs`

#### Manual Verification:

- Read the new scanner and `resolve` code once for cases the table-driven tests do not name (a wrapper with an option that takes a value the table lacks; a redirect glued to a quoted word).

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Git option handling

### Overview

Make Git flag checks accept unique-prefix abbreviations, stop applying `--no-verify` to read-only subcommands, handle global options with values and hook-path overrides, and add the discarding and ref-rewriting forms.

### Changes Required:

#### 1. Prefix-aware long options

**File**: `skills/10x-pipeline/scripts/step-guard.mjs`

**Intent**: One helper replaces the exact-string comparisons in `gitProblem` and the `rm` check.

**Contract**: `longFlag(arg, full)` is true when `arg` starts with `--`, its name (up to the first `=`) is non-empty and `full.slice(2)` starts with that name. Use it for `--no-verify`, `--hard`, `--delete`, `--dry-run`, `--no-dry-run`, `--recursive` (`rm`) and every new flag below. A bare `--` stays the end-of-options marker.

#### 2. Subcommand-scoped `--no-verify`

**File**: `skills/10x-pipeline/scripts/step-guard.mjs`

**Intent**: Deny hook bypass only where hooks run.

**Contract**: The `--no-verify` and commit `-n` check applies when `sub` is `commit`, `merge`, `pull`, `am`, `rebase`, `cherry-pick` or `revert`. `git log -S "--no-verify"`, `git log --grep "--no-verify"` and `git grep -e --no-verify` pass.

#### 3. Global options and hook-path overrides

**File**: `skills/10x-pipeline/scripts/step-guard.mjs`

**Intent**: Find the real subcommand and see config overrides placed before it.

**Contract**: In `gitOptions`, the global options that take a separate value are `-C -c --git-dir --work-tree --namespace --config-env --exec-path --super-prefix --attr-source`. Return the `-c` and `--config-env` values as `config`. `gitProblem` denies a value that starts (case-insensitively) with `core.hookspath=` with the existing hook-bypass message. Add `tag` to the short-value table (`mFu`) so an attached message such as `-m"fix deploy"` is not scanned as flags.

#### 4. Discarding and ref-rewriting verbs

**File**: `skills/10x-pipeline/scripts/step-guard.mjs`

**Intent**: Deny the forms that discard work or move refs and keep the safe sibling forms.

**Contract** (all denied with `PRESERVATION` unless noted; short flags match inside a cluster as `branch -D` does today):
- `switch`: `-f`/`--force`, `--discard-changes`, `-C`/`--force-create`. `-c` and plain `switch <branch>` stay allowed.
- `reset`: `--hard` (existing), `--merge`, `--keep`. `--soft`, `--mixed`, no flag stay allowed.
- `branch`: delete (existing), `-f`/`--force`, `-M`, `-C`. `--list`, `-m`, `-c`, `-a`, `-v` stay allowed.
- `tag`: delete (existing), `-f`/`--force`.
- `rm`: `-f`/`--force` (`git rm -rf src`). Plain `git rm file` stays allowed.
- `checkout-index`: `-f`/`--force`. `read-tree`: `--reset`.
- `update-ref`: `--stdin`, plus the existing delete and `refs/agent-smith/` rules with prefix matching. `git update-ref refs/preserve/x HEAD` stays allowed.
- `send-pack` and `http-push` join `push` with `PUBLICATION`.

#### 5. Tests for Git options

**File**: `skills/10x-pipeline/test/step-guard.test.mjs`

**Intent**: Deny/allow pairs per form.

**Contract**: Tests named `git options: abbreviations`, `git options: discarding verbs`, `git options: global options` and `git options: search patterns`. Deny: `git commit --no-verif -m x`, `git commit --no-v -m x`, `git reset --har`, `git reset --ha HEAD~1`, `git reset --merge`, `git reset --keep HEAD~1`, `git branch --delet old`, `rm --recursiv build`, `rm --r build`, `git switch -f main`, `git switch --discard-changes main`, `git switch --di main`, `git switch -C main origin/main`, `git branch -f main HEAD~3`, `git branch --fo main HEAD~3`, `git tag -f v1 HEAD~1`, `git rm -rf src`, `git checkout-index -f -a`, `git read-tree --reset -u HEAD`, `git update-ref --stdin`, `git update-ref --del refs/heads/x`, `git send-pack origin HEAD`, `git --exec-path /x push`, `git --super-prefix p/ push`, `git --attr-source HEAD push`, `git -c core.hooksPath=/dev/null commit -m x`, `git -c core.HooksPath=/x commit -m x`, `git --config-env core.hooksPath=ENV commit -m x`, `git merge --no-verif b`, `git clean --no-d -fd`. Allow: `git switch feature`, `git switch -c new`, `git reset --soft HEAD~1`, `git reset --mixed HEAD`, `git branch --list`, `git branch -m old new`, `git branch -c a b`, `git tag -l`, `git tag -a v1 -m"fix deploy"`, `git rm file`, `git checkout-index -a`, `git read-tree HEAD`, `git update-ref refs/preserve/x HEAD`, `git -C sub status`, `git -c color.ui=false status`, `git -c core.editor=vi commit -m x`, `git clean --dry -d`, `git log -S "--no-verify"`, `git log --grep "--no-verify"`, `git grep -e --no-verify`, `git diff --no-ver`. Update `:250` expectations only as Phase 1 states; existing deny and allow tests stay unchanged.

### Success Criteria:

#### Automated Verification:

- Guard tests pass with every Git option deny/allow pair: `node --test skills/10x-pipeline/test/step-guard.test.mjs`
- The three `--no-verify` search commands are allowed: `node --test --test-name-pattern "search patterns" skills/10x-pipeline/test/step-guard.test.mjs`
- Every change.md abbreviation form (`--no-verif`, `--har`, `--delet`, `--recursiv`) is denied and its safe neighbour is allowed: `node --test --test-name-pattern "abbreviat" skills/10x-pipeline/test/step-guard.test.mjs`

#### Manual Verification:

- Compare the deny lists in Phase 2 item 4 once against the always-true rules in `skills/10x-pipeline/rules/top.md` and confirm no safe form a step needs (committing, creating a branch, preserving a ref) is blocked.

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 3.

---

## Phase 3: Docs, index and live check

### Overview

State the new coverage and the remaining out-of-scope forms, then run the full suite and the live check.

### Changes Required:

#### 1. Reference and README

**File**: `docs/REFERENCE.md` (the guard paragraphs at `:67` and `:71`), `README.md` (`:32`)

**Intent**: Replace "wrappers" in the out-of-scope list with what is now covered, and name what stays out.

**Contract**: `:67` adds: assignment prefixes, subshells and groups, reserved words, `$(...)` and backticks (also in double quotes), glued redirects, the wrappers `env command exec nohup time timeout nice sudo xargs`, `find -exec`, unique-prefix abbreviations of denied long options, the discarding forms by verb, global options with a value, `-c core.hooksPath`, and that `--no-verify` is checked only for hook-running subcommands. `:71` keeps `sh -c`, `bash -c`, `eval`, variables holding a command name, interpreters, aliases, `env -S`/`sudo -s` strings (denied with guidance), hook-skipping environment variables and `git config`, and says why: the guard is a scanner, not a shell. `README.md:32` keeps "common direct unsafe commands" and adds that common shell shapes and simple wrappers around them are covered.

#### 2. Test index

**File**: `skills/10x-pipeline/test/README.md` (row at `:36`)

**Intent**: Mention the new coverage areas in the `step-guard.test.mjs` row.

**Contract**: Add "command shapes, wrappers, Git option abbreviations" to the row text.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Reference names the new coverage and drops the old wrapper exclusion: `grep -c "xargs" docs/REFERENCE.md` is at least 1 and `grep -c "wrappers and helper internals" docs/REFERENCE.md` is 0
- Version fields still agree: `node tools/version-check.mjs`

#### Manual Verification:

- In a live `agent-smith:step` subagent with the plugin installed, `X=1 git push` and `(git push)` are denied and `X=1 git status` runs
- Read the changed paragraphs in `docs/REFERENCE.md` and `README.md` once for accuracy against the tests

---

## Testing Strategy

### Unit Tests:

- Table-driven deny and allow lists per form group in `step-guard.test.mjs`, run through the real hook CLI with inert payloads.
- Fail-closed cases (unterminated substitution) and a timing guard for pathological nesting.
- Existing tests unchanged apart from the `:250` expectation.

### Integration Tests:

- The recording-executable test proves a denied wrapped form reaches no executable.

### Manual Testing Steps:

1. Install the plugin build, start a fresh session and run `X=1 git push`, `(git push)` and `X=1 git status` through an `agent-smith:step` subagent.
2. Confirm the denial text names what to do instead.

## Performance Considerations

The hook has a 5 s timeout. Substitution recursion is bounded by the helper's depth cap (64) and the 64 KiB input cap; a test covers a worst-case input.

## Migration Notes

None. A fresh session loads the updated script; hook provenance (`hookFiles` hash) records the change, which is expected.

## References

- Change identity and audit origin: `context/changes/step-guard-bypass-forms/change.md`
- Parser it builds on: `context/archive/2026-11-19-step-guard-heredoc-false-positives/plan.md`
- Guard code: `skills/10x-pipeline/scripts/step-guard.mjs:98-189`, `:373-531`
- Tests: `skills/10x-pipeline/test/step-guard.test.mjs:61-130`, `:250`, `:398`
- Docs: `docs/REFERENCE.md:65-71`, `README.md:32`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Command shapes and normalization

#### Automated

- [ ] 1.1 Guard tests pass, including every new shape deny/allow pair
- [ ] 1.2 Source constraints hold (no forbidden words or calls in the guard)
- [ ] 1.3 Pathological nesting finishes inside the hook timeout

#### Manual

- [ ] 1.4 Read the new scanner and `resolve` code once for cases the table-driven tests do not name

### Phase 2: Git option handling

#### Automated

- [ ] 2.1 Guard tests pass with every Git option deny/allow pair
- [ ] 2.2 The three `--no-verify` search commands are allowed
- [ ] 2.3 Every change.md abbreviation form is denied and its safe neighbour is allowed

#### Manual

- [ ] 2.4 Compare the deny lists once against the always-true rules and confirm no safe form a step needs is blocked

### Phase 3: Docs, index and live check

#### Automated

- [ ] 3.1 Full suite passes
- [ ] 3.2 Reference names the new coverage and drops the old wrapper exclusion
- [ ] 3.3 Version fields still agree

#### Manual

- [ ] 3.4 In a live `agent-smith:step` subagent with the plugin installed, `X=1 git push` and `(git push)` are denied and `X=1 git status` runs
- [ ] 3.5 Read the changed paragraphs in `docs/REFERENCE.md` and `README.md` once for accuracy against the tests
