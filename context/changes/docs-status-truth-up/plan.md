# Documentation status and evidence links implementation plan

## Overview

Give readers a working path from each current claim to the rule, observation or open change that supports it. The source snapshot is `b7437c9f`. Implementation uses documentation-only Conventional Commits of type `docs` with the repository's AI co-author trailer. This planning step leaves its artifacts uncommitted.

## Current State Analysis

- Six rendered links lead to four evidence files that moved to the archive. A raw Markdown search also finds the literal `[doc](x.md)` example at `docs/REFERENCE.md:633`. It renders as code.
- Nine ADR headers say Proposed. Some decisions shipped in part, some were superseded and several have tests that exercise the documented rules. The ADR index still describes a flat delegation ban at `docs/ADR/README.md:24`.
- The Wave 3 schedule cited in S-12's roadmap body predates the v3 ledger. The ledger records an attempted delivery and an unresolved owner decision on PR #214. The roadmap defines planning readiness separately from delivery at `context/foundation/roadmap.md:239`.
- The production `readPlan` reader finds 58 unchecked Manual rows across 35 archived plans and zero unchecked Automated rows. The S-13 and S-14 closeouts show how to record an owner deferral and keep the original rows open.

## Desired End State

All local file links in the README and documentation resolve. Each shipped rule has an accurate status, and readers can identify a current rule without applying a chain of amendments. Each outstanding evidence claim gives the reader its scope and tracker. The roadmap accurately records the two slices, and the archive decision has a durable home.

## Scope boundaries

Item 3 is closed by instruction. Use `context/changes/WAVES.md` v3 as evidence. Implementation excludes edits to that ledger, historical archives, router state, runtime code, tests, release fields and CI. Live host qualification and publication belong to their existing owners.

## Implementation Approach

First repair the evidence links, then use those sources to reconcile ADRs and user-facing claims. Prefer existing roadmap section links for open work whose change folder will eventually move. Use exact archive paths for historical evidence. Keep the behavioral reference in `docs/REFERENCE.md` and the one-line ADR summaries in `docs/ADR/README.md`.

## Phase 1: Repair links to archived evidence

### Changes Required

**Intent.** Restore each link at its source. Paths in the table are relative to `context/archive/`. Preserve labels, filenames and any fragments, using the relative depth of the referring document.

| Source at the planning revision | Archived target |
| --- | --- |
| `docs/REFERENCE.md:21` | `2026-11-13-openai-codex-support/evidence/phase2-permissions.md` |
| `docs/REFERENCE.md:340` | `2026-11-12-step-prompt-by-file/evidence/comparison.md` |
| `docs/REFERENCE.md:411`, ADR-018 line 117, ADR-019 line 86 | `2026-11-18-delegated-token-accounting/evidence/accounting.md` |
| ADR-018 line 91 | `2026-11-12-nested-subagent-hard-stop/evidence/acceptance.md` |

**Contract.** Resolve local destinations relative to the referring Markdown file. Check all of `docs/**/*.md` and the root README, including the HTML header image. The local check below already reproduces exactly the six failures. Use it again after editing. Omit the optional permanent test because the docs-only change can use the installed renderer without introducing a Markdown parser or CI dependency.

### Success Criteria

#### Automated Verification

- Run the local link check in Testing Strategy and confirm zero missing targets across the README and docs.

## Phase 2: Reconcile architecture decisions

### Changes Required

**Intent.** Reconcile the status line with the implementation and the remaining proof separately. Use the existing “Accepted (implemented by an unattended run …)” convention in ADR-022 or equivalent scoped wording. Attribute owner acceptance only where a decision record supports it.

| Record | Disposition and source to check |
| --- | --- |
| 001, 002 | Qualify partial adoption. ADR-001's deterministic routing shipped, ADR-007 pulled scoring forward, and measured churn raises rigor under current policy. The broader lifecycle in ADR-002 is a toolkit design with a shipped pipeline subset, archive opt-in and terminal publication amended by ADR-017. Identify which parts still describe a proposal. |
| 003, 005 | Rigor routing and the read-only baseline comparison shipped. Check `flow.mjs`, both policy files for routed and baseline runs, the `compare` handler and the M-1 closeout. Distinguish the implemented comparison from the unmeasured savings target. |
| 012, 014, 015, 016, 018 | Mark implemented as amended. Check Manual verification in `flow.mjs` and browser evidence tests, the Manual archive gate in both pipeline skills, neutral retry of the stored dispatch in the router, `remove-tree.mjs` and its guards, and bounded native children in `rules/top.md` and both skill loops. Keep host-specific enforcement and qualification limits. |
| 009 | Preserve Accepted. Live checks 1 and 2 have results. The advisor P0 and the flag experiments have separate evidence requirements. Link the original check/experiment record and the FR-017 deferral where applicable. |
| 010 | Preserve Accepted. Archived `2026-11-03-worktree-step-commits/plan.md` rows 2.5, 3.5 and 4.4 cover isolated edits, per-step commits and scratch rollback at their recorded revisions. Identify the still-unproved permission prompt and the unmeasured first-attempt experiment, tracked by `first-attempt-drop-unmeasured`. |
| 017 | Preserve Accepted and the owner's isolation opt-out decision. Distinguish actual published run evidence (S-14 acceptance row 3.5) from the original throwaway-repo, idempotence and terminal-path scenarios in `2026-11-09-worktree-pr-only/evidence/unproven.md` rows 1.5 and 2.4. Name the surviving proof obligations. |

**Contract.** Scan all ADR metadata, inline amendments and outstanding verification notes, including accepted records. Keep historical scenarios and amendment order intact. Where later evidence resolves an old note, annotate it with the dated outcome. For example, the 2026-11-15 release acceptance resolves ADR-008's queue/rerun checks. An unresolved claim gets a named check and a working link to its specific Manual row, evidence register or roadmap/change ID. Preserve operational uses such as a pending dispatch or a pending Manual row.

**Intent.** Insert a short `## Rule in force` immediately after the introductory metadata and before the historical account in each record with at least three distinct amendments. Count substantive dated or inline revisions and explicit supersessions, including unnumbered amendments. Multiple references to the same revision count once.

| ADR | What the current summary must tell the reader |
| --- | --- |
| 003 | Rigor and measured risk drive optional steps. Apply current Manual verification, isolated commits and terminal publication rules, including persisted PR-comment intent. |
| 008 | A green push CI result still at the main tip gates release-please. Squash titles drive Conventional Commits. One SemVer value occupies three fields, with the plugin entry version omitted. |
| 009 | Run provenance and its current exclusions, opt-in restricted mappings and advisor behavior, guarded default Claude dispatch, and provider-specific limits. Count the independent pricing and co-author revisions at line 68 and guarded dispatch at line 128. |
| 010 | Shared setup and configured branch identity, verified step commits and swept-path reporting, and preservation of working and distinct staged versions before rollback. Include the isolation opt-out. |
| 013 | Chain-local policy, definitions and prompts use the shared file-reading router. The OpenSpec contract uses exactly 2.0.0 with CI failure on an unavailable tool and defined local skip behavior. Lines 45 and 55 record two amendments in prose. |
| 017 | The orchestrator's terminal publisher validates the configured branch, pushes without force and opens or reuses a PR with a Conventional title. Include isolation opt-out, optional comment ownership and Manual classification of external acceptance. |
| 018 | One guarded, awaited native child layer with leaf restrictions and enclosing-step ownership. Include settled-child/result identity and attributable step-tree usage. The earlier flat ban and depth-one setup are historical. |
| 024 | Per-rung provider and fixed host, standalone Codex execution, provider-specific safety, bounded native delegation and observed usage after settlement. Cover the unnumbered accounting amendment. |

**Contract.** Update the affected index summaries, especially ADR-018. Use prose for summaries so the original normative scenarios and anchors remain available. Existing tests read these documents, including `nested-subagents.test.mjs:207`, which checks the historical ADR-018 Manual-row wording. Preserve test-backed historical text and explain its scope in the new summary.

### Success Criteria

#### Automated Verification

- Check the ADR inventory in Testing Strategy for current status lines and one top-level Rule in force summary per qualifying record.

#### Manual Verification

- Trace each changed ADR status, summary and outstanding acceptance claim to its implementation, test, decision or dated evidence.

## Phase 3: Resolve user-facing status and archive decisions

### Changes Required

**Intent.** Resolve the four README notes at the point of use. A dated observation may satisfy only part of a sentence. Keep each proven part and give every remaining obligation a stable change ID and evidence link.

| README line | Published behavior and remaining owner |
| --- | --- |
| 32 | The scoped Claude guard ships. State its version, enabled-hook and identity prerequisites. Track first fresh Claude delivery in S-12 `first-unattended-delivery` and effective protection across hosts in S-18 `verified-step-protection`. The original guard plan records the unverified host checks. |
| 103 | The documented print-mode invocation and frontmatter are available. Preserve the historical status of the early-exit prediction. Live invocation/non-selection and complete headless delivery need actual observations. Use the `skills-disable-model-invocation` archive evidence and S-12/S-20 for follow-through. |
| 142 | Claude Code 2.1.311 headless showed native collection. The interactive attempt hit quota. S-14 rows 1.3 and 3.4 explicitly carry final-candidate qualification into S-20 `supported-host-acceptance`. The full Claude pipeline check is also named in `claude-token-figures-default`. |
| 148 | Token accounting shipped in v1.14.0 with fixture-backed checks. Name the unqualified interactive/headless host matrix and immediate, late and archive output checks (accounting rows 4.3/4.4). Track final support in S-20 and Claude default-capture choices in `claude-token-figures-default`. |

**Contract.** Update `context/foundation/roadmap.md` table and matching slice bodies together. Set S-12 to `blocked` for delivery while PR #214 awaits the owner's proof-or-deferral decision. Its historical run proved zero of Manual rows 3.1–3.3. WAVES v3 lines 96, 136 and 141 schedule proof against the Wave 2 release or an explicit deferral. Update stale scheduling and handoff descriptions of these two slices as needed. Preserve the distinction between planning readiness and delivery. Keep S-20 `proposed` with the S-17/S-19 dependencies, S-13/S-14 carryovers, and three normal runs per each of six configurations covering both launch modes, recovery and owner decisions. Record the check with links to the evidence. An S-12 deferral requires an owner decision.

**Intent.** Record the archived-row policy in this change's `change.md` under a dated decision. Cite the 35-plan tally, both archive gates and the S-13/S-14 owner closeouts. Preserve every historical checkbox and its provenance.

**Contract.** Keep recognized open Automated work in implementation before archive (`flow.mjs` checks `autoPending`). Keep `verify-archive` a read-only check of the completed move and stamp. The audit found zero open Automated rows in the archive. Malformed fresh Progress belongs to `plan-zero-rows-skips-implement`. Keep the existing explicit fail-closed Manual choice in the orchestrator. Record an affirmative exception and the affected unresolved row IDs before a future move, with a reason and follow-up destination when deferred. The current loop asks for the decision but does not require its persistence. During implementation, open **only a separate documentation change seed** at `context/changes/record-archive-manual-decision/change.md` for that gap, referencing S-19 `truthful-owner-decision-halts` and the S-13/S-14 examples. Specify acceptance for a clean run, explicit approval and refusal/unavailable answer. Link the ID from the dated decision. Gate implementation and historical backfill are outside this change.

### Success Criteria

#### Automated Verification

- Verify matching S-12 and S-20 table and body statuses and the separate archive-decision change with the checks in Testing Strategy.
- Run the complete Node 24+ suite from the worktree and record its pass, fail and skip counts.
- Rerun the local link check after the final edits and run `git diff --check`.

#### Manual Verification

- Read the four README dispositions and the roadmap and archive decisions against their cited evidence, including the limits of every live-host claim.

## Testing Strategy

Run from the worktree root. The local link check uses the installed Pandoc GFM reader and Python standard library. It skips code examples, external URLs and fragment-only navigation. For file-plus-fragment links it checks the file. Manually follow new section fragments in the documentation review.

```sh
python3 - <<'PY'
from html.parser import HTMLParser
from pathlib import Path
from subprocess import check_output
from urllib.parse import unquote, urlsplit

class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        target = dict(attrs).get({"a": "href", "img": "src"}.get(tag))
        if target:
            url = urlsplit(target)
            if url.path and not url.scheme and not url.netloc:
                if not (source.parent / unquote(url.path)).exists():
                    missing.append(f"{source} -> {url.path}")

missing = []
for source in [Path("README.md"), *sorted(Path("docs").rglob("*.md"))]:
    Links().feed(check_output(["pandoc", "-f", "gfm", "-t", "html5", str(source)], text=True))
print("\n".join(missing) or "All local targets exist")
raise SystemExit(bool(missing))
PY
```

Use this local inventory gate for revised headers and summary placement. Check the index and search `rg -ni 'pending|unverified' README.md docs/ADR` during the separate evidence review.

```sh
python3 - <<'PY'
from pathlib import Path
import re
def adr(n):
    return next(Path("docs/ADR").glob(f"ADR-{n:03}-*.md")).read_text()
for n in [3, 5, 12, 14, 15, 16, 18]:
    status = re.search(r"^- \*\*Status:\*\* (.+)$", adr(n), re.M)
    assert status and not status[1].lower().startswith("proposed"), n
for n in [3, 8, 9, 10, 13, 17, 18, 24]:
    sections = re.findall(r"^## (.+)$", adr(n), re.M)
    assert sections[0] == "Rule in force" and sections.count("Rule in force") == 1, n
PY
```

For the roadmap and follow-up, run the following local assertions:

```sh
python3 - <<'PY'
from pathlib import Path
import re
roadmap = Path("context/foundation/roadmap.md").read_text()
for item, state in [("S-12", "blocked"), ("S-20", "proposed")]:
    row = next(line for line in roadmap.splitlines() if line.startswith(f"| {item} |"))
    assert row.rstrip().endswith(f"| {state} |"), row
    section = roadmap.split(f"### {item}: ", 1)[1]
    section = re.split(r"^#{2,3} ", section, maxsplit=1, flags=re.M)[0]
    assert f"- **Status:** {state}" in section
followup = "record-archive-manual-decision"
assert followup in Path("context/changes/docs-status-truth-up/change.md").read_text()
assert f"change_id: {followup}" in Path(f"context/changes/{followup}/change.md").read_text()
PY
```

Run the exact project gate after the final substantive edits:

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

Record actual skip reasons alongside the exit status. The suite and rendered links are pre-publication checks. They do not establish host qualification. Manual review uses local sources and dated evidence. This change has no new external acceptance prerequisite.

## Migration Notes

Only documentation readers see these changes. Preserve filenames, decision history and link anchors for existing readers. Roll back a mistaken disposition with a correcting docs commit. No run data migration is needed.

## References

- [Change request](change.md) and [Wave decisions](../WAVES.md)
- [Roadmap](../../foundation/roadmap.md) and [ADR index](../../../docs/ADR/README.md)
- [Release acceptance](../../archive/2026-11-12-release-after-green-ci/evidence/acceptance-2026-11-15.md) and [initial PR checks](../../archive/2026-11-09-worktree-pr-only/evidence/unproven.md)
- [S-13 archive decision](../../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#owner-archive-decision) and [S-14 closeout](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout)
- [Accounting evidence](../../archive/2026-11-18-delegated-token-accounting/evidence/accounting.md) and [Claude accounting follow-up](../claude-token-figures-default/change.md)

## Progress

### Phase 1: Repair links to archived evidence

#### Automated

- [ ] 1.1 Run the local link check in Testing Strategy and confirm zero missing targets across the README and docs.

### Phase 2: Reconcile architecture decisions

#### Automated

- [ ] 2.1 Check the ADR inventory in Testing Strategy for current status lines and one top-level Rule in force summary per qualifying record.

#### Manual

- [ ] 2.2 Trace each changed ADR status, summary and outstanding acceptance claim to its implementation, test, decision or dated evidence.

### Phase 3: Resolve user-facing status and archive decisions

#### Automated

- [ ] 3.1 Verify matching S-12 and S-20 table and body statuses and the separate archive-decision change with the checks in Testing Strategy.
- [ ] 3.2 Run the complete Node 24+ suite from the worktree and record its pass, fail and skip counts.
- [ ] 3.3 Rerun the local link check after the final edits and run `git diff --check`.

#### Manual

- [ ] 3.4 Read the four README dispositions and the roadmap and archive decisions against their cited evidence, including the limits of every live-host claim.
