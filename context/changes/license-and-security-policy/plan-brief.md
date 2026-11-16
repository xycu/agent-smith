# License and security policy — Plan brief

> [Full plan](plan.md)
> [Research](research.md)

## What & Why

Migrate project-owned material to CC BY-NC-ND 4.0 International and remove the commercial trial. Provide a security policy proposal so reporters can find private reporting instructions and the maintainer can review an explicit response process.

## Starting Point

The committed baseline uses a custom license with a commercial trial. Pre-existing uncommitted drafts already update LICENSE, README and plugin metadata and introduce SECURITY.md. This plan reconciles and verifies those drafts through pending acceptance checks.

## Desired End State

LICENSE, README and plugin metadata identify the approved license consistently, with attribution, third-party exceptions and historical licensing provenance. README links to a clearly designated SECURITY.md proposal covering reporting, support, response, disclosure and the project's actual security boundaries.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| License | CC BY-NC-ND 4.0 International | Names the exact terms and metadata identifier. | Owner confirmation during Plan |
| Commercial trial | Remove from active licensing declarations | Fulfills the explicit follow-up request. | Change request |
| Existing drafts | Reconcile and verify as the starting point | Preserves local work and aligns acceptance with the approved plan. | Research / Plan |
| Historical rights | Preserve earlier distribution terms and Unlicense provenance | Accounts for rights already granted and separately owned material. | Research |
| Security deliverable | Clearly designated proposal | Matches the requested policy proposal and separates operational adoption. | Change request / Plan |
| Reporting and support defaults | Existing owner email, latest-stable fixes, `main` reports, discretionary older-line fixes | Supplies concrete policy content for review. | Researched draft / Plan |
| Response defaults | Acknowledgment within five business days, initial triage within ten, updates at least every ten business days during active investigation, disclosure targeted within 90 days with coordinated adjustments | Defines reviewable best-effort targets with coordinated adjustments. | Researched draft / Plan |
| Phase structure | Licensing alignment, then security refinement and verification | Groups the requested deliverables into reviewable phases. | Owner approval during Plan |

## Scope

Implementation covers LICENSE, README's licensing and discovery sections, the plugin license field and SECURITY.md. Plan Progress tracks content checks and maintainer review. Runtime controls, version assignment, upstream notices and historical records provide the surrounding contracts.

## Architecture / Approach

Retain correct draft content and make corrections in the document or metadata field that owns each declaration. Compare the legal text with the official Creative Commons source. Ground security-boundary prose in the existing research and keep the response/support values explicitly proposed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Align licensing declarations | Consistent CC BY-NC-ND 4.0 terms, trial removal, attribution and exceptions | Overstating restrictions on previously licensed or third-party material. |
| 2. Refine the security proposal and verify | Reviewable security proposal, discovery link and local validation | Presenting proposed commitments or host-dependent controls as established guarantees. |

**Prerequisites** — Existing drafts and research in this worktree, standard-library content-check tools, Node.js for the packaging guard, and access to the canonical legal text.

**Estimated effort** — One short implementation session across the approved phases, followed by maintainer content review.

## Open Risks & Assumptions

- The owner controls licensing of the scoped project-owned material. Third-party permission provenance remains a maintainer concern.
- Earlier Unlicense rights and the CC grant's irrevocability limit what later licensing declarations can withdraw.
- Creative Commons recommends against CC licenses for software on source-distribution, patent and compatibility grounds. The owner confirmed the selected license.
- The adaptation-sharing restriction affects public distribution of modified project-owned material, including patches, subject to applicable rights and separate permissions.
- Security inbox monitoring, live host enforcement and hosted settings remain operational verification work for adoption.

## Success Criteria (Summary)

- Canonical license text, README and plugin metadata agree on CC BY-NC-ND 4.0, with the trial removed from active declarations.
- SECURITY.md supplies the requested proposal with private reporting guidance and qualified security boundaries.
- Local content, link, whitespace and packaging checks pass, with maintainer review recorded in Manual Progress.

## References

- [Change request](change.md)
- [Full plan and canonical Progress](plan.md)
- [Research and evidence](research.md)
- [Official CC BY-NC-ND 4.0 text](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.txt)
