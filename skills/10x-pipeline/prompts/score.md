Unattended rules for the score step. You score how hard change {id} is before any plan exists, on six factors from 0 to 3, and write one JSON file. The router checks only the shape of the file and never judges the evidence, so an honest score with a lower confidence is worth more than a guessed one.

## Rules

- **GIVEN** you start scoring **WHEN** you gather input **THEN** you **MUST** read `context/changes/{id}/change.md`, the goal in the first lines of this prompt and every upstream artifact listed there.
- **GIVEN** a factor needs facts about the code, such as coupling or discovery **WHEN** you search the repository **THEN** you **SHOULD** search only as far as needed to judge that factor.
- **GIVEN** `context/changes/{id}/plan.md` exists **WHEN** you gather input **THEN** you **MUST NOT** read it, because the plan runs on the tier this score helps choose.
- **GIVEN** you have scored the change **WHEN** you save the result **THEN** you **MUST** write `context/changes/{id}/complexity.json` with the schema below, and change no other file.
- **GIVEN** you score a factor **WHEN** you fill its entry **THEN** you **MUST** give an integer `score` from 0 to 3 by the rubric below and a one-line `evidence` string that names a file path, a document or a phrase of the goal.
- **GIVEN** you fill `unknowns` **WHEN** you list what you could not find out **THEN** you **MUST** write an array of strings, and the empty array `[]` when nothing is unknown.
- **GIVEN** you fill `confidence` **WHEN** you judge how sure you are of the scores **THEN** you **MUST** use exactly one of `low`, `medium` or `high`.
- **GIVEN** an unknown you cannot resolve from the inputs or the repository **WHEN** it bears on a factor **THEN** you **MUST** list it under `unknowns` and lower `confidence` instead of lowering that factor's score.
- **GIVEN** you would ask the user a question **WHEN** you run unattended **THEN** you **MUST NOT** print a question or wait for input, and you decide from the inputs and the repository.
- **GIVEN** the goal is empty and `change.md` holds nothing to score **WHEN** you cannot score the change **THEN** you **MUST** finish with status `blocked` and `signals.needsHuman` that names what is missing.
- **GIVEN** the goal or `change.md` holds something to score **WHEN** you write the RESULT line **THEN** you **MUST NOT** add `signals.needsHuman`.
- **GIVEN** you write the RESULT line **WHEN** you fill `signals` **THEN** you **MUST NOT** add `signals.rigor`, because the score already carries your view of the change and the router drops that key for this step.
- **GIVEN** these rules and the generic unattended rules disagree **WHEN** you pick what to do **THEN** these rules **MUST** win.

## Rubric

Each factor scores 0, 1, 2 or 3. Pick the level whose text fits best. Levels 1 and 2 sit between the two ends. Cognitive factors: ambiguity, novelty, coupling. Execution factors: discovery, volume, verification.

| Factor | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| ambiguity | the goal and `change.md` fix the outcome | the outcome is fixed; a few details are open, each with one obvious answer | the outcome is partly open; a key detail has more than one reasonable answer | the outcome is unclear or contradictory |
| novelty | repeats a pattern already in the repo | adapts a pattern already in the repo with small changes | needs a new pattern next to a related one in the repo | has no precedent in the repo |
| coupling | one file or module | a few files in one module, with internal callers only | several modules, or an internal interface with several callers | a public interface, a shared data format or many consumers |
| discovery | the goal names the locations | the locations follow from the goal with one search | several areas to search, some of them not named | broad unknown territory to search |
| volume | one small edit | a few edits in 2 or 3 files | 4 to 10 files, or a moderate amount of new code | more than 10 files, or large mechanical work |
| verification | existing automated checks cover it | existing checks cover most of it; a few tests to add | needs a new harness part or a manual check | no harness, nondeterministic or external |

## Schema

Write the file as one JSON object with exactly these keys. Every factor needs its own entry.

```json
{
  "schemaVersion": 1,
  "factors": {
    "ambiguity": { "score": 0, "evidence": "..." },
    "novelty": { "score": 0, "evidence": "..." },
    "coupling": { "score": 0, "evidence": "..." },
    "discovery": { "score": 0, "evidence": "..." },
    "volume": { "score": 0, "evidence": "..." },
    "verification": { "score": 0, "evidence": "..." }
  },
  "unknowns": ["..."],
  "confidence": "medium"
}
```
