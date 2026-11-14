# OpenSpec chain prompts

Decision guides of the OpenSpec chain of `/agent-smith:openspec-pipeline` (ADR-013). `skills/openspec-pipeline/policy.json` refers to a file as `@openspec-pipeline/prompts/<file>.md`, as one part of an array prompt; the router merges that file with `skills/10x-pipeline/policy.json` and resolves the reference before it fills `{id}` (the OpenSpec change name), `{goal}` and, in the `os-apply-fix` template, `{findings}` (the `- ` lines under `## Critical` of `verify.md`, or `see verify.md` when there are none). The placeholder and reference rules are those of `skills/10x-pipeline/prompts/README.md`. The guides are written for this pipeline and have no course source.

| File | Step | Wired as |
| --- | --- | --- |
| `os-propose.md` | decision guide for the ask points of `/openspec-propose`: continue the existing change, decide a material ambiguity from repository evidence or end `blocked`, write only inside `openspec/changes/{id}/`, no code | `os-propose` template |
| `os-apply.md` | decision guide for the pause points of `/openspec-apply-change`: tick finished tasks as `- [x]`, never untick, never archive; commit the code (never the change folder) under a typed Conventional Commits subject and never stash; fix mode fixes the critical findings of `verify.md` and keeps the ticks | `os-apply` and `os-apply-fix` templates (`os-apply-fix` adds `{findings}`) |
| `os-verify.md` | runs `/openspec-verify-change` read-only and writes `openspec/changes/{id}/agent-smith/verify.md`: the `Verdict`, `Critical` and `Warnings` lines, then `## Critical` and `## Warnings`, then the report | `os-verify` template |
| `os-archive.md` | runs `openspec archive {id} --yes --json` once, never the archive skill; a CLI error ends `blocked`; on success commits only the change folder, the archive folder and `openspec/specs/` as `chore(archive): close {id}` | `os-archive` template, returned by the `archive` action of an OpenSpec run started with `--archive` |
