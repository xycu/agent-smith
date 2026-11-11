# readReview label parity Implementation Plan

## Overview

`readReview` (`skills/10x-pipeline/scripts/state.mjs:194`) reads `**Verdict**:` and `**Findings**:` in one strict form, while `readFindings` (same file, `:166-171`) accepts `**X**:` and `**X:**`. A valid review in the second form, with a trailing period, or with an emoji before the verdict word reads as no verdict, fails the step check (`flow.mjs:479`), and halts the run after three attempts. Give the two header lines the label tolerance of the finding lines. GitHub issue #91.

## Current State Analysis

- Verdict: `/\*\*Verdict\*\*:\s*\[?([A-Za-z ]+?)\]?\s*$/m` needs the `**Verdict**:` form and the verdict word at the end of the line.
- Findings: `/\*\*Findings\*\*:[^\n]*/`; the `**Findings:**` form is missed, so counts read 0 and a `REVISE`/`NEEDS ATTENTION` review looks cleaner than it is (breaks lesson "Never read a verdict as cleaner than its listed findings", `context/foundation/lessons.md`).
- `readFindings` already uses `(?:\*\*|:\*\*)` for Severity and `(?:\*\*:|:\*\*)` for Decision, and ignores emoji by scanning for the keyword.
- Verdict consumers compare exact strings: `SOUND`, `REVISE`, `RETHINK`, `NEEDS ATTENTION`, `REJECTED` (`flow.mjs:646-740`).
- Review prompts and the `helpers.mjs` writer use `- **Verdict**: X`; no test covers other forms.

### Key Discoveries:

- `state.mjs:200-205`: only place the header lines are parsed.
- `readReview` is also used by `flow.mjs:478, 585, 586`; all read `verdict`, `critical`, `warnings`, so one fix reaches every caller.
- `openCounts` adds `review.critical - parsedCritical` as open, so a correct header count matters for the open-findings routing.

## What We're NOT Doing

- No change to `readVerdict` of `verify.md` (OpenSpec, `openspec.mjs`); it has its own `Verdict:` format.
- No change to the review prompts, `policy.json`, `helpers.mjs` or the log entry shape.
- No new verdict vocabulary: an unknown word still reads as itself, as today.
- No ADR (a parser tolerance, no new decision of record).

## Implementation Approach

Share one label fragment between `readReview` and `readFindings`. The label matches `**Name**:` or `**Name:**`. For the verdict, skip any non-letters after the label (`[`, emoji, spaces), then take the leading run of upper-case words (`NEEDS ATTENTION`); if the line has no upper-case word, fall back to the first run of letters and spaces, upper-cased, as today. Text after the run (period, `]`, prose, `- see F1`) is ignored. The Findings line uses the same label.

## Phase 1: Tolerant header labels

### Overview

Parser change plus tests plus one doc line.

### Changes Required:

#### 1. Parser

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Make `readReview` read the Verdict and Findings lines with the label forms `readFindings` accepts, and allow emoji before and text after the verdict word.

**Contract**: `readReview(file)` return shape unchanged. Verdict regex becomes `/\*\*Verdict(?:\*\*:|:\*\*)[^A-Za-z\n]*([A-Za-z]+(?: [A-Za-z]+)*)/` applied then trimmed to the leading upper-case words when present; Findings uses `/\*\*Findings(?:\*\*:|:\*\*)[^\n]*/`. A verdict line that is only prose after the label (no letters) reads `null`, as today. Update the comment above `readFindings` or `readReview` to say both label forms are read for the header lines too.

#### 2. Tests

**File**: `skills/10x-pipeline/test/openfindings.test.mjs`

**Intent**: Cover the forms through `readReview` on files the test writes itself (`helpers.mjs` stays unchanged).

**Contract**: Cases, each asserting `verdict`, `critical`, `warnings`: `**Verdict:** APPROVED`; `**Verdict**: APPROVED.`; `**Verdict**: ✅ APPROVED`; `**Verdict**: [NEEDS ATTENTION]`; `**Verdict:** NEEDS ATTENTION - see F1`; `**Findings:** 1 critical, 2 warnings` reads 1 and 2; the existing `- **Verdict**: REVISE` form unchanged; a `**Verdict**:` line with no letters reads `null`. One routing-level case: a `**Verdict:** NEEDS ATTENTION` / `**Findings:** 1 critical` review makes `next` route to `fix` (not a failed step), using the existing helpers in that file.

#### 3. Reference

**File**: `docs/REFERENCE.md`

**Intent**: In "Review routing on open findings", first bullet, state that the `Verdict` and `Findings` header lines accept both `**Label**:` and `**Label:**`, emoji before the verdict word and text after it.

**Contract**: one sentence added; no other section touched.

### Success Criteria:

#### Automated Verification:

- New label-form tests pass: `node --test skills/10x-pipeline/test/openfindings.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Router still starts: `node skills/10x-pipeline/scripts/route.mjs status review-verdict-labels` in a scratch project prints valid JSON

#### Manual Verification:

- Reading the diff: `state.mjs` changes only `readReview` and its comment; `readFindings` behavior is unchanged.
- A review written with `**Verdict:** SOUND` and `**Findings:** 0 critical, 0 warnings` is not re-run as a failed step in a scratch run.

## Testing Strategy

### Unit Tests:

- `readReview` on each label/emoji/trailing-text form; counts from both Findings forms; no-letter verdict is `null`.

### Integration Tests:

- One `next` routing case (above).

## Performance Considerations

None; one regex per review read.

## Migration Notes

None. Reviews in the old form read exactly as before (all 62 archived reviews).

## References

- Issue: GitHub #91; change file `context/changes/review-verdict-labels/change.md`
- Similar tolerance: `skills/10x-pipeline/scripts/state.mjs:166-171`
- Lesson: `context/foundation/lessons.md` ("Never read a verdict as cleaner than its listed findings")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tolerant header labels

#### Automated

- [x] 1.1 New label-form tests pass: `node --test skills/10x-pipeline/test/openfindings.test.mjs`
- [x] 1.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 1.3 Router still starts: `node skills/10x-pipeline/scripts/route.mjs status review-verdict-labels` in a scratch project prints valid JSON

#### Manual

- [x] 1.4 Reading the diff: `state.mjs` changes only `readReview` and its comment; `readFindings` behavior is unchanged. — evidence: evidence/judgment-readreview-diff.md
- [x] 1.5 A review written with `**Verdict:** SOUND` and `**Findings:** 0 critical, 0 warnings` is not re-run as a failed step in a scratch run. — evidence: evidence/script-sound-output.txt
