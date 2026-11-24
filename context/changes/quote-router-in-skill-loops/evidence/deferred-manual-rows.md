# Deferred Manual rows

Owner decision, 2026-11-24. Rows 2.6 and 2.7 stay unticked and move to S-20 (`supported-host-acceptance`).

- 2.6 and 2.7 need the fixed plugin installed under a real cache path that contains a space, started through `/agent-smith:10x-pipeline` and `/agent-smith:openspec-pipeline`. The local marketplace is a `directory` source, so the plugin resolves to the repository checkout and cannot produce that path. Rows 1.2 and 1.3 (installed-plugin substitution, caveat in `command-installed-plugin-substitution.md`) are the evidence that exists.
- The change merged as [#186](https://github.com/xycu/agent-smith/pull/186) and shipped in v1.16.2.
