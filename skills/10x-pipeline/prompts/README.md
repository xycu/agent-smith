# Pipeline prompts

Prompt templates for the optional pre-plan steps of `/agent-smith:10x-pipeline`. `policy.json` refers to a file as `@prompts/<file>.md`, alone or as one part of an array prompt, and the router resolves the reference before it fills `{id}` (change id), `{goal}` (goal text) and `{verdict}` and appends `policy.json` `prompts.suffix`. A file in this folder is either wired (a policy prompt refers to it) or listed under "Not wired".

Source: the 10xDevs 4.0 course prompts in `10xdevs4-content/.claude/prompts/`, in Polish. Each file was translated to English, shortened in caveman style with every negation, condition and number kept, and rewritten as rules in the form **GIVEN** context **WHEN** trigger **THEN** behavior, with one bold RFC 2119 keyword each (`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, `MAY`). `frame-unattended.md` is written for this pipeline and has no course source.

## Wired

| File | Source | Step | Wired as |
| --- | --- | --- | --- |
| `research-with-map.md` | `m4l3-1-research-with-map.md` | legacy research, when `context/map/repo-map.md` exists | `research-with-map` template |
| `invariant-aggregate-refactor.md` | `m4l5-2-invariant-aggregate-refactor.md` | domain brief: guardian aggregate | `domain-aggregate` template |
| `anti-corruption-layer.md` | `m4l5-3-anti-corruption-layer.md` | domain brief: anti-corruption layer | `domain-acl` template |
| `frame-unattended.md` | none (this pipeline) | decision guide for the ask points of `/10x-frame` | `frame` and `frame-rethink` templates |

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
