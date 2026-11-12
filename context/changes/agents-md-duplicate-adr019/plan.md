# Remove the repeated ADR-019 sentence from AGENTS.md

## Overview

Line 57 of `AGENTS.md` (the `docs/ADR/` bullet) states the ADR-019 summary twice. Delete the second copy, the one after the ADR-021 sentence. Keep the first, which sits in ADR order between ADR-018 and ADR-020. Docs only.

## Findings

- The bullet holds one summary each for ADR-009 to ADR-021, and ADR-019 twice. ADR-001 to ADR-008 have no summary, which is intended.
- The opening list ("ADR-001 to ADR-011), ADR-012, ... ADR-021") matches the 21 files in `docs/ADR/` (ADR-001 to ADR-021). No mismatch, so nothing else changes.
- `skills/10x-pipeline/test/no-recursive-delete.test.mjs` scans `AGENTS.md`; the new text adds no banned command.

## Phase 1: Delete the second ADR-019 sentence

**File**: `AGENTS.md`

In line 57, remove the trailing sentence `ADR-019 covers the \`usage\` command ... and the cut-off points in both skills.` that follows the ADR-021 sentence (preceded by one space). Leave the first copy, between ADR-018 and ADR-020, untouched. The bullet then ends with the ADR-021 sentence.

Commit type: `docs:`.

### Success criteria

#### Automated Verification:

- `grep -o "ADR-019 covers" AGENTS.md | wc -l` prints `1`.
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes.

Also check by reading the bullet (no Progress row): `grep -o "ADR-0[0-9][0-9] [a-z]*" ` on line 57 shows ADR-009 to ADR-021 once each in ascending order after the opening list. Each summary starts `ADR-0NN covers`, except ADR-016, which starts `ADR-016 bans`. The bullet ends with the ADR-021 sentence.

## Out of scope

Code, policy, prompts, other `AGENTS.md` lines, ADR files.

## Assumptions

- No other summary needs a fix: the opening list was compared with the files in `docs/ADR/`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Delete the second ADR-019 sentence

#### Automated

- [x] 1.1 `AGENTS.md` holds exactly one `ADR-019 covers` sentence: `test "$(grep -o 'ADR-019 covers' AGENTS.md | wc -l)" -eq 1` — b77d8cb
- [x] 1.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — b77d8cb
