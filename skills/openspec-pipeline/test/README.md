# OpenSpec chain tests (ADR-013)

Index of `skills/openspec-pipeline/test/`. The tests drive the shared router of `skills/10x-pipeline/scripts/` through its CLI and use the helpers of `skills/10x-pipeline/test/`; run them with the whole suite: `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` (shell glob, Node 24 and later). The shared tests and helpers are indexed in `skills/10x-pipeline/test/README.md`. A new test file gets its row here, not in `AGENTS.md`.

| File | Scope |
| --- | --- |
| `openspec-helpers.mjs` | helper: scratch OpenSpec projects built on `helpers.mjs`; seven shared 10x tests import it too |
| `openspec-chain.test.mjs` | the `--chain` switch, run state, collisions and routing order |
| `openspec-steps.test.mjs` | step verification, the `verify.md` verdict, the fix loop, tiers and dropped features |
| `openspec-isolation.test.mjs` | the start and step commits and the rollback of an isolated run |
| `openspec-archive.test.mjs` | the archive branch and the read-only commands |
| `openspec-contract.test.mjs` | exact OpenSpec 2.0.0 CLI contracts (`OPENSPEC_BIN`, default `openspec`): five status/readiness fixtures, custom/core setup, twelve-workflow legacy update, customization and byte preservation, dry-run/idempotence, tracked shared targets and fresh-checkout Claude links, validation and archive success/errors. Unavailable or failed probes skip locally and fail nonempty CI. Successful wrong or malformed version responses fail everywhere |
| `openspec-readers.test.mjs` | the task row pattern of the CLI, the guarded readers of `tasks.md` and `verify.md`, the chain halt on a 10x run, the produced files of `compare` |
| `openspec-skill.test.mjs` | fixed Anti-stall digest, cross-chain equality, literal routing exclusions and reference ownership;  the content of `skills/openspec-pipeline/SKILL.md`: its anti-stall section equals the 10x one, and the single late-usage owner and ordered `done`, `halt`, `archive` references; pins the `Bash timeout:` line (presence, content, placement, equality with the 10x copy); the policy fragment `policy.json` (only `os-` keys, none shared with the 10x policy) and the `@<skill>/prompts/` reference form (accepted and rejected parts, the `cannot be read` halt)  byte ceilings, single authorization owner, archive exit ordering and split dispatch/setup contracts |

CI installs this single pinned CLI as the approved CI-tool exception. A pin upgrade requires a deliberate commit and successful execution of every real contract fixture. Git availability failures also fail the suite when `CI` is nonempty.

The expected non-root Linux CI skips are the following. The default is three with `gh` available and four with `gh` absent. A present `CLAUDE.md` reduces either count by one. Check identities and conditions together.

| Test identity | Condition |
| --- | --- |
| `live: a branch with no pull request is skipped` | `GH_LIVE != 1` |
| `live: the real comment projection is one parseable object per line across pages` | `GH_LIVE != 1` |
| `CLAUDE.md has no @ imports` | `CLAUDE.md` is absent |
| `real gh without a login is not authenticated` | `gh` is absent from `PATH` |

The first two and fourth tests live in `skills/10x-pipeline/test/pr-comment.test.mjs`. The third lives in `tools/test/agents-md-no-imports.test.mjs`. Both permission checks in `no-recursive-delete.test.mjs` execute on the non-root Linux runner. Git-dependent checks and all OpenSpec contract fixtures execute in every successful CI run.
