# License and security policy implementation plan

## Overview

Migrate project-owned material to Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International, remove the commercial trial, and provide a security policy proposal in SECURITY.md. Align the public documentation and plugin license metadata so readers can identify the terms and find private reporting instructions.

The owner confirmed CC BY-NC-ND 4.0 International and approved the phase structure during planning on 2026-11-16.

## Current State Analysis

The research baseline is commit `adff64f7332b141c1ded8b29e5085d9b696a4d18`, with pre-existing uncommitted drafts in LICENSE, README.md, `.claude-plugin/plugin.json` and SECURITY.md. The committed license contains custom noncommercial-project terms and a commercial trial. The drafts already use CC BY-NC-ND 4.0, remove the trial from the active licensing declarations and label SECURITY.md as a proposal. Implementation should reconcile and verify those drafts against this plan. Their presence provides a starting point for execution, with acceptance recorded through Progress. [Research](/Users/blazej/.codex/worktrees/b4ff/agent-smith/context/changes/license-and-security-policy/research.md:20)

Historical Git objects contain an earlier Unlicense dedication. Third-party material includes the credited README image and OpenSpec-generated skills carrying MIT notices. The researched guard, recovery, publication and CI paths define the security boundaries the proposal should describe. [Licensing findings](/Users/blazej/.codex/worktrees/b4ff/agent-smith/context/changes/license-and-security-policy/research.md:30) · [Security findings](/Users/blazej/.codex/worktrees/b4ff/agent-smith/context/changes/license-and-security-policy/research.md:48)

## Desired End State

- LICENSE carries the official CC BY-NC-ND 4.0 legal text, the existing copyright attribution and a clear project-owned-material scope with third-party exceptions.
- README describes noncommercial sharing, attribution and the adaptation-sharing restriction, preserves historical licensing provenance, and links to LICENSE and the security proposal.
- The plugin manifest declares `CC-BY-NC-ND-4.0`.
- SECURITY.md presents a reviewable proposal for private reporting, supported versions, response and disclosure, authorized research and maintainer handling, with qualified descriptions of security controls.
- Local content and packaging checks pass, with maintainer review represented explicitly in Manual acceptance.

### Key Discoveries

- The canonical draft license text matched the official Creative Commons source during research after final-newline normalization. [Research verification](/Users/blazej/.codex/worktrees/b4ff/agent-smith/context/changes/license-and-security-policy/research.md:80)
- CC BY-NC-ND permits producing adaptations for noncommercial purposes while restricting their sharing. Standard terms and the earlier Unlicense history need accurate treatment in explanatory prose. [License grant](/Users/blazej/.codex/worktrees/b4ff/agent-smith/LICENSE:151) · [Historical findings](/Users/blazej/.codex/worktrees/b4ff/agent-smith/context/changes/license-and-security-policy/research.md:66)
- Security response values and release support originate in the draft proposal. Their wording should communicate proposed commitments awaiting adoption. [Security proposal](/Users/blazej/.codex/worktrees/b4ff/agent-smith/SECURITY.md:3)
- The version guard checks release versions and descriptions. Canonical legal text and policy content need dedicated content checks. [Version guard](/Users/blazej/.codex/worktrees/b4ff/agent-smith/tools/version-check.mjs:36)

## Scope Boundaries

Implementation ownership covers LICENSE, the License and More sections of README.md, `.claude-plugin/plugin.json`'s license field, and SECURITY.md. Execution tracking belongs in this change's plan and identity metadata. Existing runtime behavior, release-version assignment, security controls, upstream notices and historical artifacts provide the surrounding contracts for this document change.

Resolve the implementation targets `LICENSE`, `README.md`, `.claude-plugin/plugin.json` and `SECURITY.md` against the active implementation root. Absolute file links in this plan serve as navigation references.

SECURITY.md is a policy proposal. Operational adoption, live inbox monitoring, hosted security settings and runner qualification belong to the maintainer's subsequent operational work. Public patch licensing follows the selected standard license and any separately granted permissions.

## Implementation Approach

Review the existing drafts against the approved license version and researched scope. Retain correct content, make the required corrections in the responsible document or metadata field, and verify the resulting declarations together. Use the official Creative Commons legal text as the license source. Keep project attribution and scope statements outside that canonical text.

Use the existing security proposal as the policy baseline. Its proposed defaults are latest-stable security support, reports against `main`, discretionary older-line fixes, private contact through `blazej@ksycki.pl`, acknowledgment within five business days, initial triage within ten business days, updates at least every ten business days during an active investigation, and coordinated disclosure targeted within 90 days with agreed adjustments. These remain best-effort proposals for maintainer review.

## Phase 1: Align licensing declarations

### Overview

Make LICENSE, README and plugin metadata describe the approved CC BY-NC-ND 4.0 terms consistently, including trial removal and the scope of project-owned material.

### Changes Required

#### 1. License text and attribution

**File** — [LICENSE](/Users/blazej/.codex/worktrees/b4ff/agent-smith/LICENSE)

**Intent** — Apply the approved license to project-owned material using the official legal text. Preserve attribution and distinguish separately credited third-party material through the scope statement.

**Contract** — The project header retains `Copyright (c) 2026 Błażej Ksycki`, names CC BY-NC-ND 4.0 International and provides its official URL. The canonical text follows intact, allowing final-newline normalization.

#### 2. Reader-facing licensing explanation

**File** — [README.md](/Users/blazej/.codex/worktrees/b4ff/agent-smith/README.md)

**Intent** — Replace the custom trial explanation with a concise description of the selected terms. Preserve the provenance of separately licensed material and earlier distributions.

**Contract** — The License section identifies the license version, attribution requirement, noncommercial reproduction/sharing and adaptation-sharing restriction. It identifies the third-party exceptions, explains that historical distributions retain their supplied terms, and links to LICENSE and the official license summary. Permissions beyond the public license use the existing owner contact.

#### 3. Plugin license declaration

**File** — [.claude-plugin/plugin.json](/Users/blazej/.codex/worktrees/b4ff/agent-smith/.claude-plugin/plugin.json)

**Intent** — Expose the same license identifier to plugin metadata consumers.

**Contract** — The `license` field equals `CC-BY-NC-ND-4.0`. Version assignment follows the repository's existing release process.

### Success Criteria

#### Automated Verification

- LICENSE matches the official CC BY-NC-ND 4.0 legal text after final-newline normalization and retains the copyright and third-party scope header.
- README and plugin metadata identify CC BY-NC-ND 4.0 consistently, and the active licensing declarations contain zero commercial-trial or custom-license-placeholder references.

#### Manual Verification

- The maintainer accepts the licensing explanation, attribution, third-party scope and historical-distribution wording.

## Phase 2: Refine the security proposal and verify

### Overview

Complete the proposed security policy, connect it to README and verify the document/metadata change as a whole.

### Changes Required

#### 1. Security policy proposal

**File** — [SECURITY.md](/Users/blazej/.codex/worktrees/b4ff/agent-smith/SECURITY.md)

**Intent** — Give reporters a practical private-reporting process and the maintainer a reviewable response policy appropriate to an agent-executing developer tool.

**Contract** — Keep the proposal designation and review requirement. Cover supported versions, private reporting to the existing owner address, useful reproduction/environment details, redaction and sensitive-evidence handling, scope and security boundaries, response/disclosure targets, authorized research and maintainer handling. Use the proposed defaults recorded under Implementation Approach. Reporter credit requires consent, disclosure timing permits coordination, and safe-harbor commitments or financial rewards require separate written agreement.

Describe the researched boundaries accurately. The worktree and recovery mechanisms protect Git workflow and preservation. Host permissions govern broader execution access. Scoped Bash-hook coverage depends on host support, identity and configuration. Include unauthorized publication, sensitive reports and CI/release trust boundaries in the reporting scope. Link to the reference for current coverage and acceptance evidence.

#### 2. Policy discovery

**File** — [README.md](/Users/blazej/.codex/worktrees/b4ff/agent-smith/README.md)

**Intent** — Make the policy discoverable from the existing documentation links.

**Contract** — The More section links to SECURITY.md and identifies its proposal status consistently with the document heading.

### Success Criteria

#### Automated Verification

- SECURITY.md contains the proposal designation, reporting address, support scope, reporting guidance, security boundaries, proposed response/disclosure targets, research expectations and maintainer handling.
- Relative document links in README and SECURITY.md resolve, and `git diff --check` passes.
- The repository packaging guard passes with `node tools/version-check.mjs`.

#### Manual Verification

- The maintainer accepts SECURITY.md as a proposal, including its proposed support and response defaults, private reporting guidance and qualified security-boundary claims.

## Testing Strategy

### Content and metadata checks

Fetch the canonical legal text from `https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.txt` using certificate-validating transport. Compare the legal-text portion of LICENSE with that source after normalizing its terminal newline. Check the separate project header for attribution, scope and the official license URL.

Parse the plugin manifest and verify its license identifier. Check README and LICENSE for the approved version, with a focused search for the former commercial-trial wording and `SEE LICENSE IN LICENSE`. Limit trial-removal acceptance to the active licensing declarations, since research and historical documents legitimately describe the former trial.

Use a focused content check for the required SECURITY.md sections and proposed values. Resolve relative document links with anchors handled separately from file paths. Run `git diff --check` and `node tools/version-check.mjs`. Existing standard-library tools are sufficient for these checks.

### Manual review

Review licensing prose against the canonical grant and historical provenance. Review SECURITY.md as a proposal against the source-backed boundaries in research, including the distinction between host permissions, Git worktree isolation and scoped hook enforcement. Record review evidence in the corresponding Manual Progress rows.

### Runtime verification scope

This plan's verification concerns document content, links and packaging metadata. If execution introduces changes to scripts, runtime policies, prompts or tools, apply the repository's full-suite requirement from AGENTS.md to that changed scope. [Repository commands](/Users/blazej/.codex/worktrees/b4ff/agent-smith/AGENTS.md:16)

## Performance Considerations

The planned deliverables are prose and license metadata. The existing router and agent execution paths retain responsibility for runtime performance.

## Migration Notes

The revision landing the licensing change establishes the new declaration for material distributed from that revision under the selected terms. Historical copies retain their accompanying licensing evidence, including the earlier Unlicense dedication. Explanatory prose must account for rights obtained through those earlier terms and for third-party rights.

A repository-file correction can use a reviewed inverse patch that preserves intervening work. The CC grant is irrevocable within its terms, and its separate-licensing provision preserves existing grants. File rollback therefore requires the historical and legal provenance to remain visible in any later licensing explanation. [License grant](/Users/blazej/.codex/worktrees/b4ff/agent-smith/LICENSE:151) · [Separate licensing](/Users/blazej/.codex/worktrees/b4ff/agent-smith/LICENSE:349)

Creative Commons recommends against using CC licenses for software because of source-distribution, patent and compatibility considerations. The owner confirmed the selected license during planning. [Official guidance](https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software)

SECURITY.md remains a proposal through this change. Its operating defaults provide content for review. Adoption requires the maintainer to establish the reporting ownership and actual operational commitments.

## References

- [Change request](/Users/blazej/.codex/worktrees/b4ff/agent-smith/context/changes/license-and-security-policy/change.md)
- [Research](/Users/blazej/.codex/worktrees/b4ff/agent-smith/context/changes/license-and-security-policy/research.md)
- [Official CC BY-NC-ND 4.0 text](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.txt)
- [Creative Commons software guidance](https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software)
- [Step safety and guard coverage](/Users/blazej/.codex/worktrees/b4ff/agent-smith/docs/REFERENCE.md:33)
- [Repository verification rules](/Users/blazej/.codex/worktrees/b4ff/agent-smith/AGENTS.md:16)

## Progress

### Phase 1: Align licensing declarations

#### Automated

- [x] 1.1 LICENSE matches the official CC BY-NC-ND 4.0 legal text after final-newline normalization and retains the copyright and third-party scope header. — cea239c2
- [x] 1.2 README and plugin metadata identify CC BY-NC-ND 4.0 consistently, and the active licensing declarations contain zero commercial-trial or custom-license-placeholder references. — cea239c2

#### Manual

- [x] 1.3 The maintainer accepts the licensing explanation, attribution, third-party scope and historical-distribution wording. — 80d30de7

### Phase 2: Refine the security proposal and verify

#### Automated

- [x] 2.1 SECURITY.md contains the proposal designation, reporting address, support scope, reporting guidance, security boundaries, proposed response/disclosure targets, research expectations and maintainer handling. — e00555c8
- [x] 2.2 Relative document links in README and SECURITY.md resolve, and `git diff --check` passes. — e00555c8
- [x] 2.3 The repository packaging guard passes with `node tools/version-check.mjs`. — e00555c8

#### Manual

- [x] 2.4 The maintainer accepts SECURITY.md as a proposal, including its proposed support and response defaults, private reporting guidance and qualified security-boundary claims. — 80d30de7
