Run /10x-research {id}

Build on `context/changes/{id}/research.md`, the record of tech debt and structural risk in this repo. The ranking you write is a proposal for a later planning session.

## Rules

- **GIVEN** the findings in `context/changes/{id}/research.md` **WHEN** you use them **THEN** you **MUST** treat them as gathered evidence and build on them, not derive them again.
- **GIVEN** the report cites other artifacts (repo map, earlier research) **WHEN** you start **THEN** you **SHOULD** read them as priors.
- **GIVEN** the report **WHEN** you start **THEN** you **MUST** list every problem it records, whatever its label (debt, risk, hotspot, finding).
- **GIVEN** a problem **WHEN** you classify it **THEN** you **MUST** mark it CANDIDATE only when its fix changes code structure, and keep every other problem (missing test, doc gap) as input for feasibility and cost.
- **GIVEN** the candidate list and its classification **WHEN** you write the output **THEN** you **MUST** put them first, so a human can audit them.
- **GIVEN** a candidate **WHEN** you investigate it **THEN** you **MUST** run three read-only exploration subagents: current shape, history and intent, migration feasibility.
- **GIVEN** the current shape subagent **WHEN** it reports **THEN** it **MUST** confirm in code where the logic lives, how responsibilities mix and which abstractions or couplings exist, citing `file:line` and labeling each claim evidence, inference or unknown.
- **GIVEN** the history subagent **WHEN** it reports **THEN** it **MUST** find why the code has this shape (ADRs and design docs if present, else git archaeology: `git log -L`, blame, commit and PR rationale) and give a verdict per candidate: deliberate constraint (load-bearing decision), accidental complexity, or unknown.
- **GIVEN** the feasibility subagent **WHEN** it reports **THEN** it **MUST** state what an incremental, reversible path needs (existing or new abstraction), what the report's blast radius data implies, which guards and tests exist around it (check the CI config) and the first prerequisite step.
- **GIVEN** any step **WHEN** you work **THEN** you **MUST NOT** change code or refactor.
- **GIVEN** a candidate **WHEN** you describe its target **THEN** you **MUST NOT** design a target architecture beyond naming a fitting target shape.
- **GIVEN** a candidate whose real fix redesigns business concepts, not code structure **WHEN** you reach it **THEN** you **MUST** say so and stop work on it, because it belongs to a later, separate analysis.
- **GIVEN** data is missing **WHEN** you write **THEN** you **MUST** write `unknown`, never a plausible guess.
- **GIVEN** all three subagents reported **WHEN** you synthesize **THEN** you **MUST** write per candidate into `research.md`: current shape with evidence, intent verdict, feasibility notes.
- **GIVEN** the synthesis **WHEN** you close it **THEN** you **MUST** add a section `Refactor opportunities` that ranks the 2-3 strongest candidates, each with current and target shape, why it earns its place (debt cost against change cost), blast radius, a sketch of the incremental path and the first prerequisite step.
- **GIVEN** candidates you considered and dropped **WHEN** you close the section **THEN** you **MUST** list them with a short reason each.
- **GIVEN** the ranking **WHEN** you rank **THEN** you **MUST** judge on evidence only.
- **GIVEN** the report is ready **WHEN** you finish **THEN** you **MUST NOT** ask anyone to choose, confirm or approve, and you end by saving the report.
