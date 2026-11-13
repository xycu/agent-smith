Always-true rules of the OpenSpec chain:
- **GIVEN** an OpenSpec skill selects, infers or derives the change name **WHEN** you pick it **THEN** you **MUST** use `{id}` as given and pass `--change "{id}"` to every `openspec` command that takes it.
- **GIVEN** an `openspec` command accepts `--store` **WHEN** you run it **THEN** you **MUST NOT** pass `--store`, because the run covers only a change inside this project's `openspec/changes/`.
