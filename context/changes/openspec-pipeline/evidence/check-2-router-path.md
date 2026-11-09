# Check 2: router path from a second skill folder

ADR-013 precondition 2. Pass criterion (plan Phase 1 item 1): `<installed plugin dir>/skills/10x-pipeline/scripts/route.mjs` exists in the installed plugin cache next to the `skills/` folder, so `<openspec-pipeline base dir>/../10x-pipeline/scripts/route.mjs` resolves.

Observed on 2026-11-09, read only.

## Installed plugin

```
$ grep -n -A8 '"agent-smith@agent-smith"' ~/.claude/plugins/installed_plugins.json
45:    "agent-smith@agent-smith": [
46-      {
47-        "scope": "user",
48-        "installPath": "/Users/blazej/.claude/plugins/cache/agent-smith/agent-smith/0.7.1",
49-        "version": "0.7.1",
50-        "installedAt": "2026-11-02T18:38:31.505Z",
51-        "lastUpdated": "2026-11-07T16:12:43.702Z",
52-        "gitCommitSha": "c5c77251b957bc8b106219a4814688b16d0aa24c"

$ ls ~/.claude/plugins/cache/agent-smith/agent-smith/
0.2.0  0.5.0  0.6.0  0.7.0  0.7.1
```

## The cache is a copy of the whole repository tree

```
$ ls -a ~/.claude/plugins/cache/agent-smith/agent-smith/0.7.1/
.  ..  .claude  .claude-plugin  .github  .gitignore  .in_use  .release-please-manifest.json
agents  AGENTS.md  assets  CHANGELOG.md  context  docs  LICENSE  README.md
release-please-config.json  skills  tools

$ ls -a ~/.claude/plugins/cache/agent-smith/agent-smith/0.7.1/skills/
.  ..  10x-pipeline

$ ls ~/.claude/plugins/cache/agent-smith/agent-smith/0.7.1/skills/10x-pipeline/scripts
pr-comment.mjs  route.mjs

$ git ls-tree --name-only c5c77251b957bc8b106219a4814688b16d0aa24c      # the installed commit
.claude-plugin  .claude  .github  .gitignore  .release-please-manifest.json  AGENTS.md
CHANGELOG.md  LICENSE  README.md  agents  assets  context  docs  release-please-config.json
skills  tools
$ git ls-tree --name-only c5c77251b957bc8b106219a4814688b16d0aa24c skills/
skills/10x-pipeline
```

The cache holds every top-level entry of the installed commit (plus the `.in_use` marker), so a second folder under `skills/` in a release is copied next to `skills/10x-pipeline/`. The older versions 0.2.0 to 0.7.0 have the same layout (`skills/10x-pipeline/scripts/route.mjs` present in each).

## The sibling path resolves

`skills/openspec-pipeline/` does not exist in 0.7.1 yet, so the path is resolved lexically, as a skill's base directory plus `../10x-pipeline/scripts/route.mjs` is:

```
$ P=~/.claude/plugins/cache/agent-smith/agent-smith/0.7.1
$ node -e 'const p=require("path"),fs=require("fs");const base=p.join(process.argv[1],"skills","openspec-pipeline");const r=p.resolve(base,"../10x-pipeline/scripts/route.mjs");console.log("lexical:",r,"exists:",fs.existsSync(r))' "$P"
lexical: /Users/blazej/.claude/plugins/cache/agent-smith/agent-smith/0.7.1/skills/10x-pipeline/scripts/route.mjs exists: true
$ test -f "$P/skills/10x-pipeline/scripts/route.mjs" && echo "test -f route.mjs: yes"
test -f route.mjs: yes
```

## Limits

- 0.7.1 predates the module split: its `scripts/` holds `route.mjs` and `pr-comment.mjs` only. A release with this change ships `route.mjs` and its modules (`state.mjs`, `preplan.mjs`, `steps.mjs`, `flow.mjs`, `isolation.mjs`, `openspec.mjs`) in the same folder, so the relative imports of `route.mjs` resolve as they do in the repository.
- A shell `cd` through the missing `skills/openspec-pipeline/` would fail; the check holds for the real folder once a release contains it. Phase 5 row 5.5 confirms the skill is found when the plugin is loaded.

Result: pass
