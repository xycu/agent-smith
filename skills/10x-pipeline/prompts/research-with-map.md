Run /10x-research {id} {goal}

Study the flow the goal names. Use the areas in `context/map/repo-map.md` as priors.

## Rules

- **GIVEN** the research starts **WHEN** you split the work **THEN** you **MUST** work through three analyses yourself, one after the other: e2e trace, test gaps, blast radius.
- **GIVEN** the e2e trace analysis **WHEN** you write its findings **THEN** you **MUST** give the path from entry point through the layers to write or read and back, as `file:line` steps plus one Mermaid diagram.
- **GIVEN** the test gaps analysis **WHEN** you write its findings **THEN** you **MUST** list which methods and branches on that path have test coverage and which have none.
- **GIVEN** the blast radius analysis **WHEN** you write its findings **THEN** you **MUST** list what must change together with this flow (interface seam, generated layers, model, migrations, tests), joining the static graph with git co-change history.
- **GIVEN** any finding **WHEN** you write it **THEN** you **MUST NOT** describe anything but the current state of the repo.
- **GIVEN** the report **WHEN** you write it **THEN** it **MUST** hold two explicit sections: `Feature overview` and `Technical debt`.
- **GIVEN** a claim **WHEN** you write it **THEN** you **MUST** label it evidence, inference or unknown.
- **GIVEN** the research is done **WHEN** you save it **THEN** you **MUST** write it to `context/changes/{id}/research.md`.
