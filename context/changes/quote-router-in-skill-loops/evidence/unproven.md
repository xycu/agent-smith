# Unproved prerequisites and acceptance

Recorded 2026-11-15 at HEAD 4c54a4a29cd1c18f95be4b1db17470924f4503b9.

- Row 1.1 is done (2026-11-23): merge commit f81bdb5 integrates the Wave 7 rewrite from main, and command-contracts.md holds the refreshed inventory.
- Rows 1.2 and 1.3 are done (2026-11-23), accepted by the owner with a caveat: `evidence/command-installed-plugin-substitution.md` records both installed-plugin runs (Claude Code 2.1.323, plugin 1.16.1, `action: "run"` on both chains). The plugin resolved to the repository checkout because the marketplace is a directory source, so no cache path was exercised.
- Row 2.6 remains pending. The installed 10x check used a directory marketplace. Verification still needs the fixed revision installed under a cache path containing spaces, its expanded router command, and successful init output.
- Row 2.7 remains pending for the same reason. The OpenSpec check must also show the shared router starting with `--chain openspec`.

Installing the plugin in an actual spaced cache is outside this worktree-only run. The shell fixtures cover command expansion locally.
