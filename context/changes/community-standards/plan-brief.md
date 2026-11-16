# Community standards — plan brief

[Full plan](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/plan.md) · [Research](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/research.md)

## What & Why

Complete the code-of-conduct, contributing, issue-template and PR-template gaps shown in GitHub Community Standards. Give contributors discoverable rules, useful reporting forms and a clear contribution-and-review permission under the project's existing licensing framework.

## Starting Point

Local inventories and the live GitHub Community Profile API confirmed the four missing categories during research. AGENTS.md already defines development conventions, SECURITY.md publishes the private vulnerability route, and README currently points contributors to AGENTS.md. Project-owned material uses CC BY-NC-ND 4.0, and automated run PRs supply their own report body.

## Desired End State

Contributors can find participation rules, prepare a change, report bugs or feature requests, and provide PR verification evidence. The issue chooser exposes private-security guidance and blank issues. GitHub recognizes the added community files after default-branch publication.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Contribution permission | Narrow additional permission for noncommercial sharing of project-owned adaptations through forks and PRs for contribution and review | Supports the agreed public workflow while retaining attribution and notices | Plan, owner-approved |
| Incoming contribution terms | Future contributors permit maintainer revision, incorporation and distribution within agent-smith under the project's licensing terms, retain ownership and confirm they can grant those rights | Covers accepted contributions through integration and release | Plan review, owner-approved Fix A for F1 |
| Conduct text | Contributor Covenant 2.1 with its attribution | Supplies the selected behavior, scope and enforcement framework | Plan, owner-approved |
| Conduct reporting | Błażej Ksycki at blazej@ksycki.pl, with the single-maintainer limits stated | Names an accountable contact and explains the lack of an independent internal reviewer | Plan, owner-approved |
| Required fields | Bug environment, reproduction, expected and observed behavior, accepting unknown versions. Feature problem and desired outcome | Collects core context while keeping configuration, logs and extra use-case detail optional | Plan, owner-approved |
| Issue chooser | SECURITY.md contact link and blank issues enabled | Makes private reporting guidance prominent while retaining flexible submissions | Plan, owner-approved |
| Development contracts | Link to AGENTS.md, SECURITY.md and README | Reuses established commands, security handling and compatibility guidance | Research |

## Scope

The implementation surface comprises the following file groups.

- Root CODE_OF_CONDUCT.md and CONTRIBUTING.md.
- LICENSE's project-specific notice and README's discovery/licensing text.
- Bug and feature YAML forms, chooser config and the Markdown PR template under `.github/`.

The contribution permission is scoped to this project's contribution-and-review workflow. Canonical CC legal text, separately credited third-party terms, runtime contracts and release-field ownership define the surrounding boundaries.

Incoming terms cover future submissions and the maintainer's revision, incorporation and distribution within agent-smith under the project's licensing terms, with contributor ownership retained.

## Architecture / Approach

Keep participation policy and the contributor entry point at the root. Make CONTRIBUTING.md authoritative for the additional permission and future incoming contribution terms, and link it from the LICENSE notice and README. Use GitHub's recognized form/template locations, existing security guidance and concise input fields. Automated run PRs continue to use the report body supplied by their existing generator.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Community policies and contribution guidance | Conduct policy, guide, scoped permission and discovery links | Permission summaries or conduct responsibilities could diverge from the agreed terms |
| 2. Issue and PR templates with verification | Bug and feature forms, chooser, PR template and acceptance evidence | YAML syntax can pass while GitHub rendering or required-field behavior is incorrect |

The owner approved this phase structure on 2026-11-16. Policy review can occur in the final PR while template drafting proceeds against the existing policy documents.

**Prerequisites** include the repository checkout, the recorded planning and review decisions, Node.js 24+ and Git for documented contributor commands, and the available Ruby/Psych installation for focused YAML checks. GitHub publication precedes the final UI checks.

**Estimated effort** is a small documentation change across two implementation phases, followed by owner review and post-merge verification.

## Open Risks & Assumptions

- The permission wording must remain consistent across CONTRIBUTING.md, the LICENSE notice and README. Published grants carry implications for later permission changes.
- Conduct reports use a single-maintainer process with no independent internal reviewer for complaints involving the maintainer.
- GitHub UI acceptance depends on default-branch publication. Mailbox monitoring and the maintainer's continuing enforcement capacity are operational responsibilities.

## Success Criteria (Summary)

- Local checks establish valid links, conduct attribution, the agreed contact, consistent permission notices and preservation of the canonical CC legal body.
- YAML/schema assertions establish the selected required/optional fields, unknown-version support, the security link and blank-issue availability. PR guidance requests concrete verification evidence.
- Owner policy review confirms the incoming contribution terms. Post-publication GitHub checks confirm the reporting workflows, PR template and four recognized community-standard categories.

## References

- [Full plan and canonical Progress checklist](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/plan.md)
- [Source-backed research](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/research.md)
- [Repository rules](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md) · [Security policy](/Users/blazej/.codex/worktrees/d6ea/agent-smith/SECURITY.md)
- [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) · [GitHub checklist requirements](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories)
