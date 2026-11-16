# Community standards implementation plan

## Overview

Complete the four GitHub Community Standards gaps with a code of conduct, a human-facing contributing guide, bug and feature issue forms, and a pull request template. Make the submission paths discoverable and preserve the repository's existing development and security-reporting contracts.

The owner approved the two-phase structure and five planning decisions on 2026-11-16. The decisions below supersede the corresponding open choices in the research.

During plan-review triage on 2026-11-16, the owner approved Fix A for F1, adding explicit incoming contribution terms for future submissions.

## Current State Analysis

The research inspected the repository at `b826e9093780cec1257ce118896e0dcb06265084`. Root, `.github/` and `docs/` inventories lacked the requested files, and GitHub's Community Profile API reported the corresponding entries as null. README currently presents `AGENTS.md` as the contributor guide. [Research](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/research.md:20) · [README discovery links](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:133)

AGENTS.md owns the contributor conventions, required test command, architectural rules, commit subjects and release-field ownership. SECURITY.md supplies the established private reporting route and redaction guidance. Automated run PRs construct their own report body and pass it explicitly to GitHub CLI. [Repository contracts](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:14) · [Security reporting](/Users/blazej/.codex/worktrees/d6ea/agent-smith/SECURITY.md:7) · [Run PR creation](/Users/blazej/.codex/worktrees/d6ea/agent-smith/skills/10x-pipeline/scripts/open-pr.mjs:348)

Project-owned material carries CC BY-NC-ND 4.0. Its adaptation-sharing restriction makes the owner-approved contribution permission part of this documentation change. The permission and its discoverability must agree across CONTRIBUTING.md, the LICENSE notice and README. [License grant](/Users/blazej/.codex/worktrees/d6ea/agent-smith/LICENSE:149) · [Existing explanation](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:143)

## Desired End State

Contributors can find the rules, report ordinary bugs or feature requests, follow a clearly scoped public contribution workflow, and prepare a PR with verification evidence. Security and conduct reports have named private routes. GitHub recognizes the four missing community-standard categories after publication to the default branch.

The approved decisions are binding throughout the phases and verification.

- Publish a narrow additional permission for sharing adaptations of project-owned material through forks and PRs for contribution and review. Retain the existing noncommercial and attribution conditions, and state the contribution-and-review purpose precisely.
- For future submissions, specify contributor-granted permission for the maintainer to revise, incorporate and distribute contributions within agent-smith under the project's licensing terms. Contributors retain ownership and confirm they can grant those rights.
- Adopt Contributor Covenant 2.1 with its attribution and versioned source.
- Publish `blazej@ksycki.pl` with Błażej Ksycki responsible for conduct reports. Explain the single-maintainer process and its lack of an independent internal reviewer for complaints involving the maintainer.
- Require bug environment, reproduction, expected behavior and observed behavior. Accept unknown versions. Require a feature's problem and desired outcome. Configuration, logs and extra use-case detail remain optional.
- Add a security-policy link to the issue chooser and keep blank issues available alongside the forms.

## Scope

Implementation targets are `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, the LICENSE notice, README discovery/licensing text, `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/config.yml`, and `.github/pull_request_template.md`.

The permission applies to the contribution-and-review workflow for this project. Existing CC legal text, separately credited third-party terms, runtime behavior, release ownership and automated run-PR contracts remain the authoritative boundaries for their respective areas. The screenshot's cropped section supplies no further deliverable. [License and third-party scope](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:143) · [Screenshot boundary](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:21)

Incoming contribution terms cover the maintainer's revision, incorporation and distribution of future contributions within agent-smith under the project's licensing terms, with contributor ownership retained.

## Implementation Approach

Put human-facing policy and workflow guidance at the repository root and GitHub form/template definitions in their recognized `.github/` locations. CONTRIBUTING.md will be the authoritative home of the additional contribution permission, with short discovery links from the LICENSE notice and README. Link to existing AGENTS.md and SECURITY.md for their detailed contracts.

Use the published Contributor Covenant 2.1 text with the agreed contact and an accompanying project-specific explanation of reporting ownership. Group issue information into concise fields, preserve the selected required/optional boundaries, and use a Markdown PR template for summary and evidence. The existing report generator supplies the automated PR body.

## Phase 1: Community policies and contribution guidance

### Overview

Establish the conduct policy, contribution permission and contributor entry point, with consistent discovery links.

### Changes Required

#### 1. Code of conduct

**File** `CODE_OF_CONDUCT.md`

**Intent** Adopt the selected conduct standard and provide an actionable reporting route. Preserve the published policy's attribution and explain the project's actual reporting ownership.

**Contract** Use Contributor Covenant 2.1's pledge, standards, responsibilities, scope, enforcement, guidelines and attribution. Populate the reporting contact with Błażej Ksycki at `blazej@ksycki.pl`. Add a clearly identified project note explaining that Błażej handles reports and that the project has a single-maintainer process with no independent internal reviewer for complaints involving him. Keep that limitation visible alongside the reporting route.

#### 2. Contributor guide and additional permission

**File** `CONTRIBUTING.md`

**Intent** Give prospective contributors one entry point for submitting useful reports, preparing a local change and providing review evidence. Express the owner's approved contribution-and-review permission clearly enough for a public fork/PR workflow.

**Contract** Include a `Contribution permission` section covering noncommercial sharing of adaptations of project-owned material through forks and PRs to propose or review contributions to `xycu/agent-smith`, with attribution and existing notices preserved. Keep the scope tied to that purpose and identify separately credited material as subject to its own terms. Link to LICENSE for the base license and README's permissions contact for other requests.

**Contract** For future submissions, state that contributors grant the maintainer permission to revise, incorporate and distribute their contributions within agent-smith under the project's licensing terms. Contributors retain ownership and confirm they have the rights needed to grant this permission. Preserve applicable attribution and third-party notices.

**Contract** Cover bug/feature reporting, SECURITY.md's private reporting route, the code of conduct, Node.js 24+ and Git setup, and the distinction between local router checks and model-backed pipeline prerequisites. Explain the fork/branch/PR workflow, Conventional Commits, AI co-author trailers, applicable documentation updates, and release-please ownership of version fields. Reuse the exact repository test command and existing version/commit/title guard commands. Explain the comparison base for commit-range examples and point to the test index for prerequisite-dependent skips and human-run live checks. Link to AGENTS.md for architecture and safety conventions, and README for host/toolkit compatibility. [Existing commands](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:16) · [Guard and commit contract](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:35) · [Skip conditions](/Users/blazej/.codex/worktrees/d6ea/agent-smith/skills/openspec-pipeline/test/README.md:12)

#### 3. License notice and README discovery

**Files** `LICENSE`, `README.md`

**Intent** Make the additional permission discoverable wherever readers encounter the licensing summary, and make the new community guidance easy to find.

**Contract** Add a pointer from the project-specific LICENSE preamble to CONTRIBUTING.md's permission section while preserving the canonical CC BY-NC-ND legal body byte-for-byte. Update README's licensing summary to describe the scoped permission consistently and link to its authoritative text. Add contributor and conduct links in README's discovery section and describe AGENTS.md's repository-rule role accurately.

### Success Criteria

#### Automated Verification

- Policy files and discovery links exist, local link targets resolve, and the agreed contact and versioned conduct attribution are present.
- The LICENSE canonical CC legal body matches the pre-change baseline byte-for-byte, and the contribution-permission links resolve.
- Whitespace validation passes for the phase diff using `git diff --check`, including new files in the checked diff.

#### Manual Verification

- Policy review confirms the permission's contribution-and-review scope, consistent licensing summaries, complete conduct text, and the agreed single-maintainer reporting limitation.
- Contributor-guide review confirms usable setup and submission instructions, exact repository commands, and accurate links to existing security, architecture and release guidance.
- Incoming-contribution terms review confirms coverage of future submissions, maintainer revision, incorporation and distribution within agent-smith under the project's licensing terms, retained contributor ownership, and the submitter's ability to grant those rights.

Record review evidence against the corresponding Progress rows. Policy and guide review can occur in the final PR. Phase 2 requires the referenced documents to exist, and its drafting can proceed while those review rows remain pending.

## Phase 2: Issue and PR templates with verification

### Overview

Provide structured ordinary-reporting paths, prominent private-security guidance, and a concise PR evidence template. Verify the agreed required-field boundaries and GitHub's discovery behavior.

### Changes Required

#### 1. Bug-report form

**File** `.github/ISSUE_TEMPLATE/bug_report.yml`

**Intent** Collect enough context to reproduce and triage a bug while accommodating incomplete diagnostic evidence.

**Contract** Define valid `name`, `description` and `body` values using GitHub's issue-form schema. Require environment context, reproduction steps, expected behavior and observed behavior. The environment prompt requests plugin version or commit, host/version, operating system, Node.js version and affected chain/step, with `unknown` accepted for versions and `not applicable` accepted for a chain/step where appropriate. A grouped environment textarea satisfies that contract without brittle version enumerations. Offer optional sanitized configuration and logs. Include visible redaction instructions and a SECURITY.md reporting link using a URL that resolves from GitHub's issue UI.

#### 2. Feature-request form

**File** `.github/ISSUE_TEMPLATE/feature_request.yml`

**Intent** Capture the problem and desired outcome before implementation suggestions dominate the request.

**Contract** Define valid `name`, `description` and `body` values. Require the problem and desired outcome, and provide optional extra use-case detail. Include the private-security reporting route and safe-public-submission guidance where relevant. Use the same concise field-label conventions as the bug form.

#### 3. Issue chooser

**File** `.github/ISSUE_TEMPLATE/config.yml`

**Intent** Give reporters an early route to the existing security policy while preserving flexible ordinary submissions.

**Contract** Set `blank_issues_enabled` to the Boolean `true`. Add a `contact_links` entry with `name`, `url` and `about` pointing to `https://github.com/xycu/agent-smith/blob/main/SECURITY.md`. Its description directs vulnerabilities to the private process described by that policy.

#### 4. Pull request template

**File** `.github/pull_request_template.md`

**Intent** Help authors explain the change and provide concrete review evidence.

**Contract** Include a summary, an issue or change-folder reference when applicable, verification commands/results, skipped checks with reasons, and relevant documentation updates. Reference the contribution and security guidance with links that resolve from the PR UI. Phrase verification prompts to accommodate the repository's existing manual/live-check conditions. The template serves the ordinary manual PR entry point alongside the report body explicitly supplied by `open-pr.mjs`. [Automated body contract](/Users/blazej/.codex/worktrees/d6ea/agent-smith/skills/10x-pipeline/scripts/open-pr.mjs:331)

### Success Criteria

#### Automated Verification

- The issue YAML files parse and focused assertions confirm valid form metadata and body structure, distinct field IDs, the agreed required/optional fields, `blank_issues_enabled` as Boolean true, and the security contact-link target.
- Cross-file checks confirm the PR template's requested sections, resolving local guidance links, the security-policy URLs, and compatibility with the existing explicit automated PR-body contract.
- Whitespace validation passes for the complete implementation diff using `git diff --check`, including new files in the checked diff.

#### Manual Verification

- After default-branch publication, the issue chooser presents bug and feature forms, a security-policy link and the blank-issue action, and the forms render without schema errors.
- After default-branch publication, form inspection confirms that core fields are required, optional evidence can be omitted, unknown versions are accepted, and the security link reaches the established private-reporting instructions.
- After default-branch publication, a manual PR compose view displays the summary and verification template with working guidance links.
- After default-branch publication, GitHub Community Standards recognizes code of conduct, contributing, issue templates and the PR template, with the live Community Profile API supplying corroborating evidence.

Post-publication checks use compose/preview views and read-only API queries. The owner performs the repository's existing review-and-merge workflow before those checks become available. Keep pending verification rows visible until evidence exists.

## Testing Strategy

### Focused document and form checks

Use one-off checks during implementation for the named file targets, Markdown links, contact/source attribution, canonical license-body comparison and form contracts. Ruby with its installed Psych standard library is available in this worktree for YAML parsing. Combine parsing with explicit assertions for GitHub's form shape and the selected required-field predicates. Parsing establishes YAML syntax, while schema assertions and GitHub rendering establish the additional form requirements.

Check links in GitHub issue and PR contexts, where relative repository-file links can resolve differently from rendered Markdown files. Public-UI links can use the repository's canonical GitHub URLs. Inspect the explicit `--body-file` call and run-body marker in the existing PR generator as the compatibility boundary.

The prescribed Node test suite applies if implementation expands into router scripts, policies, prompts or tools. For the approved document/template surface, targeted content/schema checks and the existing whitespace check provide the local proof. Follow AGENTS.md if the actual changed surface grows. [Repository verification rule](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:16)

### Human review and GitHub acceptance

Review the permission and conduct wording in the implementation diff, then follow the phase's manual criteria after default-branch publication. Inspect field omission and unknown-version cases in compose views. Query `gh api repos/xycu/agent-smith/community/profile` to corroborate the four recognized categories, and inspect the Community Standards screen itself.

## Performance Considerations

The approved surface consists of static repository documents and GitHub templates. Verification focuses on discoverability, form usability and policy consistency.

## Migration Notes

The files become effective through the existing PR review-and-merge workflow. GitHub's default-branch discovery determines when issue and PR templates are available. [Template publication](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)

If corrections are needed, apply a reviewed follow-up patch preserving intervening work. Maintain a consistent permission description across CONTRIBUTING.md, README and the LICENSE notice. Treat future permission changes as an owner decision that accounts for already published grants.

## References

- [Active change](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md)
- [Source-backed research](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/research.md)
- [Repository contributor contracts](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md)
- [Security policy](/Users/blazej/.codex/worktrees/d6ea/agent-smith/SECURITY.md)
- [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)
- [GitHub contribution-guideline discovery](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors)
- [GitHub community-profile requirements](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories)
- [GitHub issue-form syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [GitHub PR-template placement](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)
- [GitHub contributions under repository license](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#6-contributions-under-repository-license)

## Progress

### Phase 1: Community policies and contribution guidance

#### Automated

- [x] 1.1 Policy files and discovery links exist, local link targets resolve, and the agreed contact and versioned conduct attribution are present.
- [x] 1.2 The LICENSE canonical CC legal body matches the pre-change baseline byte-for-byte, and the contribution-permission links resolve.
- [x] 1.3 Whitespace validation passes for the phase diff using `git diff --check`, including new files in the checked diff.

#### Manual

- [x] 1.4 Policy review confirms the permission's contribution-and-review scope, consistent licensing summaries, complete conduct text, and the agreed single-maintainer reporting limitation.
- [x] 1.5 Contributor-guide review confirms usable setup and submission instructions, exact repository commands, and accurate links to existing security, architecture and release guidance.
- [x] 1.6 Incoming-contribution terms review confirms coverage of future submissions, maintainer revision, incorporation and distribution within agent-smith under the project's licensing terms, retained contributor ownership, and the submitter's ability to grant those rights.

### Phase 2: Issue and PR templates with verification

#### Automated

- [ ] 2.1 The issue YAML files parse and focused assertions confirm valid form metadata and body structure, distinct field IDs, the agreed required/optional fields, `blank_issues_enabled` as Boolean true, and the security contact-link target.
- [ ] 2.2 Cross-file checks confirm the PR template's requested sections, resolving local guidance links, the security-policy URLs, and compatibility with the existing explicit automated PR-body contract.
- [ ] 2.3 Whitespace validation passes for the complete implementation diff using `git diff --check`, including new files in the checked diff.

#### Manual

- [ ] 2.4 After default-branch publication, the issue chooser presents bug and feature forms, a security-policy link and the blank-issue action, and the forms render without schema errors.
- [ ] 2.5 After default-branch publication, form inspection confirms that core fields are required, optional evidence can be omitted, unknown versions are accepted, and the security link reaches the established private-reporting instructions.
- [ ] 2.6 After default-branch publication, a manual PR compose view displays the summary and verification template with working guidance links.
- [ ] 2.7 After default-branch publication, GitHub Community Standards recognizes code of conduct, contributing, issue templates and the PR template, with the live Community Profile API supplying corroborating evidence.
