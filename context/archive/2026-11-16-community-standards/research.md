---
date: 2026-11-16T15:26:30Z
researcher: Codex
git_commit: b826e9093780cec1257ce118896e0dcb06265084
branch: detached HEAD
repository: agent-smith
topic: Complete the missing GitHub community standards
tags: [research, community-standards, documentation, github]
status: complete
last_updated: 2026-11-16
last_updated_by: Codex
---

# Community standards research

## Research question

Define the missing code of conduct, contributing guide, issue templates and pull request template shown in the screenshot. Establish GitHub recognition requirements, existing repository contracts and decisions needed before implementation. The active change supplies the scope. [Change request](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:12)

## Summary

The screenshot's four gaps are supported by local inspection and the live Community Profile API. During this investigation, the API returned null for `code_of_conduct`, `code_of_conduct_file`, `contributing`, `issue_template` and `pull_request_template`. Local filesystem inventories covered the repository root and the recursive `.github/` and `docs/` trees. Those locations contain no corresponding community files. The API establishes GitHub's effective recognition state at the time of the query. [Community Profile API](https://api.github.com/repos/xycu/agent-smith/community/profile) · [Recorded screenshot scope](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:14)

Existing contribution rules already live in `AGENTS.md`, with setup and compatibility information in README. The new guide can provide a human-facing entry point and link to those sources. A consequential planning decision concerns public patches because the current license limits adaptation sharing. Conduct-policy selection and reporting ownership also remain undecided. [Contributor rules](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:14) · [Setup](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:30) · [License explanation](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:143) · [Conduct scope](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:16)

## Detailed findings

### Code of conduct

`CODE_OF_CONDUCT.md` at the repository root fits GitHub's documented creation path. GitHub marks a public repository's code of conduct as added when the file is nonempty and does not state that the project has no code of conduct. GitHub asks maintainers to choose standards they can enforce and to preserve the attribution required by a borrowed policy. Template recognition and actual enforcement capacity are separate verification questions. [GitHub conduct guidance](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-code-of-conduct-to-your-project)

The requested content covers expected behavior, unacceptable conduct, scope, private reporting and enforcement. Contributor Covenant 2.1 is a researched candidate with those sections and a reporting-contact placeholder. Selection and adoption remain owner decisions. The existing `blazej@ksycki.pl` address is published for security reports and additional license permissions. Its use for conduct complaints needs confirmation, including who handles a complaint involving the maintainer. [Requested content](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:16) · [Candidate policy](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) · [Security contact](/Users/blazej/.codex/worktrees/d6ea/agent-smith/SECURITY.md:9) · [Permissions contact](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:145)

### Contributing guide

GitHub discovers contribution guidance in the root, `.github/` or `docs/`. A root `CONTRIBUTING.md` matches the requested location and receives GitHub's issue/PR contribution-guideline links. README currently labels `AGENTS.md` as the contributor guide, so its discovery section is an affected caller when a dedicated guide is added. [GitHub contribution guidance](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors) · [Current README link](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:133)

For local router development, the documented foundation is Node.js 24+, Git and built-in Node modules. Running a model-backed pipeline additionally involves host compatibility, authenticated model access and separately installed upstream skills. A contributor setup section should make those prerequisites clear and point to README for evolving host versions. [Runtime and dependency rules](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:10) · [Claude requirements](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:30) · [Codex and upstream prerequisites](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:38)

The prescribed local suite after script, policy, prompt or tool changes is the following command. Additional existing guards cover version consistency and Conventional Commit subjects or a proposed PR title. The guide can link to AGENTS.md for smoke-check setup, architectural ownership, import rules, archive immutability, safe Git/deletion rules and test/prompt/ADR indexing. [Required suite and smoke check](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:16) · [Guard commands](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:35) · [Architectural rules](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:7) · [Style and indexing](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:50)

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
node tools/version-check.mjs
node tools/commit-lint.mjs origin/main..HEAD
node tools/commit-lint.mjs --title "docs(community): add community guidance"
```

The commit-range example assumes `origin/main` exists locally and represents the intended comparison base. Commit subjects and PR titles follow Conventional Commits, and AI-assisted commits carry a `Co-Authored-By:` trailer. The owner squash-merges. Release-please owns the version fields, and contributor instructions should preserve that release workflow. [Commit contract](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:39) · [AI trailer](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:48) · [Release ownership](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:79)

CI uses a coverage-enabled suite command, runs the version guard, and installs the pinned OpenSpec contract CLI. The test index documents local skip conditions and the stronger CI behavior when Git or OpenSpec is unavailable. `GH_LIVE=1` checks are assigned to human execution. PR verification guidance should request commands, results and reasons for skipped checks while preserving those conditions. [CI commands and CLI pin](/Users/blazej/.codex/worktrees/d6ea/agent-smith/.github/workflows/ci.yml:38) · [Contract and skip guidance](/Users/blazej/.codex/worktrees/d6ea/agent-smith/skills/openspec-pipeline/test/README.md:12) · [Live-test ownership](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:34)

### Issue templates

The request calls for bug-report and feature-request forms. Suitable prospective paths are `.github/ISSUE_TEMPLATE/bug_report.yml` and `.github/ISSUE_TEMPLATE/feature_request.yml`. For GitHub's community checklist, YAML forms in that directory need valid `name` and `description` keys. Form inputs follow GitHub's form schema and serialize into issue-body Markdown. Templates become available through the repository's default branch. [Requested forms](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:18) · [Checklist recognition](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories) · [Form syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) · [Template publication](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)

The bug form's requested information is plugin version or commit, host and version, operating system, Node.js version, chain or step, relevant sanitized configuration, reproduction, expected and observed behavior, and sanitized logs. The feature form needs the problem, desired outcome and use case. These fields can be grouped into concise environment, reproduction and evidence sections during planning. The existing security policy provides established redaction and private-reporting instructions to reuse. [Requested fields](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:18) · [Security evidence and redaction](/Users/blazej/.codex/worktrees/d6ea/agent-smith/SECURITY.md:9)

A chooser configuration at `.github/ISSUE_TEMPLATE/config.yml` can expose a security-reporting link. GitHub documents it as chooser customization. The requested bug and feature forms establish the deliverable, while a chooser file and any change to blank-issue availability would be additional planning choices. [Chooser configuration](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates) · [Requested issue scope](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:18)

### Pull request template

`.github/pull_request_template.md` is a supported GitHub location. The requested content is a summary, an issue or change-folder reference when applicable, verification commands/results, and relevant documentation updates. GitHub's default-branch publication requirement makes post-merge UI inspection part of completion verification. [Requested PR content](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:19) · [GitHub PR-template guidance](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)

The inspected automated run-PR path builds a marker-bearing report body and supplies explicit `--title` and `--body-file` arguments to `gh pr create`. It also reuses an existing open PR. A default human-facing template fits alongside that behavior. The current evidence identifies no need to change the report generator or router for this community-file addition. [Run body](/Users/blazej/.codex/worktrees/d6ea/agent-smith/skills/10x-pipeline/scripts/open-pr.mjs:331) · [Existing PR and explicit creation arguments](/Users/blazej/.codex/worktrees/d6ea/agent-smith/skills/10x-pipeline/scripts/open-pr.mjs:348)

## Architecture and affected contracts

The prospective document surface is root `CODE_OF_CONDUCT.md`, root `CONTRIBUTING.md`, the bug and feature YAML forms, `.github/pull_request_template.md`, and README's discovery links. Existing AGENTS.md rules and SECURITY.md reporting guidance provide reusable sources. Community-file recognition is owned by GitHub's discovery conventions. Routing decisions and run-state ownership remain governed by the existing router contracts. [Requested locations](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:16) · [README discovery](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:133) · [Router ownership](/Users/blazej/.codex/worktrees/d6ea/agent-smith/AGENTS.md:7)

The current license grant permits noncommercial reproduction/sharing of licensed material and noncommercial production/reproduction of adaptations, while excluding sharing adaptations from that grant. README explicitly directs requests for additional permissions to the maintainer. Consequently, a guide inviting public modified-code submissions needs an owner decision about contribution permissions or submission handling. Separately credited third-party material retains its own terms. [License grant](/Users/blazej/.codex/worktrees/d6ea/agent-smith/LICENSE:149) · [Current explanation and permissions route](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:143)

## Historical context and related research

- Supported historical finding. The license/security research identified contribution and security-patch distribution under the adaptation-sharing restriction as an open consideration. That consideration remains relevant under the current license text. [Earlier finding](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/license-and-security-policy/research.md:24) · [Earlier open question](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/license-and-security-policy/research.md:76) · [Current grant](/Users/blazej/.codex/worktrees/d6ea/agent-smith/LICENSE:151)
- Superseded historical adoption question. The earlier research asked for confirmation of security-policy adoption. The later change notes record owner acceptance and removal of proposal wording, and the current SECURITY.md publishes the reporting process. Its existing terms are established input to this change. [Earlier adoption question](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/license-and-security-policy/research.md:77) · [Owner acceptance](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/license-and-security-policy/change.md:19) · [Published process](/Users/blazej/.codex/worktrees/d6ea/agent-smith/SECURITY.md:7)

## Planning decisions and verification limits

- Decide the public contribution permission/submission model under the existing license before drafting a general public-patch workflow. The recorded license decision supplies the constraint. [Current terms](/Users/blazej/.codex/worktrees/d6ea/agent-smith/README.md:143)
- Choose the conduct text, reporting contact and enforcement owner, including complaint handling when the maintainer is involved. The existing security contact provides a candidate address. [Requested conduct decisions](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:16) · [Existing contact](/Users/blazej/.codex/worktrees/d6ea/agent-smith/SECURITY.md:9)
- Choose required form fields and whether chooser customization is useful. The change request establishes the information to solicit. [Issue scope](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:18)
- Verify prospective files against GitHub's supported locations and form schema, check local links and placeholders, then inspect the issue chooser, PR body and Community Standards checklist after default-branch publication. The current live API confirms the starting gaps. [Recognition rules](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories) · [Current profile](https://api.github.com/repos/xycu/agent-smith/community/profile)
- The screenshot's cropped Additional community file section establishes no further specific deliverable. Mailbox monitoring, conduct enforcement capacity, live repository settings and post-publication behavior remain unverified. [Screenshot limitation](/Users/blazej/.codex/worktrees/d6ea/agent-smith/context/changes/community-standards/change.md:21)

## Research verification

The primary agent read the active change and repository lessons, inspected decisive license, security, contributor, CI and PR-generation evidence, queried the live GitHub Community Profile API, and read official GitHub documentation. Read-only workers covered contributor/PR contracts and community-policy history. Both completed before synthesis. Git metadata identifies a detached HEAD at the recorded commit. Local citations refer to this checkout, including the untracked active change.

The investigation found no dedicated Markdown-check configuration among the inspected repository manifests, workflows and lint-related filenames. Document verification covers local citation targets, line bounds and whitespace. Quantified claims and historical conclusions were checked against their cited scope. Runtime execution remains outside this document-discovery and policy investigation.
