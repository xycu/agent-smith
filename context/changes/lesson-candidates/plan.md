# Lesson candidates in the pipeline report Implementation Plan

## Overview

The implementation review (`/10x-impl-review`) has no section for lessons. This change lets the review subagent report lesson candidates in an optional key of its `RESULT` `signals`, `signals.lessonCandidates`. The router sanitizes them, keeps them on the `impl-review` log entry, and lists them in `report.md` under `## Lesson candidates`, each as a ready `/10x-lesson <seed>` command. Nothing runs `/10x-lesson` unattended: the skill is an interview, so a human runs the command from the report. `SKILL.md`, the README and ADR-003 are updated.

## Current State Analysis

- `cleanSignals` (`skills/10x-pipeline/scripts/route.mjs:310-323`) keeps two keys, `rigor` and `needsHuman`, and drops the rest. `attachResult` (`route.mjs:331-374`) stores the cleaned object as `last.signals` and never writes the raw one to `run.jsonl`. The readers of a stored `signals` object (`route.mjs:460`, `:910`, `:1849`) test single keys, so one more key changes none of them.
- `buildReport` (`route.mjs:228-269`) writes goal, rigor, outcome, archive lines, a step table, a totals line and a `## Skipped steps` section. `finishRun` writes it at every end of a run (`done`, `archive`, `halt`), and an archive run writes it before the folder moves.
- The `impl-review` prompt is a plain string (`policy.json:156`); `impl-review-warn` is an array of that string plus `@prompts/impl-review-warn.md` (`policy.json:200-203`). `promptText` (`route.mjs:1574-1588`) joins array parts with a newline and resolves `@prompts/<file>.md`; `render` (`route.mjs:1562`, call at `:1908-1912`) then fills `{name}` variables in one pass.
- The shared `suffix` (`policy.json:151`) shows a `RESULT` example whose `signals` holds only `needsHuman` and `rigor`, and it names `lessons.md` only as one evidence source for unattended decisions. It does not tell a subagent to read the file, so the new prompt must say so itself.
- `/10x-impl-review` has no lesson section; its report holds findings `### F<n>` and a verdict only. `/10x-lesson <seed>` takes inline text as a seed for its Rule field and asks four questions itself (research `context/archive/2026-10-30-rigor-levels/research.md:48`, `:192-197`; `10x-lesson/SKILL.md`, "Initial Response" step 1).
- `context/foundation/lessons.md` does not exist in this repo.
- `test/executors.test.mjs` reads `POLICY.prompts["impl-review"]` as a string in two places. `:275` runs `const PLAIN_REVIEW = fill(POLICY.prompts["impl-review"])` at module level, and `fill` calls `text.replace(...)`, so an array throws a TypeError at import and every test in the file fails. `:567` pins `POLICY.prompts["impl-review-warn"]` to `[POLICY.prompts["impl-review"], "@prompts/impl-review-warn.md"]`. Both lines change with the policy. The `startsWith(PLAIN_REVIEW)` checks at `:522` and `:565` still hold, because the lessons rules come after the first part.

## Desired End State

- A run whose implementation review subagent ends its `RESULT` line with `"signals":{"lessonCandidates":["..."]}` leaves a `## Lesson candidates` section in `report.md` with one line per candidate: `` - `/10x-lesson <seed>` (step <n>) ``.
- A run with no candidates has no such section and an unchanged report.
- `run.jsonl` holds only the cleaned candidates (at most 3 per step, at most 200 code points each, cut on a word boundary, one line, no backticks).
- The review prompt states both limits and the `RESULT` shape, so a cut is the exception.
- The router and the orchestrator never run `/10x-lesson`.
- Verify: `node --test skills/10x-pipeline/test/*.test.mjs` passes; a scratch run with a fixture result shows the section in `report.md`.

### Key Discoveries:

- `cleanSignals` is the existing whitelist-and-type sanitizer for `signals` and the natural home for the new key (`route.mjs:310`). It has no step argument today; the call site (`route.mjs:368`) knows `last.step`.
- The report is the only router file that survives an archive (README "Archive (opt-in)"), so candidates in `report.md` also survive it.
- `render` turns an unknown `{name}` into an empty string, so each new prompt variable must be added to the `render` call or the prompt gets an empty number. Its pattern is `\{(\w+)\}`, so a JSON fragment such as `{"lessonCandidates":[...]}` in a prompt file is left as it is.
- `String.prototype.slice` counts UTF-16 code units and can split a surrogate pair; `Array.from(text)` counts code points. The `needsHuman` cut (`route.mjs:319`) uses `slice`; the new cut does not copy it.
- Prompt files are checked line by line for the GIVEN/WHEN/THEN form with one bold RFC 2119 keyword (`test/rules.test.mjs`, ADR-004); a new prompt file is covered automatically, and a prose line may hold no bold keyword and no `REQUIRED`/`OPTIONAL`/`SHALL`/`RECOMMENDED`.

## What We're NOT Doing

- Running `/10x-lesson`, or writing `context/foundation/lessons.md`, from the router, the orchestrator or any pipeline subagent.
- Adding a lesson-candidate section to `/10x-impl-review` itself, or editing a toolkit skill.
- A new step, a new template step name or any extra step budget: the candidates ride on the existing `impl-review` step.
- Reading `lessons.md` in the router to drop duplicates. The prompt asks the subagent to read it and check; the router only drops exact repeats (case-insensitive) among its own candidates.
- A run-level cap. The cap is per review; a run with k accepted reviews lists at most 3k candidates (see Decisions).
- Candidates from `plan-review`, `fix` or any other step. Other steps' `lessonCandidates` are dropped.
- Printing candidates in the `done`, `archive` or `halt` JSON, in the orchestrator's final message or in `status` output. The report is the carrier; the final message points to it as before.
- Changing `baseline-policy.json`, `compare`, `pr-comment.mjs` or the PR comment format. The report is posted as it is, as for any report text.
- Escaping Markdown or HTML inside a seed. The seed sits in a code span, where markup is literal; the backtick is the only character that could end the span, and it is replaced.
- A policy switch that turns the feature off with a value of 0 (see Decisions).
- Editing the roadmap: S-10 is already `planning` in the working tree, set at planning time. `/10x-implement` advances it.

## Implementation Approach

Four small phases, each tested through the real CLI in scratch projects, in the order data, report, prompt, docs. Phase 1 adds the `lessons` limits to the policy and the sanitizer. Phase 2 renders the section from the stored entries. Phase 3 asks the subagent for the candidates, with both limits from the policy filled in by `render`. Phase 4 syncs the docs. Phases 1 and 2 are testable with fixture results before the prompt exists, so the prompt (the part that "yields noise if weak") lands last and its wording is checked by the rule-form test.

Decisions made without a human (owner was not available; evidence cited):

| Decision | Choice | Evidence |
| --- | --- | --- |
| Carrier | `signals.lessonCandidates`, an array of strings | Research Follow-up 1 proposes carrying them in `signals` (`roadmap.md:213`); `cleanSignals` is the existing sanitizer |
| Source step | `impl-review` only | Scope in `change.md`: "from impl-review"; keeps noise out of other steps |
| Limits | at most 3 per review, 200 code points each, policy keys `lessons.maxCandidates` and `lessons.maxChars` | Same pattern as `NEEDS_HUMAN_MAX` (`route.mjs:312`); a small cap bounds noise from a weak prompt (roadmap S-10 risk) |
| Limits in the prompt | the prompt states both numbers (`{lessonMax}`, `{lessonChars}`) and shows the `RESULT` fragment | Plan review F2 Fix A; the suffix example has no `lessonCandidates`, and a rule sentence often passes 200 characters |
| Over-long candidate | cut to `maxChars` code points, back to the last space when the cut falls inside a word | Plan review F2 Fix A; dropping it (Fix B) would empty the feature for a verbose subagent; code points never split a surrogate pair |
| Which reviews count | every `impl-review` entry with `ok` true, in order, repeats dropped | A bug class found in a pass that a later `fix` repaired is still a lesson |
| Run-level bound | none: at most 3 per review, so at most 9 on the longest `standard` or `thorough` path (three reviews, README "Budget") | Plan review F4; a run-level cut would drop the candidates of later reviews, which are often the ones that recur; cost to reverse is one `slice` in `buildReport` |
| Seed | the candidate text, whitespace and control characters collapsed to one space, format characters (`\p{Cf}`, such as bidi overrides) removed, backticks replaced by `'` | The line sits in a Markdown code span; the skill takes free text (`10x-lesson/SKILL.md`, "Initial Response") |
| Untrusted text | accepted: no Markdown or HTML escaping, no strip of a leading `/` | Plan review F6; the seed is literal inside its code span, a human pastes it, and `/10x-lesson` is an interview that writes nothing without a confirm; cost to reverse is one function |
| Invalid policy value | falls back to the default (3, 200) | Keeps the prompt numbers and the sanitizer in step; to turn the feature off a project overrides the `impl-review` prompts |
| Empty case | no section | A run with nothing to say keeps today's report |
| `AGENTS.md` | one line each for the new test file and prompt file | Its Project Structure lists every test and prompt file |

## Phase 1: Policy limits and signal sanitizer

### Overview

Add the `lessons` limits and let `cleanSignals` keep `lessonCandidates` for an `impl-review` entry, so `run.jsonl` carries clean candidates.

### Changes Required:

#### 1. Policy limits

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add a top-level `lessons` block with the two limits, so a project can tune them in `context/foundation/agent-smith-policy.json`.

**Contract**: `"lessons": { "maxCandidates": 3, "maxChars": 200 }`. Both are positive safe integers; any other value is read as the default.

#### 2. Sanitizer

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Extend `cleanSignals` with the step name. For `impl-review` only, keep `lessonCandidates` when it is an array: take the string items, clean each, cut each to `maxChars`, drop empties and case-insensitive repeats, keep the first `maxCandidates`. A key that is not an array, or leaves nothing, is dropped. Add a small helper `lessonLimits(policy)` that returns both numbers with the fallback; Phase 3 reuses it for the prompt.

**Contract**: `cleanSignals(raw, policy, step)`; result key `lessonCandidates: string[]` (1 to `maxCandidates` items). `lessonLimits(policy)` returns `{ maxCandidates, maxChars }`. Cleaning of one item, in order: remove format characters (`\p{Cf}`); replace control characters and runs of whitespace by one space; replace `` ` `` by `'`; trim. Cut of one item: when it has more than `maxChars` code points (`Array.from`), keep the first `maxChars` code points; when the code point after the cut is not a space and the kept part holds a space, drop back to the last space; trim. A single word longer than `maxChars` is cut at `maxChars` code points. The call in `attachResult` passes `last.step`. `rigor` and `needsHuman` behave as before for every step.

#### 3. Tests

**File**: `skills/10x-pipeline/test/lessons.test.mjs` (new; uses `helpers.mjs` and `phase-helpers.mjs` as `route.test.mjs` does)

**Intent**: Cover the sanitizer through the CLI with an `impl-review` result file.

**Contract**: cases for a valid list; more than the cap; an over-long item (cut on the last space, at most `maxChars` code points); an over-long single word (cut at `maxChars`); an astral character such as an emoji across the cut (no lone surrogate in `run.jsonl`); a newline, a backtick, a control character and a bidi override (U+202E); a non-array, a non-string item, an empty string and a repeat that differs only by case or spaces; the key on a `plan` result (dropped); an `impl-review` result with no `signals` (no `signals` on the entry); `run.jsonl` holding no raw `signals` and no key other than the three; a policy override of `maxCandidates` and of `maxChars`, and an invalid override (0, a string, a fraction) that falls back.

### Success Criteria:

#### Automated Verification:

- Sanitizer tests pass: `node --test skills/10x-pipeline/test/lessons.test.mjs`
- Existing signal tests still pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- `policy.json` parses: `node -e "JSON.parse(require('fs').readFileSync('skills/10x-pipeline/policy.json','utf8'))"`

#### Manual Verification:

- None for this phase.

---

## Phase 2: Report section

### Overview

Render the stored candidates in `report.md`.

### Changes Required:

#### 1. Report builder

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `buildReport`, after the skipped-steps section, add a `## Lesson candidates` section when at least one executed `impl-review` entry with `ok` true carries `signals.lessonCandidates`. One bullet per candidate across those entries in log order, repeats dropped (case-insensitive, first occurrence kept with its step number). No run-level cap. The `/10x-lesson` command is never run; the section says so in one line.

**Contract**: section shape, with a blank line between parts:

```
## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson <seed>` (step <n>)
```

No candidates: no heading, and the report is byte-identical to today's. The section appears in every report: `done`, `archive`, `halt` and `status --report`. The text is rendered through the same `oneLine` helper as the other report text.

#### 2. Tests

**File**: `skills/10x-pipeline/test/lessons.test.mjs`

**Intent**: Check the section from a finished run and from a halt.

**Contract**: a run that ends `done` after an `impl-review` with candidates shows the section with the step number; two reviews with an overlapping candidate show it once, with the first step number; two reviews with three distinct candidates each show all six; a failed review (`ok` false) contributes nothing; no candidates gives a report with no `Lesson candidates` text; `status --report` rewrites the section; a `halt` report keeps it; an `--archive` run's report has it before the archive action (use the existing archive helpers).

### Success Criteria:

#### Automated Verification:

- Report tests pass: `node --test skills/10x-pipeline/test/lessons.test.mjs`
- Report tests of earlier changes still pass: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/archive.test.mjs`

#### Manual Verification:

- A scratch run with a fixture result shows the section in `report.md`, and the first command copy-pastes into the prompt as one line.

---

## Phase 3: Prompt wiring

### Overview

Ask the implementation review subagent for the candidates, with both limits and the `RESULT` shape in the prompt.

### Changes Required:

#### 1. Prompt file

**File**: `skills/10x-pipeline/prompts/impl-review-lessons.md` (new)

**Intent**: Rules, in the GIVEN/WHEN/THEN form, that tell the subagent when to add `signals.lessonCandidates`, what a candidate is and how long it may be, so the key is rare, clean and rarely cut.

**Contract**: rules (each one line, one bold keyword), covering: after the review is saved, the subagent **MAY** add `signals.lessonCandidates`, an array of at most `{lessonMax}` strings, in the same `signals` object of the one `RESULT` line as any other signal key; before it picks candidates, when `context/foundation/lessons.md` exists, it **MUST** read it; a rule already in that file **MUST NOT** be repeated; a finding that shows a class of bug or design pitfall that would recur in other changes (the same cause in two or more places, or a repeated deviation from the plan's pattern) **SHOULD** become one candidate; a finding that is specific to this change **MUST NOT**; a candidate **MUST** be one sentence in rule form ("Always...", "Never...") of at most `{lessonChars}` characters, without backticks or line breaks; with nothing recurring the key **MUST** be left out, not padded; the subagent **MUST NOT** run `/10x-lesson` or write `lessons.md`. One prose line (no bold keyword) shows the fragment: `"signals":{"lessonCandidates":["Always ...","Never ..."]}`. The wording of the final text is the implementer's, within these rules.

#### 2. Policy wiring

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Make both review templates carry the new rules.

**Contract**: `prompts["impl-review"]` becomes `[<the current string>, "@prompts/impl-review-lessons.md"]`; `prompts["impl-review-warn"]` becomes `[<same string>, "@prompts/impl-review-warn.md", "@prompts/impl-review-lessons.md"]`. The warn file ends with its own `## Rules` heading, so the lessons rules follow it without a second heading. The shared `suffix` is unchanged.

#### 3. Variables

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Pass `lessonMax` and `lessonChars` (from `lessonLimits`) to the `render` call at the step prompt, so `{lessonMax}` and `{lessonChars}` are filled.

**Contract**: add the keys `lessonMax: String(lessonLimits(policy).maxCandidates)` and `lessonChars: String(lessonLimits(policy).maxChars)` to the variable object at `route.mjs:1908-1912`.

#### 4. Tests and prompt README

**Files**: `skills/10x-pipeline/test/lessons.test.mjs`, `skills/10x-pipeline/test/executors.test.mjs`, `skills/10x-pipeline/prompts/README.md`

**Intent**: Prove the prompt reaches both templates with both numbers filled in, keep the existing executor tests loading and true, and list the new prompt.

**Contract**: `lessons.test.mjs` checks that the `impl-review` and `impl-review-warn` prompts from `next` contain the `signals.lessonCandidates` rule, the `"lessonCandidates":[` fragment, the numbers 3 and 200 in their rule lines, the overridden numbers (for example 2 and 120) under a policy override, and no `{lessonMax}` or `{lessonChars}` left. `executors.test.mjs` gets two edits: `:275` becomes `const PLAIN_REVIEW = fill(POLICY.prompts["impl-review"][0]);`, and the `:567` assertion expects `[POLICY.prompts["impl-review"][0], "@prompts/impl-review-warn.md", "@prompts/impl-review-lessons.md"]`. The `startsWith` checks at `:522` and `:565` stay as they are. `prompts/README.md` adds the file to the "Wired" table, lists `{lessonMax}` and `{lessonChars}` among the variables and the file among those without a course source. `rules.test.mjs` checks the new file with no change.

### Success Criteria:

#### Automated Verification:

- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- New prompt follows the rule form: `node --test skills/10x-pipeline/test/rules.test.mjs`

#### Manual Verification:

- A live implementation review in a real `/agent-smith:10x-pipeline` run returns sensible candidates (few, one sentence, recurring). Not verifiable here; judge the noise on the first real runs.

---

## Phase 4: Docs

### Overview

Bring `SKILL.md`, the README, ADR-003 and `AGENTS.md` in line. The roadmap needs no edit (see "What We're NOT Doing").

### Changes Required:

#### 1. SKILL.md

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Say, without naming models or tiers, that the report carries lesson candidates and that the orchestrator never acts on them.

**Contract**: in the `done` bullet and in step 1 of `archive`, one clause: the router's `report` also lists lesson candidates with a `/10x-lesson` command, when the review gave any. A new line under "Rules": never run `/10x-lesson`, never write `context/foundation/lessons.md`; the candidates are for the human. In "Tuning", one bullet under the signals/steps list: the key, the two caps and the `lessons` policy block. "How the tier moves" is unchanged because no tier logic moves.

#### 2. README

**File**: `README.md`

**Intent**: Document the feature where users look for the report and the signals.

**Contract**: the "Rigor" bullet on signals ("The router keeps two keys...") becomes three keys, naming `lessonCandidates` (impl-review only); a new "Lesson candidates" bullet list after "Usage report" (carrier, both caps and that they are per review, the word-boundary cut, the section, the command is never run, no `lessons.md` duplicate check in the router, override via the `lessons` policy block); one sentence in "PR comment (opt-in)" that candidates are subagent text posted as it is, like a halt note.

#### 3. ADR-003

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`

**Intent**: Record the design as change 5.

**Contract**: the table row for `lesson-candidates` changes from `planned` to `implemented (see "Lesson candidates")`; the "Signals" section says three keys; a new `## Lesson candidates` section at the end, in the style of `## Phase executors and manual verification`: carrier and sanitizer (with the cut rule), the prompt and its rules, the report section, the "never unattended" rule as a GIVEN/WHEN/THEN line with one bold keyword, an `### Assumptions that carry a cost (change 5)` table with the decisions in the table above (including the per-review bound and the accepted untrusted text), and sources (research follow-up 1, this plan). The origin line and the "Sources" list mention this change. ADR rule lines are checked by `rules.test.mjs`.

#### 4. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Keep the structure list true.

**Contract**: add `lessons.test.mjs` to the test list and `impl-review-lessons.md` to the prompt list.

### Success Criteria:

#### Automated Verification:

- Whole suite passes, including the ADR rule-line check: `node --test skills/10x-pipeline/test/*.test.mjs`
- No model or tier name was added to SKILL.md: `git diff -U0 skills/10x-pipeline/SKILL.md | grep -Ei "opus|sonnet|haiku"` prints nothing
- `init` and `status` against a scratch change folder print valid JSON: `node skills/10x-pipeline/scripts/route.mjs status <scratch-id>`

#### Manual Verification:

- The README, `SKILL.md` and ADR-003 describe the same caps, the same key and the same "never unattended" rule.

---

## Testing Strategy

### Unit Tests:

- `lessons.test.mjs` (new): sanitizer cases, report cases, prompt wiring; all through the real CLI in scratch projects, as the rest of the suite.
- Edge cases: empty array, non-string items, repeats that differ by case or spaces, a candidate over the count cap, an over-long candidate and an over-long single word, an emoji across the cut, backtick, newline and bidi override in a seed, the key on a non-review step, a failed review, two reviews (a fix loop), a halt, an archive run.

### Integration Tests:

- `node --test skills/10x-pipeline/test/*.test.mjs` (existing suites unchanged except two lines in `executors.test.mjs`, `:275` and `:567`).

### Manual Testing Steps:

1. In a scratch project, run `init` and `next` through to an `impl-review` with a fixture result carrying candidates; open `report.md`.
2. Copy a `/10x-lesson` line from the report into a session and confirm the skill takes the text as its seed.

## Performance Considerations

None: the sanitizer touches at most a few short strings per step; the prompt grows by about ten lines on the review step only.

## Migration Notes

A run in flight keeps working: an old `run.jsonl` has no `lessonCandidates`, so its report has no section. A project override of `prompts["impl-review"]` as a string keeps working and simply never asks for candidates.

## References

- Change identity and scope: `context/changes/lesson-candidates/change.md`
- Plan review: `context/changes/lesson-candidates/reviews/plan-review.md` (F1 to F6)
- Related research: `context/archive/2026-10-30-rigor-levels/research.md` (section on lesson candidates, `:48`, `:192-201`; Follow-up 1)
- Roadmap: `context/foundation/roadmap.md` S-10
- Sanitizer pattern: `skills/10x-pipeline/scripts/route.mjs:310-323`; report builder `:228-269`; prompt assembly `:1562-1588`, `:1908-1912`
- Tests that read the review prompt: `skills/10x-pipeline/test/executors.test.mjs:275`, `:522`, `:565`, `:567`
- Prompt rule form: `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Policy limits and signal sanitizer

#### Automated

- [x] 1.1 Sanitizer tests pass: `node --test skills/10x-pipeline/test/lessons.test.mjs`
- [x] 1.2 Existing signal tests still pass: `node --test skills/10x-pipeline/test/route.test.mjs`
- [x] 1.3 `policy.json` parses: `node -e "JSON.parse(require('fs').readFileSync('skills/10x-pipeline/policy.json','utf8'))"`

### Phase 2: Report section

#### Automated

- [ ] 2.1 Report tests pass: `node --test skills/10x-pipeline/test/lessons.test.mjs`
- [ ] 2.2 Report tests of earlier changes still pass: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/archive.test.mjs`

#### Manual

- [ ] 2.3 A scratch run with a fixture result shows the section in `report.md`, and the first command copy-pastes into the prompt as one line

### Phase 3: Prompt wiring

#### Automated

- [ ] 3.1 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 3.2 New prompt follows the rule form: `node --test skills/10x-pipeline/test/rules.test.mjs`

#### Manual

- [ ] 3.3 A live implementation review in a real `/agent-smith:10x-pipeline` run returns sensible candidates (few, one sentence, recurring)

### Phase 4: Docs

#### Automated

- [ ] 4.1 Whole suite passes, including the ADR rule-line check: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 4.2 No model or tier name was added to SKILL.md: `git diff -U0 skills/10x-pipeline/SKILL.md | grep -Ei "opus|sonnet|haiku"` prints nothing
- [ ] 4.3 `init` and `status` against a scratch change folder print valid JSON: `node skills/10x-pipeline/scripts/route.mjs status <scratch-id>`

#### Manual

- [ ] 4.4 The README, `SKILL.md` and ADR-003 describe the same caps, the same key and the same "never unattended" rule
