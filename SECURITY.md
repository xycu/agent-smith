# Security policy proposal

Draft for maintainer review. This proposal uses the project's existing contact address. The maintainer should confirm inbox monitoring and the response targets below before adopting it.

## Supported versions

Security fixes are proposed for the latest stable release. Users of older versions should upgrade to that release. Reports concerning `main` are also welcome. Older release lines receive fixes at the maintainer's discretion.

## Reporting a vulnerability

Send reports privately to Błażej Ksycki at [blazej@ksycki.pl](mailto:blazej@ksycki.pl). Use a subject such as `agent-smith security report`. Keep exploit details, credentials and sensitive repository contents out of public issues, discussions and pull requests while coordinating a report.

Include the following information where available.

- Affected plugin version or commit, operating system, Node.js version and host version, such as Claude Code or Codex.
- Relevant policy overrides, enabled hooks, agent mappings and permission settings, with secrets removed.
- A minimal reproduction using a disposable repository and synthetic data, including expected and observed behavior.
- Security impact, required privileges and the trust boundary crossed.
- Sanitized logs, affected file paths and any suggested mitigation.
- Your preferred contact method and whether you want public credit.

Start with a minimal description if the evidence is sensitive, and arrange a suitable transfer method with the maintainer. Ordinary email provides limited confidentiality. Redact API keys, access tokens, private code, personal data and prompts containing sensitive information.

## Scope and security boundaries

Reports may cover project-owned router scripts, isolation and recovery logic, policy and prompt assembly, hooks, agent definitions, publication scripts, and build or release workflows.

Examples of security-relevant failures include the following.

- Command injection or path traversal through change IDs, paths, policy values, artifacts or tool results.
- Writes outside an authorized run root, unsafe symlink handling, or loss of staged or working-copy data during recovery.
- Prompt injection from repository content or tool output that causes an action outside the user's authorization.
- Step agents bypassing enforced host permissions or publishing through Git or GitHub without authorization.
- Credentials or private repository contents leaking through logs, reports, pull requests or comments.
- Untrusted contributions reaching a privileged CI runner, secrets or release permissions.

agent-smith executes local tools and delegates work to agents with access determined by the host. Worktree isolation separates Git work. Filesystem access, network access and command permissions require host-level controls. Prompt rules and the scoped Bash hook provide limited coverage, and that coverage depends on host version, hook configuration and agent identity. Run artifacts can contain project content and should be treated as sensitive. Current guard coverage and acceptance evidence are documented in the [reference](docs/REFERENCE.md#step-safety-and-pre-publication-acceptance).

Report upstream model, host, toolkit or GitHub vulnerabilities to their respective maintainers. Include agent-smith in coordination when its integration contributes to the impact.

## Response and coordinated disclosure

The proposed targets are acknowledgment within five business days and an initial triage update within ten business days of receipt. During an active investigation, aim to provide an update at least every ten business days. These are best-effort targets, subject to maintainer availability.

If you receive no acknowledgment after five business days, follow up at the same address. Once contact is established, agree on remediation and disclosure dates. Aim for coordinated disclosure within 90 days of the initial report, adjusting by mutual agreement for severity, active exploitation and upstream dependencies. Active exploitation may warrant earlier mitigation or disclosure.

After validating a report, the maintainer should assess affected versions and severity, prepare a fix and regression check, publish a patched release with upgrade or mitigation instructions, and issue a public advisory when appropriate. Assign or request a CVE when applicable. Credit the reporter with consent. Reporters remain free to follow their own disclosure policies.

## Research expectations

Test in repositories, accounts and disposable environments you own or have explicit permission to assess. Use synthetic credentials and data. Keep testing minimally invasive, preserve evidence and stop if it reaches another party's data or systems. Obtain separate permission before testing project CI infrastructure, shared runners or third-party services.

Testing authorization must come from each system owner. Any legal safe-harbor commitment or financial reward requires a separate written agreement.

## Maintainer handling

Limit private reports and exploit details to people needed for investigation. Reproduce findings in an isolated environment with minimal credentials. If credentials were exposed, revoke or rotate them promptly and assess access logs and affected publications. Coordinate disclosure before publishing a reproducer, and share only the evidence needed to explain the impact and remediation.
