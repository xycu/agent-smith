# Pipeline prompts

Prompt templates for the optional pre-plan steps of `/agent-smith:10x-pipeline`. The router fills `{id}` (change id) and `{goal}` (goal text) and appends `policy.json` `prompts.suffix`.

Source: the 10xDevs 4.0 course prompts in `10xdevs4-content/.claude/prompts/`, in Polish. Each file was translated to English, shortened in caveman style with every negation, condition and number kept, and rewritten as rules in the form **GIVEN** context **WHEN** trigger **THEN** behavior, with one bold RFC 2119 keyword each (`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, `MAY`).

| File | Source | Step |
| --- | --- | --- |
| `research-with-map.md` | `m4l3-1-research-with-map.md` | legacy research, when `context/map/repo-map.md` exists |
| `ast-grep-verification.md` | `m4l3-2-ast-grep-verification.md` | verify structural claims in `research.md` |
| `refactor-opportunities-research.md` | `m4l4-2-refactor-opportunities-research.md` | rank refactor opportunities |
| `ranking-ast-grep-verification.md` | `m4l4-3-ranking-ast-grep-verification.md` | verify the ranking's claims |
| `invariant-aggregate-refactor.md` | `m4l5-2-invariant-aggregate-refactor.md` | domain brief: guardian aggregate |
| `anti-corruption-layer.md` | `m4l5-3-anti-corruption-layer.md` | domain brief: anti-corruption layer |

Changes from the source, so the prompts run unattended inside one change:

- Hardcoded change ids (`post-flow-analysis`, `refactor-opportunities`) and `{change-id}` became `{id}`. The fixed topic of `m4l3-1` (the post-saving flow) became `{goal}`.
- The domain briefs write to the change folder (`context/changes/{id}/refactor-*.md`), not to `context/domain/0N-*.md`, so a later change does not overwrite them and the router can verify them per change.
- The domain briefs prefer the invariant or leak that the change goal touches when two score close.
- Both ast-grep prompts stop with status `blocked` when `ast-grep` is not installed, instead of installing it.
