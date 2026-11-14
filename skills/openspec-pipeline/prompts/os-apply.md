Unattended rules for /openspec-apply-change. No human answers, so every pause point of the skill has a fixed answer here. The change is `{id}` at `openspec/changes/{id}/`; fix mode is a prompt whose first lines list critical findings from `openspec/changes/{id}/agent-smith/verify.md`.

Load the named installed `openspec-apply-change` skill through the host's native skill mechanism in both normal and fix mode. Its work stays in this child.

## Rules

- **GIVEN** the project check reports no root, a store declaration error or any other CLI failure **WHEN** the skill would stop and ask how to proceed **THEN** you **MUST** finish with status `blocked` and `signals.needsHuman` quoting the CLI `message`.
- **GIVEN** `openspec instructions apply --change "{id}" --json` reports `state: "blocked"` **WHEN** the skill would pause or suggest `/opsx:continue` **THEN** you **MUST** finish with status `blocked` and `signals.needsHuman` quoting its `instruction`, and create no planning artifact and no code.
- **GIVEN** the apply instructions list open tasks and you are not in fix mode **WHEN** you work **THEN** you **MUST** go through every open task in this step, in order, until all are ticked or one blocks you.
- **GIVEN** you finished a task and its specified behavior is fully implemented **WHEN** you update `tasks.md` **THEN** you **MUST** tick it as `- [x]` at its returned `sourcePath` and `line` right away, as the skill does.
- **GIVEN** a task is partly done, deferred or narrowed **WHEN** you update `tasks.md` **THEN** you **MUST NOT** tick it.
- **GIVEN** a row of `tasks.md` **WHEN** you edit the file **THEN** you **MUST NOT** untick, delete, reword or reorder any row.
- **GIVEN** a task names a test or command to verify it **WHEN** you finish the task **THEN** you **MUST** run that test or command and tick the row only when it passes.
- **GIVEN** a task is unclear **WHEN** `proposal.md`, `design.md`, the delta specs under `specs/` or the code settle it **THEN** you **MUST** decide from them, cite `file:line` and list the decision as an assumption.
- **GIVEN** a task is unclear **WHEN** none of `proposal.md`, `design.md`, the delta specs and the code settle it **THEN** you **MUST** leave its row unticked and finish with status `blocked` and `signals.needsHuman` naming the task and the question.
- **GIVEN** the implementation reveals a design issue **WHEN** a local fix to `design.md`, a delta spec or the wording of an open task in `openspec/changes/{id}/` resolves it without changing the scope, behavior or acceptance criteria of `proposal.md` **THEN** you **MUST** apply that fix, go on and list it as an assumption.
- **GIVEN** the implementation reveals a design issue **WHEN** no such local fix exists **THEN** you **MUST** finish with status `blocked` and `signals.needsHuman` naming the issue and the options you see.
- **GIVEN** a task needs work beyond what the delta specs and `tasks.md` describe, or would only fit by dropping, narrowing or deferring specified behavior **WHEN** the skill would surface the added scope and ask **THEN** you **MUST** leave that row unticked and finish with status `blocked` and `signals.needsHuman` naming the added scope.
- **GIVEN** an error or blocker stops a task **WHEN** you cannot resolve it from the code and the artifacts **THEN** you **MUST** leave that row unticked and finish with status `blocked` and `signals.needsHuman` quoting the error.
- **GIVEN** the prompt lists critical findings (fix mode) **WHEN** you work **THEN** you **MUST** fix each finding, read the `## Critical` section of `openspec/changes/{id}/agent-smith/verify.md` when the list says "see verify.md", run the tests the change names and leave every tick of `tasks.md` as it is.
- **GIVEN** fix mode and a finding that needs a change of scope, behavior or acceptance criteria in `proposal.md` **WHEN** you would fix it **THEN** you **MUST** finish with status `blocked` and `signals.needsHuman` naming the finding.
- **GIVEN** fix mode **WHEN** you are tempted to edit `verify.md` **THEN** you **MUST NOT** change any file under `openspec/changes/{id}/agent-smith/`.
- **GIVEN** every task is ticked, or every listed finding is fixed in fix mode **WHEN** the skill would suggest verifying or archiving **THEN** you **MUST NOT** archive, run `openspec archive`, run the sync-specs workflow or move any folder.
- **GIVEN** you write a file **WHEN** you pick its path **THEN** you **MUST NOT** write into `openspec/specs/`, because the archive step merges the delta specs.
- **GIVEN** you changed files outside `openspec/changes/{id}/` **WHEN** you end the step **THEN** you **MUST** stage those files one by one by name and commit them under a Conventional Commits subject `<type>({id}): <summary>` whose type is `feat`, `fix`, `refactor`, `perf`, `test` or `docs`, never `chore`, and leave every file under `openspec/changes/{id}/` unstaged, because the router commits the change folder.
- **GIVEN** you end the step **WHEN** you would stash **THEN** you **MUST NOT** stash.
- **GIVEN** the skill would show its "Implementation Paused" options or ask "What would you like to do?" **WHEN** you run unattended **THEN** you **MUST NOT** print a plain-text question or wait for input, and you answer by the rules above.
- **GIVEN** every open task is ticked, or every listed finding is fixed in fix mode **WHEN** you finish **THEN** you **MUST** finish with status `done` and name the ticked rows or fixed findings in `note`.
- **GIVEN** you record an assumption in the RESULT line **WHEN** you write it **THEN** you **MUST** cite the evidence for it.
