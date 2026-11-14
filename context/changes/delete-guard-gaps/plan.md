# Recursive-delete guard gaps implementation plan

## Overview

Extend the existing recursive-delete guard to detect JavaScript shell strings, argument arrays, split shell flags, and unsafe filesystem options. Include `.github/` and YAML or shell files in discovery, with regression coverage for the permitted deletion, creation, and ban-explanation forms.

## Current State Analysis

The scanner, file discovery, regressions, repository assertion, and rule-placement assertions all live in `skills/10x-pipeline/test/no-recursive-delete.test.mjs`. Searches found every caller of `scanCode`, `scanProse`, `callArgs`, and `scannedFiles` in that file.

- `scanCode` checks delete-call argument text for the literal `recursive: true`, plus the existing unconditional deletion patterns. Shell strings and shell argument arrays bypass that check. Its argument reader balances parentheses without accounting for quoted text. See `skills/10x-pipeline/test/no-recursive-delete.test.mjs:144` and `skills/10x-pipeline/test/no-recursive-delete.test.mjs:155`.
- `scanProse` checks the first flag after `rm` and permits lines stating the ban or its harness rationale. Existing regressions distinguish these explanations from words such as `banner`, `bandwidth`, and `blocked`. See `skills/10x-pipeline/test/no-recursive-delete.test.mjs:147` and `skills/10x-pipeline/test/no-recursive-delete.test.mjs:177`.
- Discovery walks four directories, accepts `.mjs`, `.js`, `.md`, and `.json`, and excludes this test and ADR-016. The repository test dispatches JavaScript to `scanCode` and other files to `scanProse`. See `skills/10x-pipeline/test/no-recursive-delete.test.mjs:135` and `skills/10x-pipeline/test/no-recursive-delete.test.mjs:185`.
- Current callers use one-argument deletion and literal `{ force: true }` options. The safe tree-removal helper finishes with one-argument `fs.rmdirSync` calls. See `skills/10x-pipeline/scripts/remove-tree.mjs:89`.
- ADR-016 documents the original scanner scope and explicitly lists variable options and `.github/` as uncovered. The current change brief supplies the extension contract. See `docs/ADR/ADR-016-no-recursive-force-delete.md:57` and `context/changes/delete-guard-gaps/change.md:37`.

### Reproduced evidence

On 2026-11-14, an in-memory probe evaluated the current scanner definitions against every example in the brief. All six JavaScript examples returned zero hits. Both split-flag prose examples returned zero hits. The existing `rm -fr build` control returned one hit. These were inert source strings passed to the scanner.

The baseline command `node --test --test-name-pattern="^guard:" skills/10x-pipeline/test/no-recursive-delete.test.mjs` passed all three guard tests with zero failures and zero skips on Node v26.13.1. The missing cases therefore need explicit regressions.

## Desired End State

One shared guard reports every banned example in the brief and discovers executable workflow or shell content under `.github/`. The repository scan and the existing safe-behavior tests pass.

| Surface | Required behavior |
| --- | --- |
| JavaScript shell strings | Report recursive shell deletion in quoted strings and template literals, including strings passed to `execSync` or `exec` and concatenated with a target. |
| JavaScript argument arrays | Report literal `rm` command arrays containing `-r`, `-R`, `-rf`, `-fr`, or `--recursive`, including flags split across elements and multiline arrays. |
| Shell and prose flags | Report recursion after preceding flags, including `rm -f -r build` and `rm -f --recursive build`, plus existing combined forms. |
| Filesystem options | For `rm`, `rmSync`, `rmdir`, and `rmdirSync`, accept an absent options argument or a transparent object literal with no `recursive` property. Report variables, expressions, spreads, every shorthand property, and every spelling or value of a `recursive` property. Explicit quoted or escaped nonrecursive property names remain permitted. |
| File discovery | Scan `.github/` alongside the existing roots and accept `.yml`, `.yaml`, and `.sh` alongside existing extensions. Route those new extensions through shell/prose checks. |
| Permitted operations | Accept single-file deletion, `{ force: true }` deletion, empty-directory removal, recursive creation and copying, and unrelated functions. |
| Explanatory text | Preserve existing line-local prohibition and harness-reason allowances, including quoted rule assertions already present in source tests. |

### Key discoveries

- Wave 5 grants this change the existing guard test file. The workflow and helper regions belong to neighboring changes. See `context/changes/WAVES.md:99`.
- Both filesystem and shell detection can stay in the existing test-local scanner. Its exported functions already return arrays of diagnostic strings. See `skills/10x-pipeline/test/no-recursive-delete.test.mjs:164`.
- The repository assertion currently has no fixture proving new file discovery. A pure string assertion alone cannot establish that a workflow enters the scan. See `skills/10x-pipeline/test/no-recursive-delete.test.mjs:230`.

## Scope and Ownership

The implementation edit surface is `skills/10x-pipeline/test/no-recursive-delete.test.mjs`, including its scanner helpers, regression cases, and repository-scan assertion. Planning artifacts belong under `context/changes/delete-guard-gaps/`, with the existing change identity advanced to `planned` after validation.

Wave ownership and the read-only archive convention apply throughout execution. The scanner's existing exclusions for its own fixture strings and ADR-016 remain part of its contract. Runtime deletion continues through the existing `removeTree` helper.

## Implementation Approach

Use one implementation phase because all affected behavior belongs to one scanner and one test file. Extend the current shell-pattern mechanism and reuse it for JavaScript source and prose. Keep filesystem-option inspection in `scanCode`, where the deletion-call invariant belongs.

Replace the literal-true check with conservative inspection of the actual second argument. Read argument boundaries structurally, respecting nesting, quoting, escaping, comments, regular-expression literals, and template interpolation so commas or parentheses inside a path expression cannot hide the options argument. Regular-expression handling must account for escaped delimiters and character classes while distinguishing division. Ambiguous or unsupported lexical structure produces a diagnostic, including when it would otherwise appear to be a one-argument call. Classify options from their own object-literal structure. Reject opaque options, every shorthand property, and properties that could introduce recursion. Normalize explicit property names so quoted or escaped nonrecursive names remain accepted. Keep this inspection inert and dependency-free.

Exercise file discovery against an isolated fixture root using the same discovery and file-dispatch path as the repository assertion. A defaulted root argument on the existing local walker is sufficient if needed. Retain its default repository behavior and avoid widening scanner exports merely for fixture access.

## Assumptions and Decisions

- Complexity is low in coupling and medium in edge-case handling. The unattended instruction resolves the skill's interview and phase-approval gates through the brief, current scanner, and Wave 5 ownership. One phase covers the complete behavior change. Evidence comes from `context/changes/delete-guard-gaps/complexity.json` and `context/changes/WAVES.md:107`.
- A `recursive` property is rejected even when its value is `false`. The brief explicitly requires an options literal with no such key in any spelling. The safe nonrecursive examples use an absent options argument or `{ force: true }`. See `context/changes/delete-guard-gaps/change.md:37`.
- Opaque computed keys and spreads are rejected because they can introduce a recursive property. Recognizable quoted, escaped, or literal-computed spellings of `recursive` also fail the same invariant. This follows the brief's fail-closed rule.
- Every shorthand property, including `{ force }`, is rejected under the brief's explicit shorthand rule. An explicit nonrecursive property such as `{ "force": true }` remains transparent and accepted. See `context/changes/delete-guard-gaps/change.md:41`.
- Keep source scanning bounded to the requested literal shell forms and delete-call options. Static source inspection has limits for arbitrary runtime-generated commands and aliases. The implementation uses Node built-ins and the existing test-local structure, as required by repository conventions.
- Every acceptance condition is locally automatable, so the phase has Automated Progress rows. The planning skill's artifact and metadata steps produce the brief and lifecycle update alongside the requested plan. The roadmap has no matching Change ID.

## Phase 1: Close scanner gaps and prove coverage

### Overview

Add the missing regressions, extend the responsible scanner mechanisms, and verify discovery and repository compatibility in the same file.

### Changes Required

#### 1. Shell-command detection

**File** `skills/10x-pipeline/test/no-recursive-delete.test.mjs`

**Intent** Extend shell detection to the missed flag positions and JavaScript representations, sharing the existing detection rules across source and prose.

**Contract** Preserve `scanCode(text)` and `scanProse(text)` diagnostic-array results. Detect recursive short flags of either case and the long recursive flag throughout a command's option sequence, including quoted argument-array flags. Keep the command and flag boundaries confined to the same command or array, with `--` ending options. Preserve explanatory-line allowances and existing `rimraf`, `shutil.rmtree`, and `find` checks.

#### 2. Filesystem-option validation

**File** `skills/10x-pipeline/test/no-recursive-delete.test.mjs`

**Intent** Enforce the brief's options invariant for every delete-call spelling already recognized by the scanner, including bare imports and promise-qualified calls.

**Contract** Identify the actual options argument despite nested path calls, quoted delimiters, regular-expression literals, or template interpolation. Accept absent options and transparent object literals without a recursive property. Report opaque arguments, spreads, every shorthand property, recursive keys in plain, quoted, escaped, or literal-computed form, unknown computed keys, and any recursive value. Explicit quoted or escaped nonrecursive keys remain accepted. Preserve creation, copying, unrelated functions, and safe deletion. Fail closed when lexical ambiguity prevents establishing the argument boundaries or options contract, including an apparent one-argument call.

#### 3. Discovery and regression coverage

**File** `skills/10x-pipeline/test/no-recursive-delete.test.mjs`

**Intent** Cover every missed form and prove that workflow and shell files actually enter the guard's discovery and dispatch path.

**Contract** Add `.github` to the scan roots and `yml|yaml|sh` to accepted extensions. Extend the existing named regression test with the full brief matrix and boundary cases below. Exercise discovery with scratch `.github/workflows/` YAML files and a shell file, check their reported relative paths, and assert safe sibling fixtures pass. Reuse `scratch()` and `removeTree` cleanup. Preserve the original repository scan and rule-placement assertions.

### Success Criteria

#### Automated Verification

- Shell regressions report JavaScript strings, argument arrays, combined flags, and split flags while accepting nonrecursive commands and preserving prose allowances.
- Filesystem regressions reject unsafe or opaque options across all four delete APIs while accepting the specified deletion, creation, and copying forms.
- Discovery fixtures report banned content in `.github` YAML and shell files through the repository scan path, and the real repository scan passes.
- The focused guard file and complete repository test suite pass on Node 24 or later with every failure or skip accounted for.
- The implementation diff respects Wave 5 ownership and preserves protected files and unrelated work.

## Testing Strategy

### Scanner regressions

First add and run the missing cases to observe the existing failures, then extend the scanner until they pass.

- Include each JavaScript row from the brief verbatim as inert source text, plus both split-flag prose rows and the combined-flag control.
- Cover `exec` and `execSync` strings, template literals, and `spawn` or `spawnSync` arrays. Include single and double quotes, uppercase recursion, recursion after a separate force flag, and multiline arrays.
- Check option boundaries using a nonrecursive `rm -f file`, a filename after `--`, and adjacent commands or separate arrays whose flags must stay separate.
- Apply the filesystem options cases to `rm`, `rmSync`, `rmdir`, and `rmdirSync`, including promise-qualified and bare-import forms already supported by `DELETE_CALL`.
- Include options variables, function-returned options, object spreads, shorthand recursion and nonrecursive shorthand such as `{ force }`, quoted keys, escaped keys, literal-computed recursive keys, opaque computed keys, `recursive: !0`, and `recursive: false`. Pair rejected recursive keys with accepted explicit nonrecursive keys such as `{ "force": true }` and an escaped spelling of `force`.
- Include paths with nested calls, commas, escaped quotes, and parentheses inside strings, plus comment and multiline boundaries. Add regular-expression paths such as `fs.rmSync(/[,)]/.test(name) ? a : b, opts)`, escaped regex delimiters, division expressions, and nested template interpolation. Pair unsafe options with absent options and `{ force: true }` controls. Check that parsing reaches the actual second argument and that unclassifiable lexical structure produces a diagnostic.
- Preserve safe one-argument calls and `{ force: true }`, recursive `mkdir` and `cp`, unrelated functions, and all existing prohibition/harness-reason assertions. Retain the false-allowance controls for `blocked`, `blockSize`, `banner`, and `bandwidth`.

### Discovery and integration

Use a scratch root with `.github/workflows/example.yml`, a `.yaml` sibling, and a `.sh` file. Assert discovery membership and detection for each through the same file-dispatch path as the real repository scan. Include safe fixtures and check existing extensions, exclusions, and `node_modules` behavior. Fixture text is scanned as data.

Direct scratch creation under this worktree through `TMPDIR` for test execution, respecting the working-directory rules. Use the existing `removeTree` procedure for fixture cleanup. Run the following commands from the worktree with that environment prepared.

```sh
node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
git diff --check
git diff --name-only
git status --short
```

Inspect the diff paths against the single-file implementation ownership. Account separately for planning artifacts and router-owned state already modified at step entry.

## Performance Considerations

The scanner reads small repository files synchronously. Keep structural scans bounded to the relevant call, literal options, or command sequence. Existing traversal and `node_modules` exclusion bound discovery. The focused and complete suite runs provide the regression check for scan cost.

## Migration Notes

The stricter guard takes effect through the existing test entry point. Current deletion callers already use the accepted forms. If the repository scan exposes a false positive, correct the shared scanner and add a case within this change's owned file. The change brief supersedes ADR-016's historical exclusions for options variables and workflow coverage.

## References

- Change brief and acceptance examples in `context/changes/delete-guard-gaps/change.md:16`.
- Wave 5 ownership in `context/changes/WAVES.md:99`.
- Current scanner, allowances, discovery, and entry point in `skills/10x-pipeline/test/no-recursive-delete.test.mjs:135`.
- Existing safe cleanup procedure in `skills/10x-pipeline/scripts/remove-tree.mjs:49`.
- Deletion invariant and original scanner assumptions in `docs/ADR/ADR-016-no-recursive-force-delete.md:33`.
- Unattended research constraint in `context/foundation/lessons.md:19`.
- Canonical Progress consumer in `skills/10x-pipeline/scripts/state.mjs:253`.

## Progress

### Phase 1: Close scanner gaps and prove coverage

#### Automated

- [ ] 1.1 Shell regressions report JavaScript strings, argument arrays, combined flags, and split flags while accepting nonrecursive commands and preserving prose allowances.
- [ ] 1.2 Filesystem regressions reject unsafe or opaque options across all four delete APIs while accepting the specified deletion, creation, and copying forms.
- [ ] 1.3 Discovery fixtures report banned content in `.github` YAML and shell files through the repository scan path, and the real repository scan passes.
- [ ] 1.4 The focused guard file and complete repository test suite pass on Node 24 or later with every failure or skip accounted for.
- [ ] 1.5 The implementation diff respects Wave 5 ownership and preserves protected files and unrelated work.
