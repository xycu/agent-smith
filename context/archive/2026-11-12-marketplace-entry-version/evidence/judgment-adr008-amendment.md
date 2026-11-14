Judgment: row 2.4. Checked `git diff df80904~1 df80904 -- docs/ADR/ADR-008-release-packaging-and-semver.md`.

Hunks in the diff (only three):
1. Status line: appended "; Amendment 3: no version in the marketplace plugin entry".
2. Decision paragraph: added only the parenthetical "(Superseded: `plugins[0].version` was removed, see Amendment 3.)"; the rest of the sentence is byte-identical.
3. Pure addition at end of file: "## Amendment 3: no version in the marketplace plugin entry" with Context, Rules, Consequences, Alternatives.

No line of Amendment 1 or Amendment 2 is touched (no hunk between line 15 and the appended block). The Decision sentence is unchanged except the one Superseded parenthetical; the Status line changed. Row claim holds.
