# Installed-plugin substitution check (rows 1.2 and 1.3)

Recorded 2026-11-23. Claude Code 2.1.323, plugin `agent-smith` 1.16.1 loaded by the installed plugin (no `--plugin-dir`), model haiku. Each run was headless (`claude -p`) with an appended instruction to stop after `init`; nothing was dispatched. The scratch projects were outside the repository with `isolation.require` false.

## Caveat (accepted by the owner, 2026-11-23)

The `agent-smith` marketplace on this machine is a `directory` source (`/Users/blazej/WebstormProjects/agent-smith`), so the installed plugin resolved to the repository checkout, not to a path under `~/.claude/plugins/cache/`. These checks prove that an installed plugin substitutes `${CLAUDE_SKILL_DIR}` and starts the router on both chains. They do not prove the substitution from a cache path. Rows 2.6 and 2.7 still need the fixed plugin under a path with a space.

## Row 1.2: `/agent-smith:10x-pipeline qcheck`

Expanded command:

```
cd <scratch project> && node "/Users/blazej/WebstormProjects/agent-smith/skills/10x-pipeline/scripts/route.mjs" init qcheck --host claude --pr-comment false
```

Result: `action: "run"`, `providerMode: "claude"`, first step 1 `score`. The router printed the usage-capture preflight warning first (native Claude capture off in this session). Cost $0.0207, 5 turns.

## Row 1.3: `/agent-smith:openspec-pipeline qcheck`

Expanded command (the shared router, reached through the 10x skill directory):

```
cd <scratch project> && node "/Users/blazej/WebstormProjects/agent-smith/skills/10x-pipeline/scripts/route.mjs" init qcheck --chain openspec --goal "" --host claude --pr-comment false
```

Result: `action: "run"`, `providerMode: "claude"`, `providersByStep` keyed by the `os-` steps (`os-propose`, `os-apply`, `os-verify`, `os-archive`). Same preflight warning. Cost $0.0166.

Full transcripts were kept outside the repository (session scratchpad) and are not committed.
