# Drop the duplicate version from the marketplace plugin entry Implementation Plan

## Overview

The plugin version is written twice in `.claude-plugin/marketplace.json` (`metadata.version` and `plugins[0].version`) and once more in `.claude-plugin/plugin.json`. The Claude Code marketplace guide says not to set `version` in both `plugin.json` and the marketplace entry. This plan removes `plugins[0].version`, narrows the release-please path to `$.metadata.version`, makes `tools/version-check.mjs` check three fields and reject a `version` in any plugin entry, and records the change in `AGENTS.md`, ADR-008 (Amendment 3) and the two folder indexes. Afterwards each file holds the version once, and the next release PR changes exactly `plugin.json` `version`, `marketplace.json` `metadata.version`, `.release-please-manifest.json` `.` and `CHANGELOG.md`.

## Current State Analysis

- `.claude-plugin/marketplace.json:8` holds `metadata.version` and `:15` holds `plugins[0].version`, both `1.7.0`. `.claude-plugin/plugin.json:4` holds `version` `1.7.0`, `.release-please-manifest.json` holds `.` `1.7.0`.
- `release-please-config.json:12` updates `marketplace.json` with `jsonpath` `$..version`, which reaches every `version` key in the file.
- `tools/version-check.mjs:36-48` (`collect`) reads four fields, including `marketplace.json:plugins[0].version`, and throws `"<label> is missing"` for any absent field; `check` (`:51-64`) turns that into an error string and compares every field with the first. The header comment (`:1-7`) lists the four fields.
- `tools/test/version-check.test.mjs` builds scratch roots with an `entry` version (`makeRoot`, `:15-26`), names `plugins[0].version` in the drift test (`:38-44`), and asserts `$..version` plus exactly 2 `"version"` keys in the real `marketplace.json` (`:58-70`).
- `ci.yml:39` runs `node tools/version-check.mjs`. No other module imports `version-check.mjs`; `skills/10x-pipeline/test/agents.test.mjs:281-282` reads only `plugins[0].name` and `.source`; the router's provenance reads only `plugin.json` `version` (`docs/REFERENCE.md:297`).
- `AGENTS.md:79` ("One version, four fields") and the `.claude-plugin/` Layout bullet describe the four fields; `AGENTS.md` is 10681 of 12288 allowed bytes (`tools/test/agents-md-size.test.mjs`).
- ADR-008 Decision (`docs/ADR/ADR-008-release-packaging-and-semver.md:18`) names `plugins[0].version`; its README row (`docs/ADR/README.md:14`) says "one version in four fields". The test index row (`skills/10x-pipeline/test/README.md:106`) describes the version-check test.
- `docs/REFERENCE.md` does not name the version fields (grep for `metadata.version`, `plugins[0]`, `version-check`: no hits), so it needs no change.
- `claude plugin validate .` passes on the repository today.

## Desired End State

- `marketplace.json` has one `version` key, `metadata.version`; no entry in `plugins` has `version`.
- `release-please-config.json` updates `marketplace.json` at `$.metadata.version` only.
- `node tools/version-check.mjs` checks `plugin.json:version`, `marketplace.json:metadata.version` and `.release-please-manifest.json:.`, and fails with a message naming `marketplace.json:plugins[<i>].version` when any plugin entry carries a `version` key.
- `AGENTS.md`, ADR-008 (Amendment 3, older text kept as history), `docs/ADR/README.md` and `skills/10x-pipeline/test/README.md` describe three fields.
- Verify: `node tools/version-check.mjs` prints `version-check: OK (1.7.0)`, the full suite passes, and `claude plugin validate .` passes.

### Key Discoveries:

- Marketplace reference, Top-level fields (code.claude.com/docs/en/plugins/marketplace-reference, read 2026-11-13): top-level `version` is the "Marketplace manifest version", and `metadata.description`, `metadata.version` are the "Alternate location for `description` and `version`". So `metadata.version` is the marketplace's own version, not a second location of the plugin version. It stays (see Implementation Approach).
- Same page, Plugin entries: "When `plugin.json` also sets `version`, `plugin.json` takes precedence and `claude plugin validate` warns." Host-marketplace page, Release a new version: "Don't set `version` in both `plugin.json` and the marketplace entry." The entry field is redundant for users: `plugin.json` already wins, so removing it changes nothing they install.
- release-please's json updater rewrites only paths that match; with `$.metadata.version` it never touches or re-adds `plugins[0].version`.
- The existing test `release-please-config.json updates every file the guard reads` counts `"version"` keys in the real `marketplace.json`; with the count set to 1 it also catches a new top-level `version` key, which the narrowed path would no longer update.

## What We're NOT Doing

- Not dropping `metadata.version`: the guide treats it as the marketplace manifest version, a different field from the plugin version, and the change.md rule drops it only if it were an alternate location of the same value.
- Not moving `metadata.version` or `metadata.description` to the top level (also valid per the guide, but not asked and would churn the release path).
- Not changing `plugin.json`, `.release-please-manifest.json`, `ci.yml`, `release.yml` or `CHANGELOG.md`.
- Not changing `docs/REFERENCE.md`: it does not name the version fields.
- Not editing the version value by hand (AGENTS.md Releases rule); only the key in the entry is removed.
- Not adding `claude plugin validate` to CI: the runner has no Claude Code CLI.

## Implementation Approach

One code phase that keeps the suite green in a single commit (data, config, guard and its test change together, because the old test asserts the four-field shape), then one docs phase. The guard keeps its shape: `collect` returns the three version fields, and `check` adds one rule that any `plugins[i]` object owning a `version` key is an error, so a stray entry version cannot come back through a hand edit or a revert. `check` keeps its contract of returning strings and never throwing.

## Phase 1: Three fields and the entry guard

### Overview

Remove the entry version, narrow the release-please path, update the guard and its tests.

### Changes Required:

#### 1. Marketplace manifest

**File**: `.claude-plugin/marketplace.json`

**Intent**: Delete the `version` key from `plugins[0]`, so the plugin version is not set in both `plugin.json` and the entry.

**Contract**: `plugins[0]` keeps `name`, `source`, `description`; `metadata.version` stays `1.7.0`. File stays valid JSON with the same 2-space layout.

#### 2. release-please path

**File**: `release-please-config.json`

**Intent**: Point the `marketplace.json` extra-file at the one remaining field, so the release PR writes only `metadata.version`.

**Contract**: `extra-files` entry for `.claude-plugin/marketplace.json` has `"jsonpath": "$.metadata.version"`; the `plugin.json` entry (`$.version`) is unchanged; still 2 entries.

#### 3. Version guard

**File**: `tools/version-check.mjs`

**Intent**: Check three fields and fail when a plugin entry carries a `version`, with the header comment updated to match.

**Contract**:
- `collect(root)` returns `[["plugin.json:version", …], ["marketplace.json:metadata.version", …], [".release-please-manifest.json:.", …]]` and still throws `"<label> is missing"` / `"<rel> cannot be read"` / `"<rel> is not valid JSON"`.
- `check(root)` returns, in addition to the existing SemVer and drift errors, one error per entry `i` of `marketplace.json` `plugins` that owns a `version` key (any value, including `null` or a non-string): `marketplace.json:plugins[<i>].version must not be set (plugin.json:version is the plugin version)`. It never throws; a non-array `plugins` adds no entry error.
- CLI output and exit codes unchanged (`version-check: OK (<version>)`, exit 0; error list, exit 1).

#### 4. Guard tests

**File**: `tools/test/version-check.test.mjs`

**Intent**: Move the tests to the three-field shape and cover the new rule.

**Contract**:
- `makeRoot` writes a `plugins[0]` without `version` by default and takes an option to add an entry version (for example `entry`, absent by default).
- Equal valid versions in three fields pass (including the pre-release/build case).
- Drift test names `marketplace.json:metadata.version` for a drifted `meta`.
- New test: a `version` in `plugins[0]` fails with a message matching `plugins\[0\]\.version must not be set`, also when it equals the other three; a `version` only in a second entry fails naming `plugins[1]`; a `null` entry version fails.
- Config test: `marketplace.json` jsonpath is `$.metadata.version`, `extra.length` is 2, the real `marketplace.json` holds exactly 1 `"version"` key (comment updated: a new key would not be updated by the narrowed path), and no real entry has `version`.
- The SemVer, missing-file/field and CLI tests keep passing with the three-field fixtures.

### Success Criteria:

#### Automated Verification:

- `node tools/version-check.mjs` exits 0 and prints `version-check: OK (1.7.0)`
- `node --test tools/test/version-check.test.mjs` passes, including the new entry-version cases
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes
- `node -e` check: `.claude-plugin/marketplace.json` parses and `plugins.every(p => !("version" in p))` is true

#### Manual Verification:

- `claude plugin validate .` on the repository root ends with `✔ Validation passed` and shows no version warning

**Implementation Note**: After this phase and its automated verification pass, pause for the manual check before Phase 2. Phase blocks use plain bullets; the checkboxes live in `## Progress`.

---

## Phase 2: Docs and ADR-008 Amendment 3

### Overview

Describe the three fields where the repository documents them, as an amendment that keeps the old text as history.

### Changes Required:

#### 1. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Replace "One version, four fields" with a three-field rule, and say in the `.claude-plugin/` Layout bullet that the plugin entry carries no `version`.

**Contract**: Releases bullet reads in substance: **One version, three fields.** `plugin.json` `version`, `marketplace.json` `metadata.version` and the manifest `.` hold the same version; the `plugins[0]` entry carries no `version` (Claude Code reads `plugin.json` first; ADR-008 Amendment 3). release-please updates them together; never edit them by hand. `tools/version-check.mjs` fails on drift or an entry `version` in `ci.yml`. File stays at or under 12288 bytes.

#### 2. ADR-008

**File**: `docs/ADR/ADR-008-release-packaging-and-semver.md`

**Intent**: Add Amendment 3 for this change and mark the superseded Decision sentence, without rewriting it.

**Contract**:
- Status line adds `and 2026-11-13 (Amendment 3: no version in the marketplace plugin entry)` (wording may follow the existing list form).
- Decision paragraph keeps its sentence and adds a parenthetical `(Superseded: plugins[0].version was removed, see Amendment 3.)`, the form the Context bullets already use.
- New section `## Amendment 3: no version in the marketplace plugin entry (change marketplace-entry-version)` with `### Context` (guide quotes with URLs and read date; entry field redundant because `plugin.json` wins), `### Rules` as GIVEN/WHEN/THEN scenarios (a plugin entry MUST NOT carry `version`; release-please MUST update `marketplace.json` only at `$.metadata.version`; `metadata.version` stays as the marketplace manifest version and MUST equal the plugin version), `### Consequences` (three fields; guard rejects an entry version; next release PR changes `plugin.json`, `marketplace.json` `metadata.version`, the manifest and `CHANGELOG.md`, to be confirmed on that PR), `### Alternatives considered` table (drop `metadata.version` too: rejected, it is the marketplace version per the reference; keep both with the guard: rejected, the guide advises against it; omit `version` everywhere and track commits: rejected, release-please tags and SemVer releases are the release model of this ADR).

#### 3. Folder indexes

**Files**: `docs/ADR/README.md`, `skills/10x-pipeline/test/README.md`

**Intent**: Keep the index rows true.

**Contract**: ADR-008 row says "one version in three fields" (or equivalent) and appends "Amendment 3: no version in the marketplace plugin entry". Test index row for `version-check.test.mjs` reads in substance: `tools/version-check.mjs`: three version fields equal and valid SemVer, no `version` in a marketplace plugin entry.

### Success Criteria:

#### Automated Verification:

- `grep -n "four fields\|plugins\[0\]\.version" AGENTS.md docs/ADR/README.md skills/10x-pipeline/test/README.md tools/version-check.mjs` returns no line that describes `plugins[0].version` as a version field
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes (includes the `AGENTS.md` size and no-import tests)
- `node tools/version-check.mjs` exits 0

#### Manual Verification:

- ADR-008 reads as an amendment: the Decision sentence and older amendments are unchanged except the Status line and the one Superseded parenthetical
- After the next release PR opens, its diff changes only `.claude-plugin/plugin.json` `version`, `.claude-plugin/marketplace.json` `metadata.version`, `.release-please-manifest.json` `.` and `CHANGELOG.md`

---

## Testing Strategy

### Unit Tests:

- `tools/test/version-check.test.mjs`: three equal fields pass; drift in each field is named; entry `version` in `plugins[0]`, in `plugins[1]`, equal to the others, and `null` all fail; config path and key count on the real repository.

### Integration Tests:

- The CLI test runs `tools/version-check.mjs` on the repository (exit 0, OK line).

### Manual Testing Steps:

1. `claude plugin validate .` from the worktree root: passes, no version warning.
2. On the next release PR: read the diff and confirm the four files and fields above, nothing in `plugins[0]`.

## Migration Notes

None for users: Claude Code already takes the plugin version from `plugin.json` when both are set, so installed copies see the same version. The release-please change takes effect on the next release PR.

## References

- Change: `context/changes/marketplace-entry-version/change.md`
- Claude Code marketplace reference, Top-level fields and Plugin entries: https://code.claude.com/docs/en/plugins/marketplace-reference (read 2026-11-13)
- Claude Code host-marketplace guide, Release a new version: https://code.claude.com/docs/en/plugins/host-marketplace (read 2026-11-13)
- Guard: `tools/version-check.mjs:36-64`; tests: `tools/test/version-check.test.mjs:15-70`
- ADR-008 and its amendment pattern: `docs/ADR/ADR-008-release-packaging-and-semver.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Three fields and the entry guard

#### Automated

- [ ] 1.1 `node tools/version-check.mjs` exits 0 and prints `version-check: OK (1.7.0)`
- [ ] 1.2 `node --test tools/test/version-check.test.mjs` passes, including the new entry-version cases
- [ ] 1.3 `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes
- [ ] 1.4 `node -e` check: `.claude-plugin/marketplace.json` parses and `plugins.every(p => !("version" in p))` is true

#### Manual

- [ ] 1.5 `claude plugin validate .` on the repository root ends with `✔ Validation passed` and shows no version warning

### Phase 2: Docs and ADR-008 Amendment 3

#### Automated

- [ ] 2.1 `grep -n "four fields\|plugins\[0\]\.version" AGENTS.md docs/ADR/README.md skills/10x-pipeline/test/README.md tools/version-check.mjs` returns no line that describes `plugins[0].version` as a version field
- [ ] 2.2 `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes (includes the `AGENTS.md` size and no-import tests)
- [ ] 2.3 `node tools/version-check.mjs` exits 0

#### Manual

- [ ] 2.4 ADR-008 reads as an amendment: the Decision sentence and older amendments are unchanged except the Status line and the one Superseded parenthetical
- [ ] 2.5 After the next release PR opens, its diff changes only `.claude-plugin/plugin.json` `version`, `.claude-plugin/marketplace.json` `metadata.version`, `.release-please-manifest.json` `.` and `CHANGELOG.md`
