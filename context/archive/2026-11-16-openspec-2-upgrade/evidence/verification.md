# OpenSpec 2.0.0 implementation verification

Recorded 2026-11-16 for `openspec-2-upgrade`. The runtime/integration candidate is `c7c9436d2b71276ebc9de56e95763dbf25d125fa`, the Phase 2 migration commit. Phase 1 is `bef2a2e1`. Implementation started from `3f50f67906bc5ef22ec4f86e6ef466c10278f11a`. Phase 3 adds verification records and a test-only fixture-isolation correction. The final verification candidate adds staged test-source diff SHA-256 `f6a7d3eef080d4c1841437893d6771ba143ee851467cf5adcd8ae75ea27b9a9e` to that revision. Its closing commit is identified in Phase 3 Progress. The canonical Progress section records closing phase commits. [Progress](../plan.md#progress)

## Tools and environment

| Tool | Observed version |
| --- | --- |
| Node.js | `v24.19.0` |
| npm | `11.17.0` |
| Git | `2.54.0 (Apple Git-157)` |
| OpenSpec | `2.0.0` |
| Codex CLI | `0.169.0` |
| Claude Code | `2.1.311` |
| Plugin metadata | `1.12.2` |

The selected executable is `/Users/blazej/.local/state/fnm_multishells/35806_1794851125216/bin/openspec`. The Phase 3 leaf rechecked its `--version` response as exactly `2.0.0`. Codex version inspection printed the warning that PATH aliases could not be created because the operation was not permitted. These version observations establish installed-tool prerequisites. The normal-entry native qualification remains pending. [Acceptance](acceptance.md)

Every gate ran from `/Users/blazej/.codex/worktrees/5f77/agent-smith/.claude/worktrees/agent-smith-openspec-2-upgrade`. Fixture `TMPDIR` and `GIT_CEILING_DIRECTORIES` point to its ignored `.claude/worktrees/openspec-2-implement` directory. An invalid `.git` discovery boundary there was verified to stop discovery before the enclosing repository. Config/init/update subprocesses additionally use scratch-local HOME, USERPROFILE and XDG config/data/cache paths. The final fixture environment clears inherited CODEX_HOME. Telemetry and update checks are disabled.

The full gate uses the following environment and command. The initial Phase 1 full attempt ran the same Node command without `caffeinate -i`. Subsequent full attempts use that temporary macOS wake assertion.

```sh
cd "/Users/blazej/.codex/worktrees/5f77/agent-smith/.claude/worktrees/agent-smith-openspec-2-upgrade" && export TMPDIR="$PWD/.claude/worktrees/openspec-2-implement" GIT_CEILING_DIRECTORIES="$PWD/.claude/worktrees/openspec-2-implement" OPENSPEC_BIN="$(command -v openspec)" OPENSPEC_TELEMETRY=0 DO_NOT_TRACK=1 OPENSPEC_NO_UPDATE_CHECK=1 && CI=1 caffeinate -i node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

## Gate commands

The enclosing step prepended the worktree and environment setup above to each command, retaining the CI setting shown below. Raw logs are retained locally beneath `.claude/worktrees/openspec-2-implement/` in this run worktree.

| Gate | Node command |
| --- | --- |
| 1.1 | `node --test tools/test/ci-runner.test.mjs` |
| 1.2 | `CI=1 node --test skills/openspec-pipeline/test/openspec-contract.test.mjs` |
| Phase 1 deliberate break | `node --test --test-name-pattern="CI installs and selects" tools/test/ci-runner.test.mjs` |
| Phase 1 timeout diagnostic | `CI=1 node --test --test-name-pattern="lean runs manual-verify" skills/10x-pipeline/test/budget-executors.test.mjs` |
| 1.3, 2.2 and 3.2 | Full repository command above |
| 2.1 | `CI=1 caffeinate -i node --test skills/openspec-pipeline/test/openspec-contract.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs skills/openspec-pipeline/test/openspec-archive.test.mjs` |
| Phase 2 deliberate break | `node --test --test-name-pattern="archive prompt quotes error" skills/openspec-pipeline/test/openspec-archive.test.mjs` |
| Whitespace and version | `git diff --check`, `git diff --cached --check`, `node tools/version-check.mjs` |

## Executed attempts

Counts are actual Node test totals. A red deliberate-break test is the expected gate outcome. All listed attempts have zero cancellations and zero todo tests.

| Local log | Tests | Passed | Failed | Skipped | Duration ms | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| `phase1-ci.log` | 13 | 13 | 0 | 0 | 7963.726375 | PASS |
| `phase1-contract.log` | 9 | 8 | 1 | 0 | 4998.586 | FAIL, legacy Claude link missing |
| `phase1-contract-retry.log` | 9 | 9 | 0 | 0 | 5858.599417 | PASS |
| `phase1-break.log` | 1 | 0 | 1 | 0 | 71.736125 | PASS, assertion detected wrong CI pin |
| `phase1-full.log` | 1791 | 1773 | 15 | 3 | 4552294.067792 | FAIL, subprocess/preflight timeouts |
| `phase1-diagnostic-budget.log` | 1 | 1 | 0 | 0 | 3044.72675 | PASS on unchanged candidate |
| `phase1-full-retry.log` | 1791 | 1788 | 0 | 3 | 798673.342125 | PASS on unchanged candidate |
| `phase2-focused.log` | 56 | 56 | 0 | 0 | 6234.184041 | PASS |
| `phase2-break.log` | 1 | 0 | 1 | 0 | 90.921167 | PASS, assertion detected mandatory `fix` |
| `phase2-full.log` | 1793 | 1790 | 0 | 3 | 790036.610084 | PASS |
| `phase3-focused.log` | 465 | 463 | 0 | 2 | 130870.8775 | PASS |
| `phase3-full.log` | 1793 | 1790 | 0 | 3 | 778239.178917 | PASS |
| `phase3-ci.log` | 13 | 13 | 0 | 0 | 7098.098792 | PASS |
| `phase3-focused-final.log` | 465 | 463 | 0 | 2 | 122879.947125 | PASS |
| `phase3-break.log` | 1 | 0 | 1 | 0 | 550.974333 | PASS, assertion detected inherited CODEX_HOME |
| `phase3-full-final.log` | 1793 | 1790 | 0 | 3 | 790647.534959 | PASS |

The initial legacy fixture removed every old tool skill and command before running `update --force`. OpenSpec exited successfully with “No configured tools found” and omitted the Claude links. A bounded probe established that explicit `init --tools claude,codex --profile custom --no-animation` restores them. The corrected fixture preserves every existing assertion, includes an existing main spec in its byte-preservation checks, and passes repeated-update idempotence.

The initial full attempt failed on router/Git subprocess deadlines and Codex permission-preflight timeout. The unchanged focused budget diagnostic passed. The unchanged full retry passed under the temporary wake assertion. The record retains the timeout failures and leaves their underlying host cause unproved.

Both deliberate-break edits were worktree-only. Phase 1 replaced the CI install pin with `1.16.1`. Phase 2 made every archive error require `fix`. Each targeted test went red, and a `finally` restoration recovered the staged candidate bytes exactly before its full gate.

The first actual root initialization exited 1 with EPERM creating the worktree's `.agents` directory. The authorized automatic-review escalation retry exited 0 and generated twelve shared skills and Claude links. Both attempts retained worktree-local HOME/XDG paths and preserved all protected inputs. Their raw outputs are `phase2-migration.log` and `phase2-migration-retry.log`.

Whitespace checks and `node tools/version-check.mjs` passed after both phases. Version fields remain `1.12.2`.

## Expected skips

The successful full gates contain exactly these three skips. Git-dependent checks and all nine real OpenSpec 2.0.0 contracts executed.

| Exact test identity | Observed condition |
| --- | --- |
| `live: a branch with no pull request is skipped` | `GH_LIVE` was not `1` |
| `live: the real comment projection is one parseable object per line across pages` | `GH_LIVE` was not `1` |
| `CLAUDE.md has no @ imports` | `CLAUDE.md` is absent |

## Migration and preservation evidence

The inventory contains twelve workflow IDs, `propose,explore,new,continue,apply,update,ff,sync,archive,bulk-archive,verify,onboard`. All twenty-four committed legacy skill/command files matched upstream 1.16.1 byte-for-byte. The downloaded source tarball's verified integrity is `sha512-Qu2kdUP3oiXK6WzOA1OcEYiTlG3GmLJE37whoGjTEy4vbzuW4o3OwAwYwxSQpJnKHJ/XGySvo+icRiulBCxyzw==`. The inventory therefore required no project-specific generated-instruction reconciliation. [Registry tarball](https://registry.npmjs.org/@fission-ai/openspec/-/openspec-1.16.1.tgz)

The migration preview and isolated generated diff were reviewed before inspected file-by-file removal. Every canonical skill reports `generatedBy: "2.0.0"`, retains its MIT notice and matches isolated 2.0.0 generation. Each of the twelve Claude entries is an actual relative symlink resolving to its in-project canonical directory. The committed integration has twelve canonical regular files, twelve Git-mode `120000` links and the upstream `.agents/skills/.openspec-target` marker. The real fixture's fresh checkout resolves its tracked targets.

The upstream marker contains `claude own-files` and `codex`. OpenSpec 2.0.0 source defines `own-files` as commands or links. Claude owns its link entries, and the Codex marker records use of shared skills. Actual link inspection and the empty update previews agree with that representation. [Upstream release](https://github.com/Fission-AI/OpenSpec/tree/v2.0.0)

Root update previews before and after a repeated update contain empty `changes`, `notes` and `failures` arrays. The repeated update reports both tools up to date at 2.0.0, with a byte-identical integration snapshot. Sixteen protected project/spec/change/override/run-input hashes match their pre-migration values. This includes the historical archived host-unspecified OpenSpec metadata and the live 10x run files. The pre-existing router-owned `run.jsonl` edit remains outside implementation staging.

The preserved live metadata SHA-256 is `a8bf83c9b7cab05678dbe961d95d46716493717e7c0e3d5acb8d24cb063698df`, and the preserved live log SHA-256 is `38cfe233376e1123893b1503484030c0f7a937dee1ea741da6cc58ec07a7f92c`. The archived OpenSpec metadata SHA-256 is `4c2d4ddb2120f9a143b1fbf23df4608624a718142e167a4f672d34754c7a8ca0`. The full sixteen-file manifest is retained locally as `preserved-inputs.json`.

The remaining local migration records are `phase2-inventory.json`, `phase2-upstream/registry.json`, `phase2-preview.json`, `phase2-generated.log`, `phase2-generated.diff`, `phase2-link-proof.json` and `phase2-idempotence.json`. The pipeline skill's complete `## Loop` and following sections remain byte-identical, including Anti-stall, result, usage and publication procedures.

## Ambient tool-home isolation

The Phase 3 source audit found that OpenSpec 2.0.0 `getCodexPromptDir` in `dist/core/legacy-cleanup.js` prioritizes CODEX_HOME, while shared skill and update path resolution prioritize USERPROFILE before HOME. Both inherited overrides were unset during the actual migration and earlier gates. The retained `phase3-ambient-audit.json` records that environment observation and upstream source hashes. [Upstream 2.0.0](https://github.com/Fission-AI/OpenSpec/tree/v2.0.0)

The shared fixture CLI environment now removes CODEX_HOME from a copied environment and aligns USERPROFILE with scratch-local HOME. The existing probe matrix supplies nonempty ambient sentinel paths, verifies the isolated subprocess environment and retains its parent-environment immutability check. Thirteen CI/probe tests and the 465-test focused gate passed after this correction. Removing the CODEX_HOME guard made the targeted probe test fail. Exact staged bytes were restored before the final full gate. The earlier Phase 3 full pass remains recorded against the pre-correction candidate.

An initial evidence-reconciliation script stopped on a Markdown hash-table anchor assertion. Correcting the anchor completed the record with source and test outcomes unchanged.

## Candidate and log hashes

The Phase 1 staged source diff SHA-256 was `7040f0133fe088a6875981a0b2621e0178a99e7b46bd53b3562f893354efeb0b`. The Phase 2 staged source diff SHA-256 was `15dcec96b953309008342a7d5518432472afac702030f942beabc6be989ae258`. These exclude Progress/lifecycle bookkeeping and remained unchanged through their corresponding full gates and commits.

| Local raw log | SHA-256 |
| --- | --- |
| `phase1-contract.log` | `1e05b81228d79d80d92dc425f2ac1cde6b26376c70aa92424af36868e516dc90` |
| `phase1-contract-retry.log` | `b038380cd91f7b35d5037417019285f18f2f859b8f284162c8b8a5320420be71` |
| `phase1-full.log` | `d86420c09a83f656b5b82271c874f565a9b44568cb8ec6e65463c8c15e728f83` |
| `phase1-full-retry.log` | `799a2215a79f5f6c3b062ef64860a46397cad50bf9b82ffc7ec51e4e97d88226` |
| `phase2-focused.log` | `03348e58138105ca1664783ac065b8c68e40a4ff9a6b168e4dc8d173966a73f9` |
| `phase2-full.log` | `62f608887dd8f120f99cceda9314c8b449941db1074cf22f9b053474df1fb2b1` |
| `phase3-focused.log` | `8cb28fce7f5470ed60b50213b2b87922412a5c2373d23c5bc2f84e805ad2ece3` |
| `phase3-full.log` | `01e57747c1ab5b47bc78a47ff37316f6783335281f4febb799f4d7a859550792` |
| `phase3-ci.log` | `c6f2bcde467bebf382888c50753055492e1d302701f1413f2671b26dc4522c7a` |
| `phase3-focused-final.log` | `407e5694a6a8b21b77f4bf52306667cbd0877c93f64e12db9da70c9bc69481d7` |
| `phase3-break.log` | `54c5cb8ee9ab17f1f2ccebda27ef6c92eda75d1b941bd406b55aad3add744c2e` |
| `phase3-full-final.log` | `90493eb7bdf0ecac3273e02da07892e141dbc8892388fea6ca0879266fcbadbb` |

## Phase 3 final gates

Row 3.1 passed on the corrected candidate with 463 of 465 tests passing, zero failures/cancellations and the two existing live-GitHub skips, exit 0, in 122879.947125 ms. Existing owners cover exact flat/delegated inline/file replay, fixed host identity, foreign/late completion exclusion, retained native locks, independently staged/working recovery, archive and terminal intent. The exact focused command follows with the worktree/environment setup above. [Test owners](../../../../skills/10x-pipeline/test/README.md)

```sh
CI=1 caffeinate -i node --test --test-concurrency=2 skills/10x-pipeline/test/prompt-handoff.test.mjs skills/10x-pipeline/test/result-persist.test.mjs skills/10x-pipeline/test/late-usage.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/*.test.mjs
```

The additional isolation gate used `CI=1 caffeinate -i node --test tools/test/ci-runner.test.mjs`. It passed 13 tests with zero failures/cancellations/skips in 7098.098792 ms. The deliberate-break command was `node --test --test-name-pattern="openspec availability" tools/test/ci-runner.test.mjs`.

Row 3.2 passed the final full repository command with 1793 tests, 1790 passed, zero failures/cancellations and the three exact expected skips above, exit 0, in 790647.534959 ms. All nine real 2.0.0 CLI contracts executed, including the original five named status cases. Whitespace and version checks passed. The final staged test-source diff remains `f6a7d3eef080d4c1841437893d6771ba143ee851467cf5adcd8ae75ea27b9a9e`, and runtime/integration files still match `c7c9436d`.

Row 3.3 evidence reconciliation passed. The records identify candidate/tool versions, commands, counts, exact skips, failed attempts, every bounded native observation, preserved inputs, collected child returns and unresolved qualification. Every completed Automated Progress row has local evidence. Closing commits belong to canonical Progress.

## Native observations and remaining qualification

The newly spawned `/root/phase3` native leaf received a fresh host skill catalog listing all twelve generated OpenSpec skills under catalog root `r16`, which resolves to this worktree's `.agents/skills`. A read-only metadata check confirmed every canonical `generatedBy` value is exactly `2.0.0`, including the required propose/apply/verify trio. Exact aliases, paths, launch scope and the pending normal-entry cells are recorded in acceptance.md. [Fresh-child observation](acceptance.md#fresh-child-discovery-observation)

The enclosing step collected the Phase 1 leaf and its fix return, then the Phase 2 leaf, before running their gates and commits. The enclosing step collected the Phase 3 evidence return and the Phase 1 leaf's ambient-home correction before their gates. No verified child-inclusive token snapshot is available. Inclusive child coverage and aggregate token totals remain unknown. Gate elapsed times describe their respective test processes.

Manual rows 3.4 and 3.5 remain pending. This Automated-only implementation has made no upgraded normal-entry native pipeline qualification attempt and no external publication attempt. Version probes and the bounded fresh-child catalog observation retain their observed scope. S-20 keeps the final combined-candidate eighteen-run obligation. [Acceptance and handoff](acceptance.md)

## Subsequent publication verification

The enclosing orchestrator subsequently published PR #208 and its requested report comment. A fresh GitHub API check on 2026-11-16 confirmed successful CI and PR-title runs for published head `cb67ce4ee92eaaeb1fea8086913be0838daa9ee6`, satisfying Manual 3.5. Manual 3.4 retains its six pending live-host cells. The earlier implementation and review records retain their pre-publication scope. [Publication acceptance](acceptance.md#publication-acceptance)
