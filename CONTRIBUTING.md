# Contributing

Participation follows the project's code of conduct. The repository rules explain architectural ownership, coding conventions, safe Git operations and documentation requirements. [Code of conduct](CODE_OF_CONDUCT.md) · [Repository rules](AGENTS.md)

## Contribution permission

Błażej Ksycki grants additional permission to share adaptations of project-owned agent-smith material for noncommercial purposes through forks and pull requests to propose or review contributions to `xycu/agent-smith`. Preserve attribution, copyright and license notices, and identify your modifications. This permission covers that contribution-and-review workflow. The base license governs other uses, and separately credited third-party material follows its own terms. For other permissions, use the maintainer contact published in README. [LICENSE](LICENSE) · [Licensing and permissions contact](README.md#-license)

## Incoming contribution terms

For contributions you submit after these terms reach the repository's default branch, you grant the project maintainer permission to use, revise, incorporate, reproduce and distribute your contribution, including revised and incorporated versions, within agent-smith under CC BY-NC-ND 4.0 and the contribution permission above. You retain ownership of your contribution and confirm that you have the rights needed to grant this permission. The maintainer will preserve applicable attribution and third-party notices. Identify third-party material and its terms in your submission. [Contribution permission](#contribution-permission) · [LICENSE](LICENSE)

## Report a bug or request a feature

Search existing issues before opening a report. For bugs, include the plugin version or commit, host and version, operating system, Node.js version, affected chain or step, reproduction steps, and expected and observed behavior. Use `unknown` for versions you cannot determine. Configuration and logs are optional. Redact credentials, private code, personal data and sensitive prompts before posting public evidence.

For feature requests, describe the problem and desired outcome. Add a use case when it helps explain the request. [Open an issue](https://github.com/xycu/agent-smith/issues/new/choose)

Send suspected vulnerabilities through the private security-reporting process. Conduct concerns use the code-of-conduct reporting contact. [Security policy](SECURITY.md) · [Conduct reporting](CODE_OF_CONDUCT.md#enforcement)

## Set up a local change

Install Node.js 24+ and Git. The router uses Node's built-in modules. Full model-backed pipeline runs also require a compatible host, authenticated model access and separately installed upstream toolkit skills. README maintains the host and toolkit prerequisites. [Installation and compatibility](README.md#-install) · [Pipeline prerequisites](README.md#-quick-start)

Fork the repository on GitHub. Replace `YOUR-USER` with your account in the clone URL, then create a branch from the current upstream default branch.

```sh
git clone https://github.com/YOUR-USER/agent-smith.git
cd agent-smith
git remote add upstream https://github.com/xycu/agent-smith.git
git fetch upstream main
git switch -c codex/your-change upstream/main
```

Keep the change focused and follow the repository's source, policy, prompt and documentation conventions. New tests, prompts and ADRs belong in their folder's README index. [Repository rules](AGENTS.md)

## Verify the change

Run the prescribed suite after changes to router scripts, policies, prompts or tools.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

The suite drives the router in scratch projects. Local skips depend on available tools and environment. The test index documents the expected identities and conditions, including the real OpenSpec CLI contracts. The `GH_LIVE=1` read-only checks are human-run. [Test prerequisites and skips](skills/openspec-pipeline/test/README.md) · [Live-check instructions](AGENTS.md#commands)

Use the existing guards for version consistency, branch commit subjects and the proposed PR title.

```sh
node tools/version-check.mjs
git fetch upstream main
node tools/commit-lint.mjs upstream/main..HEAD
node tools/commit-lint.mjs --title "docs(community): clarify contribution guidance"
git diff --check
```

The commit-range example compares your branch against the fetched `upstream/main`. Select the actual PR base when proposing a change against a different branch. Choose checks appropriate to the changed surface and record their commands, results and reasons for skipped checks. The repository rules provide the router smoke-check procedure. [Verification commands](AGENTS.md#commands)

## Open a pull request

Push your change branch to your fork and open a PR against `xycu/agent-smith`'s intended base branch. Include a concise summary, a related issue or change-folder reference when applicable, verification commands and results, and relevant documentation updates.

Use Conventional Commits for commit subjects and the PR title, such as `docs(community): clarify contribution guidance`. Add a `Co-Authored-By:` trailer to AI-assisted commits. The owner squash-merges, so the PR title becomes the subject on `main` and determines the release classification. [Commit and release conventions](AGENTS.md#commits)

Release-please owns the release version fields and the release workflow. Prepare changes with those existing ownership rules, and describe breaking changes explicitly when applicable. [Release process](AGENTS.md#releases)
