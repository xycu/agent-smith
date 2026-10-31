# ADR-006: Node.js runtime floor follows security support

- **Status:** Proposed
- **Date:** 2026-10-31
- **Deciders:** repository owner
- **Origin:** the `node-floor-24` change. Change folder: `context/changes/node-floor-24/change.md`.

## Context

- The router and the scripts are dependency-free ESM and use only `node:` built-ins. They run on whatever `node` the user has on PATH.
- Claude Code does not guarantee that `node`. A native install is a single executable, not a Node install, so the user provides Node.
- The floor was Node 18. Support dates from endoflife.date/nodejs, read 2026-10-29:

| Node | Security support ends |
| --- | --- |
| 18 | 2025-04-30 (ended) |
| 20 | 2026-04-30 (ended) |
| 22 | 2027-04-30 |
| 24 | 2028-04-30 |
| 26 | 2029-04-30 |

- A floor below the supported lines made `AGENTS.md` carry a ban list of newer APIs (`toSorted`, `Object.groupBy`, `Set` methods, `import.meta.dirname`, the regex `v` flag, `assert.partialDeepStrictEqual`, `mock.timers`) that contributors had to remember.

## Decision

The floor is Node 24, the oldest line that still has more than a year of security support. It is a promise about what the repository tests and supports, not a technical limit: the code does not use anything that fails on an older line.

Rules, written as scenarios (the form of ADR-004):

**GIVEN** the Node floor in `AGENTS.md` and `README.md` **WHEN** a release line in it leaves security support **THEN** the owner **MUST** raise the floor in a documented change that updates this ADR.

**GIVEN** the oldest line still in security support **WHEN** the floor is chosen **THEN** the floor **SHOULD** be a line with more than twelve months of security support left, so the next raise is not due within a year.

**GIVEN** a new router or test file **WHEN** it is written **THEN** it **MUST** use only `node:` built-ins and add no npm dependency.

**GIVEN** an API that exists on the floor **WHEN** a contributor uses it **THEN** the contributor **MAY** use it without a compatibility note.

## Consequences

- Users on Node 22 or older get no promise. The router may still run for them, but no test run covers it.
- The ban list is deleted from `AGENTS.md`. A new API that lands after Node 24 is not covered by the last rule and needs a check against the floor.
- The suite runs on Node 24 only, so a regression that appears on 22 would not be seen.
- There is no `engines` field and no runtime check in `route.mjs`. A user on an old Node sees whatever error the old runtime gives.
- The floor will need another raise by April 2028, when Node 24 leaves security support.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Keep Node 18 | rejected | End of life since 2025-04-30, and it keeps the ban list alive. |
| Node 20 | rejected | End of life since 2026-04-30. |
| Node 22 | rejected | Security support ends 2027-04-30, so the floor would be due again in six months. |
| Node 26 | not adopted | Newest LTS line, but it would exclude users on 24 for no technical gain. |
| Add an `engines` field or a runtime version check | not adopted | The repository has no `package.json`, and a check in `route.mjs` would add router logic for a documentation promise. |
