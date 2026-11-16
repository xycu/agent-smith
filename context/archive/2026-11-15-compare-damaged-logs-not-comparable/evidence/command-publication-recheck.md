# Publication recheck

Checked on 2026-11-16 at local revision `768a802b`.

## Read-only Git checks

Command `git branch --show-current` exited 0 with output

```text
agent-smith/compare-damaged-logs-not-comparable
```

Command `git remote -v` exited 0 with output

```text
origin git@github.com:xycu/agent-smith.git (fetch)
origin git@github.com:xycu/agent-smith.git (push)
```

Command `git ls-remote --exit-code --heads origin refs/heads/agent-smith/compare-damaged-logs-not-comparable` exited 2 with empty stdout and stderr. Git reports exit 2 when no matching remote ref is found. The queried run branch was absent at this check.

## Read-only GitHub connector checks

Tool `search_prs` received

```json
{"query":"head:agent-smith/compare-damaged-logs-not-comparable","repository_full_name":"xycu/agent-smith","state":"all","topn":10}
```

It returned

```json
{"content":[{"type":"text","text":"Action completed."}],"structuredContent":{"issues":[]},"isError":false}
```

A second search used the title to check independently of the head qualifier

```json
{"query":"\"damaged\" in:title","repository_full_name":"xycu/agent-smith","state":"all","topn":50}
```

It returned

```json
{"content":[{"type":"text","text":"Action completed."}],"structuredContent":{"issues":[]},"isError":false}
```

Both searches succeeded with no returned PRs. They supply no PR URL, CI result or report-comment URL. No publication operation was performed.
