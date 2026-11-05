# Pipeline prompts

Prompt templates for the optional pre-plan steps and the phase executors of `/agent-smith:10x-pipeline`. `policy.json` refers to a file as `@prompts/<file>.md`, alone or as one part of an array prompt, and the router resolves the reference before it fills `{id}` (change id), `{goal}` (goal text), `{verdict}` and, for the executor prompts, `{phase}`, `{lastPhase}`, `{retry}`, `{uncommitted}` and `{unproven}` (phase numbers and row ids), `{lessonMax}` and `{lessonChars}` (the lesson candidate limits from `policy.json` `lessons`) and `{evidence}` (empty unless the retry could not check for a commit) and `{workdir}` (the run root of an isolated run, only in `worktree.md`), and appends `policy.json` `prompts.suffix`. A file in this folder is either wired (a policy prompt refers to it) or listed under "Not wired".

Source: the 10xDevs 4.0 course prompts in `10xdevs4-content/.claude/prompts/`, in Polish. Each file was translated to English, shortened in caveman style with every negation, condition and number kept, and rewritten as rules in the form **GIVEN** context **WHEN** trigger **THEN** behavior, with one bold RFC 2119 keyword each (`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, `MAY`). `frame-unattended.md`, `executor-e2e.md`, `executor-tdd.md`, `executor-retry.md`, `impl-review-warn.md`, `impl-review-lessons.md`, `plan-review-apply.md`, `impl-review-apply.md`, `plan-review-confirm.md`, `impl-review-confirm.md`, `manual-verify.md`, `score.md`, `worktree.md` and `advisor.md` are written for this pipeline and have no course source.

## Wired

| File | Source | Step | Wired as |
| --- | --- | --- | --- |
| `research-with-map.md` | `m4l3-1-research-with-map.md` | legacy research, when `context/map/repo-map.md` exists | `research-with-map` template |
| `invariant-aggregate-refactor.md` | `m4l5-2-invariant-aggregate-refactor.md` | domain brief: guardian aggregate | `domain-aggregate` template |
| `anti-corruption-layer.md` | `m4l5-3-anti-corruption-layer.md` | domain brief: anti-corruption layer | `domain-acl` template |
| `frame-unattended.md` | none (this pipeline) | decision guide for the ask points of `/10x-frame` | `frame` and `frame-rethink` templates |
| `executor-e2e.md` | none (this pipeline) | decision guide for the ask points of `/10x-e2e`, one phase or a run of phases | `implement-e2e` template |
| `executor-tdd.md` | none (this pipeline) | decision guide for the ask points of `/10x-tdd`, one phase or a run of phases | `implement-tdd` template |
| `executor-retry.md` | none (this pipeline) | re-opens rows that were ticked without a code commit, once | `implement-retry` template |
| `impl-review-warn.md` | none (this pipeline) | warns the implementation review about rows ticked without a code commit | `impl-review-warn` template |
| `impl-review-lessons.md` | none (this pipeline) | asks the implementation review for lesson candidates in `signals.lessonCandidates` | `impl-review`, `impl-review-warn` and `impl-review-confirm` templates |
| `plan-review-apply.md` | none (this pipeline) | the plan review applies every finding with a clear fix to `plan.md` before it finishes | `plan-review` and `plan-review-confirm` templates |
| `impl-review-apply.md` | none (this pipeline) | the implementation review applies every CRITICAL and WARNING with a clear fix to the code, tests it and commits | `impl-review`, `impl-review-warn` and `impl-review-confirm` templates |
| `plan-review-confirm.md` | none (this pipeline) | confirmation round: the plan review reads the previous report, checks every `APPLIED` fix as a claim and reviews the current plan in full | `plan-review-confirm` template (same step as `plan-review`), when `review.confirmRounds` for the level is above 0 |
| `impl-review-confirm.md` | none (this pipeline) | confirmation round: the implementation review reads the previous report, checks every `APPLIED` fix as a claim and reviews the current code in full | `impl-review-confirm` template (same step as `impl-review`), when `review.confirmRounds` for the level is above 0 |
| `manual-verify.md` | none (this pipeline) | a clean-context subagent proves every pending Manual row by a command, a covering test, a throw-away script, the browser or a written judgment, saves kind-prefixed evidence under `evidence/`, lists the rows it cannot prove with a reason in `evidence/unproven.md`, and follows the safety rules (no push or publish, no write outside the run root and the scratch directory, read-only git, no command that never ends, no secret in evidence) | `manual-verify` template (with the Chrome rules, the default) and `manual-verify-nochrome` template (only for a run started with `--chrome false`) |
| `score.md` | none (this pipeline) | scores the change on six factors before the first plan and writes `complexity.json` | `score` template |
| `advisor.md` | none (this pipeline) | `plan` and `implement`: asks the step to consult the advisor once before its RESULT line, when an advisor tool is available | `advisor` template, appended after the step template and before the suffix when `advisor.enabled` is `true` and `advisor.templates` names the template (`plan`, `implement`, `implement-segment`) |
| `worktree.md` | none (this pipeline) | every step of an isolated run: work only inside the run worktree | `worktree` template, rendered with `{workdir}` (the run root) and put before every prompt the router returns when `meta.isolated` is `true` |

## Not wired

| File | Source | Why it is not wired |
| --- | --- | --- |
| `ast-grep-verification.md` | `m4l3-2-ast-grep-verification.md` | works on an existing `research.md`; stops as `blocked` when `ast-grep` is missing |
| `refactor-opportunities-research.md` | `m4l4-2-refactor-opportunities-research.md` | works on an existing `research.md` |
| `ranking-ast-grep-verification.md` | `m4l4-3-ranking-ast-grep-verification.md` | works on an existing `research.md`; stops as `blocked` when `ast-grep` is missing |

Changes from the source, so the prompts run unattended inside one change:

- Hardcoded change ids (`post-flow-analysis`, `refactor-opportunities`) and `{change-id}` became `{id}`. The fixed topic of `m4l3-1` (the post-saving flow) became `{goal}`.
- The domain briefs write to the change folder (`context/changes/{id}/refactor-*.md`), not to `context/domain/0N-*.md`, so a later change does not overwrite them and the router can verify them per change.
- The domain briefs prefer the invariant or leak that the change goal touches when two score close.
- Both ast-grep prompts stop with status `blocked` when `ast-grep` is not installed, instead of installing it.
