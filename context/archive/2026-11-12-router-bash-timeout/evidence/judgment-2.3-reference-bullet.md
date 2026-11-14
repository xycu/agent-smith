Judgment row 2.3. Quoted from docs/REFERENCE.md line 53 (bullet "Bash limit").

Claims vs sources:
- "timeout: 600000" for route/open-pr/pr-comment: matches SKILL.md line.
- "isolation.gitTimeoutMs and archive.gitTimeoutMs are 120000 ms each": policy.json lines 117 and 124 both "gitTimeoutMs": 120000.
- "open-pr.mjs pushes and commits with a fixed 120000 ms (GIT_TIMEOUT_MS)": open-pr.mjs:17 `const GIT_TIMEOUT_MS = 120000;`.
- "pr-comment.mjs ... --timeout-ms (default 20000)": pr-common.mjs:11 DEFAULT_TIMEOUT_MS = 20000; pr-comment.mjs accepts --timeout-ms.
- routerCommit exists: isolation.mjs:326.
- staged-index halt: isolation.mjs ~229 "The index holds staged changes: ... Commit or unstage them first." (does not name a Bash kill; matches "without naming the cause").
- Rule "git timeouts of one call must add up to less than the Bash limit" is stated unambiguously; raise-only direction stated; both chains share the bullet.
Bullet is consistent with policy.json and open-pr.mjs:17.
