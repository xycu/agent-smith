# readReview label parity — Plan Brief

> Full plan: `context/changes/review-verdict-labels/plan.md`

## What & Why

`readReview` reads the `Verdict` and `Findings` header lines in one strict form. A valid review written as `**Verdict:** X`, `**Verdict**: X.` or with an emoji reads as no verdict, counts as a failed step, and halts the run after three attempts. `**Findings:**` reads as 0 counts, which makes a review look cleaner than it is.

## Starting Point

`readFindings` in `state.mjs` already accepts both label forms and ignores emoji. `readReview` (`state.mjs:194`) does not. All 62 archived reviews use `**Verdict**:`, so it has not hit this repo yet.

## Desired End State

Both header lines read with the same label tolerance as the finding lines; text after the verdict word is ignored. Old-form reviews read exactly as before.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Label forms | `**X**:` and `**X:**` for Verdict and Findings | Same as `readFindings`, as the issue asks. |
| Verdict word | Leading run of upper-case words after skipping non-letters; fallback to first letter run | Keeps `NEEDS ATTENTION` whole, drops `.`, emoji, `]` and trailing prose. |
| Docs/ADR | One sentence in REFERENCE, no ADR | Parser tolerance, no new decision. |
| Tests | Added to `openfindings.test.mjs` | Keeps `helpers.mjs` and the AGENTS.md file list unchanged. |

## Scope

**In scope:** `readReview` in `state.mjs`, tests, one REFERENCE sentence.

**Out of scope:** `readVerdict` of OpenSpec `verify.md`, review prompts, policy, new verdict words.

## Architecture / Approach

Reuse the `readFindings` label alternation in the two regexes of `readReview`; no signature or return-shape change, so every caller (`flow.mjs`) benefits.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tolerant header labels | Parser, tests, doc line | Trailing prose merging into the verdict word |

**Prerequisites:** none.
**Estimated effort:** one short session.

## Open Risks & Assumptions

- Assumes verdicts are written upper-case; a lower-case verdict uses the letter-run fallback, so lower-case prose after it would merge into the word.
- Overlaps with other issue changes in `state.mjs` and `docs/REFERENCE.md`; rebase on merge.

## Success Criteria (Summary)

- Every form in the issue reads the right verdict and counts.
- Full test suite stays green; old forms unchanged.
