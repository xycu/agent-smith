# Integration baseline

Recorded 2026-11-23 at merge commit f81bdb52, which merged `origin/main` at 2a328e8a into this run branch. The first baseline of 2026-11-15 (HEAD 4c54a4a2, main at 45a7a50) predated the rewrite and is replaced here.

## Rewrite integration

Row 1.1 is complete. The Wave 7 rewrite `skill-md-context-diet` reached `main` as 7c0a2ba1 (PR #188), and its archive as cbbd6401 (PR #190). Both are ancestors of f81bdb52. The merge had no conflicts: the run branch touched only this change folder.

What the rewrite and later `main` commits changed for this plan:

- Late usage is consolidated. Each skill has one `usage` call, in the late-usage section, and it takes `--usage-file <usage-file>`. The three `--tokens N` copies in the done, halt and archive branches are gone.
- New script variables `CLAUDE_USAGE` and `RUN_CLAUDE` join `PREPARE_RUN` and `RUN_CODEX`. All four are already quoted (`node "$VAR"`) and need no change.
- The PR-comment and open-PR lines already tell the reader to quote the script path in prose, but the code spans still show it bare.
- Policy paths (`${CLAUDE_SKILL_DIR}/policy.json`, `context/foundation/agent-smith-policy.json`) stay prose in Tuning, not commands.

## Invocation inventory

Every bare call left at f81bdb52. Each becomes `node "$VAR" ...` in Phase 2.

### skills/10x-pipeline/SKILL.md

- Line 42 — `cd "<root>" && node $ROUTER verify-archive <change-id>`
- Line 44 — `cd "<run root>" && node $ROUTER verify-archive <change-id>`
- Line 51 — `cd "<run root>" && node $ROUTER ...`
- Line 57 — `cd "<run root>" && node $ROUTER init <change-id> --goal "<goal text>" --host <host> --pr-comment <true|false>`
- Line 104 — `cd "<run root>" && node $ROUTER next <change-id>`
- Line 106 — `cd "<run root>" && node $ROUTER status <change-id>`
- Line 111 — `cd "<run root>" && node $ROUTER status <change-id>`
- Line 124 — `cd "<run root>" && node $ROUTER verify-archive <change-id> --path <archivePath>`
- Line 129 — `cd "<run root>" && node $ROUTER status <change-id>` and `cd "<run root>" && node $ROUTER next <change-id>`
- Line 153 — `cd "<run root>" && node $ROUTER usage <change-id> <n> --usage-file <usage-file>`
- Line 165 — `cd "<run root>" && node $PR_COMMENT <change-id>`
- Line 177 — `cd "<run root>" && node $OPEN_PR <change-id>`

12 router calls on 11 lines, 1 PR-comment call, 1 open-PR call.

### skills/openspec-pipeline/SKILL.md

- Line 47 — `cd "<root>" && node $ROUTER verify-archive <change-name> --chain openspec`
- Line 49 — `cd "<run root>" && node $ROUTER verify-archive <change-name> --chain openspec`
- Line 56 — `cd "<run root>" && node $ROUTER ... --chain openspec`
- Line 63 — `cd "<run root>" && node $ROUTER init <change-name> --chain openspec --goal "<goal text>" --host <host> --pr-comment <true|false>`
- Line 110 — `cd "<run root>" && node $ROUTER next <change-name> --chain openspec`
- Line 112 — `cd "<run root>" && node $ROUTER status <change-name> --chain openspec`
- Line 116 — `cd "<run root>" && node $ROUTER status <change-name> --chain openspec`
- Line 129 — `cd "<run root>" && node $ROUTER verify-archive <change-name> --chain openspec --path <archivePath>`
- Line 134 — `cd "<run root>" && node $ROUTER status <change-name> --chain openspec` and `cd "<run root>" && node $ROUTER next <change-name> --chain openspec`
- Line 158 — `cd "<run root>" && node $ROUTER usage <change-name> <n> --usage-file <usage-file> --chain openspec`
- Line 170 — `cd "<run root>" && node $PR_COMMENT <change-name> --report "openspec/changes/<change-name>/agent-smith/report.md"`
- Line 182 — `cd "<run root>" && node $OPEN_PR <change-name> --chain openspec`

12 router calls on 11 lines, 1 PR-comment call, 1 open-PR call.

## Affected assertions

Tests that pin the bare spelling at f81bdb52:

- skills/10x-pipeline/test/skill-loop.test.mjs — lines 157, 174, 180, 188, 198, 310, 332, 358, 379, 421, 422, 489, 590, 610
- skills/openspec-pipeline/test/openspec-skill.test.mjs — lines 108, 111, 112, 115, 222, 223, 242, 246, 253, 309, 326
- skills/10x-pipeline/test/archive-gate.test.mjs — line 44
- skills/10x-pipeline/test/pr-comment.test.mjs — lines 742, 747, 750, 752, 778
- skills/10x-pipeline/test/init-permissions.test.mjs — line 350 (a fifth file, new since the plan; it finds the init line by `node $ROUTER init`)

Lines 135–147 of skill-loop.test.mjs and line 91 of openspec-skill.test.mjs check the quoted variable assignments, not the calls, and stay as they are.

The single `usage` call per skill changes Phase 2's ordering checks: pin the one quoted late-usage command and each terminal branch's reference to it, not three copies (plan, "Rewrite integration").
