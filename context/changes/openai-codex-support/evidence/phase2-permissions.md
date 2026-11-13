# Phase 2 permission boundary

Verified 2026-11-14 with Node 24.19.0 and Codex CLI 0.169.0. The runner and router were the uncommitted Phase 2 working tree following `49da3cf`.

## Commands and results

`node --test skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/run-lock.test.mjs` passed all 47 tests. Log at `/tmp/agent-smith-codex-p2-scoped.log` during implementation.

`node /tmp/agent-smith-codex-real-proof.mjs` exercised the runner's actual generated permission probe through the installed native sandbox. A command shim forwarded `sandbox` to the real CLI and replaced `exec` with a deterministic sandboxed Git worker. Paid model calls were zero. Both fixtures were isolated from the user's Codex configuration, credentials and repository history. The command required host approval to start the native macOS sandbox outside the enclosing desktop sandbox.

Both default configuration (`profile: null`, no `-p`) and explicitly selected `proof-profile` configuration passed. The fixture configured native `default_permissions` with read access to the filesystem and write access to its scratch directories and actual shared `.git` metadata. The named configuration existed only in the temporary fixture. Product code creates no profiles and grants no permissions.

| Check | Default configuration | Named configuration |
| --- | --- | --- |
| Run root was an actual linked Git worktree | PASS | PASS |
| Generated probe wrote and removed unique files in resolved Git metadata, shared objects and refs | PASS | PASS |
| Generated probe created a typed commit in a disposable linked worktree | `c0389ef94cf5daad21afb7882359f4a2087b3dab` | `8d896c1dc3f9ea7cce8f26297af88dd6d54dc5cd` |
| Deterministic sandboxed child committed before emitting RESULT | `cbb36d660e72d2c16a6092f2e6942c8c6bb3fe51` | `1f4caec27afc28588fe20d44d7e0a362032fb05b` |
| RESULT commit equaled linked-worktree HEAD | PASS | PASS |
| Replacing fixture permission rules with read-only rules refused before model launch | PASS | PASS |
| Runner-owned temporary directories removed | PASS | PASS |

The proof commits belonged to disposable scratch repositories. Fixture cleanup used `removeTree` after inspection.

## CLI limitations

The native sandbox and `exec` share configuration selection and the process working directory. Sandbox includes managed requirements by default when no explicit permissions-profile `-P` is supplied. Its `-C` and `--include-managed-config` flags require `-P`, so the runner uses the spawned working directory and supplies neither flag to sandbox.

Native sandbox can replace ambient legacy `sandbox_mode` settings with read-only permissions. A failed probe therefore establishes inability to verify the required capability. It cannot establish that `exec` has identical restrictions. The runner refuses that unresolved preflight with an explicit diagnostic. A named configuration profile is optional throughout.

The proof covers filesystem access and Git execution under the native sandbox. It does not exercise Codex shell-tool execpolicy decisions or hooks around model-generated commands. `exec` retains those controls. Live hook/approval behavior remains pending in Manual row 4.6. No live model execution, toolkit discovery, Claude dispatch or external posting was claimed by this proof.

Pinned native behavior was checked in `rust-v0.169.0`, including sandbox legacy handling, flag constraints and final-message output. Final-message output writes exact assistant bytes without appending a newline. [Sandbox implementation](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/cli/src/debug_sandbox.rs), [CLI flags](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/cli/src/lib.rs), [Final-message writer](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/exec/src/event_processor.rs)
