# Check 4: plugin skill discovery without a manifest list

ADR-013 precondition 4. Pass criterion (plan Phase 1 item 1): evidence that Claude Code discovers every skill folder under a plugin's `skills/` without a manifest list: `.claude-plugin/plugin.json` of this plugin and of the installed `sentry` plugin have no skills key, and every `skills/*/SKILL.md` of `sentry` appears as `sentry:<name>` in the session's skill list.

Observed on 2026-11-09, read only.

## Manifests have no skills key

```
$ node -e 'for (const f of process.argv.slice(1)) { const j=JSON.parse(require("fs").readFileSync(f,"utf8")); console.log(f.replace(process.env.HOME,"~"), "keys:", Object.keys(j).join(","), "has skills:", "skills" in j); }' \
    ~/.claude/plugins/cache/claude-plugins-official/sentry/1.4.0/.claude-plugin/plugin.json \
    <worktree>/.claude-plugin/plugin.json \
    ~/.claude/plugins/cache/agent-smith/agent-smith/0.7.1/.claude-plugin/plugin.json
~/.claude/plugins/cache/claude-plugins-official/sentry/1.4.0/.claude-plugin/plugin.json keys: $schema,name,description,version,author,keywords,license,repository,mcpServers has skills: false
~/WebstormProjects/agent-smith/.claude/worktrees/agent-smith-openspec-pipeline/.claude-plugin/plugin.json keys: name,displayName,version,description,author,repository,license,keywords has skills: false
~/.claude/plugins/cache/agent-smith/agent-smith/0.7.1/.claude-plugin/plugin.json keys: name,displayName,version,description,author,repository,license,keywords has skills: false

$ grep -c '"skills"' <worktree>/.claude-plugin/marketplace.json
0
```

The marketplace entries do not list them either: the `sentry` plugin's own `.claude-plugin/marketplace.json` has no `skills` key anywhere, and its entry in `~/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json` has only the keys `name`, `description`, `category`, `source`, `homepage`.

## The installed sentry plugin

```
$ grep -n -A8 '"sentry@' ~/.claude/plugins/installed_plugins.json
35:    "sentry@claude-plugins-official": [
38:        "installPath": "/Users/blazej/.claude/plugins/cache/claude-plugins-official/sentry/1.4.0",
39:        "version": "1.4.0",

$ S=~/.claude/plugins/cache/claude-plugins-official/sentry/1.4.0
$ ls -a "$S"
.  ..  .claude-plugin  .in_use  assets  LICENSE  README.md  SKILL_TREE.md  skills
$ ls "$S"/skills/*/SKILL.md
skills/sentry-create-alert/SKILL.md
skills/sentry-debug-issue/SKILL.md
skills/sentry-fix-stack-traces/SKILL.md
skills/sentry-get-started/SKILL.md
skills/sentry-instrument/SKILL.md
skills/sentry-otel-exporter-setup/SKILL.md
skills/sentry-setup-releases/SKILL.md
skills/sentry-snapshots-cocoa/SKILL.md
$ for f in "$S"/skills/*/SKILL.md; do grep -m1 '^name:' "$f"; done
name: sentry-create-alert
name: sentry-debug-issue
name: sentry-fix-stack-traces
name: sentry-get-started
name: sentry-instrument
name: sentry-otel-exporter-setup
name: sentry-setup-releases
name: sentry-snapshots-cocoa
```

## Every one appears in the session's skill list

The `sentry:` entries of the implementing subagent's available-skills list, copied verbatim:

```
- sentry:sentry-create-alert
- sentry:sentry-debug-issue
- sentry:sentry-fix-stack-traces
- sentry:sentry-get-started: Guided entry point for using Sentry through your agent. Orients you to your current setup and, for a new project, sets up Sentry end to end with sane defaults — provision a project, install the SDK (errors, tracing, and whatever it enables by default), and confirm real telemetry reaches Sentry. Routes other intents (adding more signals, fixing issues) to the right skill.
- sentry:sentry-instrument
- sentry:sentry-otel-exporter-setup
- sentry:sentry-setup-releases
- sentry:sentry-snapshots-cocoa
```

Eight folders, eight `sentry:<name>` entries, one to one. The agent-smith plugin is listed the same way (`agent-smith:10x-pipeline`) from its one skill folder, with no list in its manifest.

## Limits

- This shows discovery for an installed plugin with several skill folders. Phase 5 row 5.5 adds the live confirmation for this plugin: Claude Code lists `agent-smith:openspec-pipeline` when the plugin is loaded from the worktree.

Result: pass
