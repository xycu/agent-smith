# Blocked integration baseline

Recorded 2026-11-15 at HEAD 4c54a4a29cd1c18f95be4b1db17470924f4503b9.

## Rewrite integration

Row 1.1 remains pending. Local main and origin/main both point to 45a7a50. Rewrite commits c9eb670 and 8bbe804 exist on agent-smith/skill-md-context-diet. Only that branch contains 8bbe804. The completed main-branch state required by the plan is unavailable in current local refs. No merge was attempted.

## Provisional invocation inventory

Rebuild this inventory after integration before completing row 1.1.

### skills/10x-pipeline/SKILL.md

- Line 36 — `cd "<root>" && node $ROUTER verify-archive <change-id>`
- Line 38 — `cd "<run root>" && node $ROUTER verify-archive <change-id>`
- Line 40 — `cd "<run root>" && node $ROUTER ...`
- Line 46 — `cd "<run root>" && node $ROUTER init <change-id> --goal "<goal text>" --host <host> --pr-comment <true|false>`
- Line 61 — `cd "<run root>" && node $ROUTER next <change-id>`
- Line 62 — `cd "<run root>" && node $ROUTER usage <change-id> <n> --tokens N --tool-uses N --duration-ms N`
- Line 63 — `cd "<run root>" && node $ROUTER status <change-id>`
- Line 68 — `cd "<run root>" && node $ROUTER usage <change-id> <n> --tokens N --tool-uses N --duration-ms N`
- Line 69 — `cd "<run root>" && node $ROUTER status <change-id>`
- Line 74 — `cd "<run root>" && node $ROUTER verify-archive <change-id> --path <archivePath>`
- Line 78 — `cd "<run root>" && node $ROUTER usage <change-id> <n> --tokens N --tool-uses N --duration-ms N`
- Line 79 — `cd "<run root>" && node $ROUTER next <change-id>`
- Line 97 — `cd "<run root>" && node $PR_COMMENT <change-id>`
- Line 109 — `cd "<run root>" && node $OPEN_PR <change-id>`

Policy paths are prose references. No executable policy-path command was found.

### skills/openspec-pipeline/SKILL.md

- Line 41 — `cd "<root>" && node $ROUTER verify-archive <change-name> --chain openspec`
- Line 43 — `cd "<run root>" && node $ROUTER verify-archive <change-name> --chain openspec`
- Line 45 — `cd "<run root>" && node $ROUTER ... --chain openspec`
- Line 52 — `cd "<run root>" && node $ROUTER init <change-name> --chain openspec --goal "<goal text>" --host <host> --pr-comment <true|false>`
- Line 67 — `cd "<run root>" && node $ROUTER next <change-name> --chain openspec`
- Line 68 — `cd "<run root>" && node $ROUTER usage <change-name> <n> --tokens N --tool-uses N --duration-ms N --chain openspec`
- Line 69 — `cd "<run root>" && node $ROUTER status <change-name> --chain openspec`
- Line 73 — `cd "<run root>" && node $ROUTER usage <change-name> <n> --tokens N --tool-uses N --duration-ms N --chain openspec`
- Line 74 — `cd "<run root>" && node $ROUTER status <change-name> --chain openspec`
- Line 79 — `cd "<run root>" && node $ROUTER verify-archive <change-name> --chain openspec --path <archivePath>`
- Line 83 — `cd "<run root>" && node $ROUTER usage <change-name> <n> --tokens N --tool-uses N --duration-ms N --chain openspec`
- Line 84 — `cd "<run root>" && node $ROUTER next <change-name> --chain openspec`
- Line 102 — `cd "<run root>" && node $PR_COMMENT <change-name> --report "openspec/changes/<change-name>/agent-smith/report.md"`
- Line 114 — `cd "<run root>" && node $OPEN_PR <change-name> --chain openspec`

Policy paths are prose references. No executable policy-path command was found.

## Affected assertions

- skills/10x-pipeline/test/skill-loop.test.mjs — lines 133, 135, 143, 145, 155, 173, 187, 194, 196, 198, 304, 347, 348
- skills/openspec-pipeline/test/openspec-skill.test.mjs — lines 91, 94, 108, 111, 112, 115, 206, 208, 219, 220, 243, 250, 296
- skills/10x-pipeline/test/archive-gate.test.mjs — lines 43
- skills/10x-pipeline/test/pr-comment.test.mjs — lines 711, 714, 716, 719, 721, 783

Node v24.19.0 is available. Affected suites exist. Phase 1 integration verification is blocked. No tests ran during this attempt. All Automated rows remain unchecked.
