# OpenSpec 2.0.0 compatibility research

Investigated 2026-11-16 for Wave 2 / S-13 before implementation edits. The accepted Wave 1 baseline is `58ce4ea8`, following acceptance PR #205 and release PR #206. The planning worktree is on its existing run branch at `55d711d23d84fd880b3d55c9d83948ae55519f0e`.

## Exact environment and evidence scope

| Tool | Observed version | Evidence scope |
| --- | --- | --- |
| Node.js | `v24.19.0` | Local executable contract checks on macOS |
| npm | `11.17.0` | Version inspection |
| Git | `2.54.0 (Apple Git-157)` | Version and read-only repository inspection |
| OpenSpec | `2.0.0` | Five existing fixtures, fresh setup, validation and archive probes |
| Codex CLI | `0.169.0` | Version inspection, which warned that PATH aliases could not be created |
| Claude Code | `2.1.311` | Version inspection |
| Python | `3.10.11` | Upstream research leaf, HTTPS certificate validation failed |

Node HTTPS with normal certificate validation succeeded for upstream research. No npm package was installed during planning. Host version probes establish installed versions. Native pipeline qualification on the upgraded candidate remains pending.

Two read-only native research leaves returned to enclosing plan step 2. Host identities were `/root/upstream_compatibility` and `/root/contracts_inventory`. They wrote no files. Child-inclusive token coverage is unknown, and this research supplies no aggregate token total.

## Authoritative upstream findings

- The exact release tag `v2.0.0` resolves to `d12c2817776779e06891d68230773b3bb673b106`. npm declares Node `>=22.12.0`. The published integrity is `sha512-TsGwEAWogMOhuI8npa3o8Y3popwqBIHLdbn80KGUv6rSExvlmY1kYNALMfSZG+qbliH9gffc+CWC4JPlkoFshw==`. The research leaf verified the tarball digest in memory. [Release](https://github.com/Fission-AI/OpenSpec/releases/tag/v2.0.0) [Registry](https://registry.npmjs.org/@fission-ai/openspec/2.0.0)
- Generated skills move to `.agents/skills/`. Claude Code receives project-relative links under `.claude/skills/`, and Codex reads the shared directory. `/opsx:*` command files are retired. Updates preserve customized legacy tool copies and commands, while edits to canonical `.agents/skills/openspec-*` can be overwritten without backup. The guide requires preserving work in Git and offers `update --dry-run`. [Upgrade guide](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/docs-lab/help/upgrade-to-2.md)
- The `core` workflow set is `propose, explore, apply, update, sync, archive`. The pipeline also needs `verify`, available through a `custom` profile. All twelve existing workflow IDs remain available. Profiles accept `core` and `custom`. `config set workflows` accepts a JSON array. [Profiles](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/src/core/profiles.ts#L14) [Config validation](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/src/commands/config.ts#L407)
- The task checkbox pattern and counting semantics are unchanged. Apply instructions now retain wrapped task descriptions. The named propose/apply/verify skills and their numbered steps retain the interfaces used by the pipeline prompts. [Task parser](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/src/utils/task-progress.ts#L55) [Release comparison](https://github.com/Fission-AI/OpenSpec/compare/v1.16.1...v2.0.0)
- The published `dist/core/archive.js` and `dist/cli/index.js` compare byte-identically between 1.16.1 and 2.0.0. `archive --yes --json` remains available. Diagnostic `fix` is optional. The local collision probe confirmed an error with `severity`, `code` and `message`, with `fix` absent. [CLI](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/src/cli/index.ts#L612) [Archive diagnostics](https://github.com/Fission-AI/OpenSpec/blob/v2.0.0/src/core/archive.ts#L195)

## Repository contracts and ownership

| Boundary | Current owner and observed contract |
| --- | --- |
| CI executable | `.github/workflows/ci.yml` installs 1.16.1 in a fresh runner-temp prefix and exports its exact executable. `tools/test/ci-runner.test.mjs` pins the version, success/failure stubs and five availability-fixture identities. |
| File-derived readiness | `skills/openspec-pipeline/scripts/openspec.mjs` requires proposal, delta specs and tasks. Design is optional. The router never invokes OpenSpec. |
| Project inputs | `openspec/config.yaml` contains custom context/rules. Each change retains `.openspec.yaml`, artifacts and ticks. The repository tracks twelve 1.16.1 `.claude/skills/openspec-*` copies and twelve legacy command files. |
| Saved execution | Shared `route.mjs`, `flow.mjs` and `state.mjs` own metadata, pending prompts/handoffs, result intake, provenance, isolation and recovery. Exact saved prompt replay already has both-chain regressions. |
| Verify | The verify step owns `agent-smith/verify.md`. The larger of the header/list critical counts controls the verdict. |
| Archive | The archive child runs the CLI once. Router prechecks and pre-archive commit precede it. The CLI merges specs and moves the entire change directory. |
| Publication | The orchestrator alone invokes `open-pr.mjs`, then the authorized report comment script with the correct live/archived report path. |

A read-only inventory found one historical OpenSpec run at `openspec/changes/archive/2026-11-09-openspec-project-rules/agent-smith/`. Its metadata predates `host`, and its four completed numbered entries have no saved pending prompt/handoff. No live OpenSpec run metadata was found in this checkout. External consumer runs remain covered by compatibility fixtures, including old flat and current delegated pending dispatches. This inventory supplies no authorization to rewrite historical state.

Wave 0's OpenSpec acceptance cells 3, 4, 7, 8, 11 and 12 remain pending. Its earlier bounded Codex headless smoke collected a child nonce and advanced `os-propose` to `os-apply` once. Delegated token inclusion remains unproved. The upgraded generated skills require fresh discovery and delegation evidence on the upgrade candidate. [Wave 0 acceptance](../nested-step-delegation/evidence/acceptance.md) [Recorded capabilities](../nested-step-delegation/evidence/capabilities.md)

## Executed checks

All scratch data lived beneath the run worktree's ignored `.claude/worktrees/openspec-2-plan-check/`. Existing helpers cleaned each fixture through `removeTree`. Global configuration paths were redirected into the scratch project for setup/archive commands. Planning left production code and generated integration files untouched.

The existing real contract command passed all five fixtures with zero failures and zero skips on OpenSpec 2.0.0.

```sh
cd "/Users/blazej/.codex/worktrees/5f77/agent-smith/.claude/worktrees/agent-smith-openspec-2-upgrade" && TMPDIR="$PWD/.claude/worktrees/openspec-2-plan-check" OPENSPEC_TELEMETRY=0 DO_NOT_TRACK=1 node --test skills/openspec-pipeline/test/openspec-contract.test.mjs
```

An exploratory archive probe first passed valid validation, archive JSON, main-spec merge and extra-folder preservation, then failed its own assertion that every collision error includes `fix`. The assertion was corrected to reflect the observed optional field. The second probe passed setup, validation, archive and collision assertions. Its exact executable logic follows. The ignored scratch parent must exist before running it.

```sh
cd "/Users/blazej/.codex/worktrees/5f77/agent-smith/.claude/worktrees/agent-smith-openspec-2-upgrade" && TMPDIR="$PWD/.claude/worktrees/openspec-2-plan-check" OPENSPEC_TELEMETRY=0 DO_NOT_TRACK=1 node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { makeOpenspecProject } from "./skills/openspec-pipeline/test/openspec-helpers.mjs";
import { cleanupAll, cleanEnv } from "./skills/10x-pipeline/test/helpers.mjs";
const project = makeOpenspecProject({ proposal: true, design: true, specs: 1, tasks: { done: 1 } });
function cli(args) {
  const result = spawnSync("openspec", args, {
    cwd: project.root, encoding: "utf8", timeout: 30000,
    env: { ...cleanEnv(), HOME: project.base,
      XDG_CONFIG_HOME: path.join(project.base, "xdg-config"),
      XDG_CACHE_HOME: path.join(project.base, "xdg-cache"),
      XDG_DATA_HOME: path.join(project.base, "xdg-data"),
      OPENSPEC_TELEMETRY: "0", DO_NOT_TRACK: "1" },
  });
  assert.equal(result.error, undefined);
  console.log(JSON.stringify({ args, exit: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() }));
  return result;
}
try {
  for (const args of [["config", "set", "profile", "custom"],
    ["config", "set", "workflows", '["propose","apply","verify"]'],
    ["init", "--tools", "claude,codex", "--profile", "custom", "--no-animation", "--no-copilot-cloud"]]) {
    assert.equal(cli(args).status, 0);
  }
  for (const name of ["openspec-propose", "openspec-apply-change", "openspec-verify-change"]) {
    const file = path.join(project.root, ".agents/skills", name, "SKILL.md");
    assert.match(fs.readFileSync(file, "utf8"), /generatedBy: "2\.0\.0"/);
    const claude = path.join(project.root, ".claude/skills", name);
    assert.ok(fs.lstatSync(claude).isSymbolicLink());
    assert.equal(fs.realpathSync(claude), fs.realpathSync(path.dirname(file)));
  }
  fs.mkdirSync(project.agentDir, { recursive: true });
  fs.writeFileSync(path.join(project.agentDir, "evidence.txt"), "preserved extra folder\n");
  fs.writeFileSync(path.join(project.changeDir, "specs/cap-1/spec.md"),
    "## ADDED Requirements\n\n### Requirement: Thing\n\nThe system SHALL do it.\n\n#### Scenario: Thing works\n- **WHEN** a thing is requested\n- **THEN** the system does it\n");
  assert.equal(cli(["validate", project.id, "--json"]).status, 0);
  const archive = cli(["archive", project.id, "--yes", "--json"]);
  assert.equal(archive.status, 0);
  const json = JSON.parse(archive.stdout.slice(archive.stdout.indexOf("{")));
  assert.ok(json.archive?.archivedAs);
  assert.equal(fs.existsSync(project.changeDir), false);
  const archived = path.join(project.root, "openspec/changes/archive", json.archive.archivedAs);
  assert.equal(fs.readFileSync(path.join(archived, "agent-smith/evidence.txt"), "utf8"), "preserved extra folder\n");
  assert.match(fs.readFileSync(path.join(project.root, "openspec/specs/cap-1/spec.md"), "utf8"), /Requirement: Thing/);
  fs.mkdirSync(project.changeDir, { recursive: true });
  const conflict = cli(["archive", project.id, "--yes", "--json"]);
  assert.notEqual(conflict.status, 0);
  const failed = JSON.parse(conflict.stdout.slice(conflict.stdout.indexOf("{")));
  assert.equal(failed.archive, null);
  assert.ok(failed.status.some(item => item.code === "archive_target_exists" && item.severity === "error" && item.message));
} finally {
  cleanupAll();
}
NODE
```

Fresh setup printed the ignored `--no-copilot-cloud` flag notice because GitHub Copilot was absent from the selected tool set. All commands exited successfully except the intentionally conflicting archive, which exited 1 with `archive: null` and `archive_target_exists`. The initial failed exploratory assertion is retained above as part of the investigation outcome.

## Planning decisions and remaining proof

The unattended invocation replaces interview/phase approvals with evidence-backed assumptions. Preserve all twelve existing project workflows during generated-file migration. Use the required three-workflow set in a separate clean-install fixture. Retain the current state format, routing and policy because observed CLI compatibility supports them. Clarify optional archive diagnostic fields and update setup/discovery instructions for the actual 2.0.0 layout.

Implementation must add retained regression coverage for setup/update and validation/archive, run the full suite, and produce a fresh exact-version acceptance record. Planning did not execute a full suite, real legacy-project update, model-backed upgraded pipeline run, interruption probe, PR CI or publication. These are explicit plan criteria with appropriate local or Manual classification.
