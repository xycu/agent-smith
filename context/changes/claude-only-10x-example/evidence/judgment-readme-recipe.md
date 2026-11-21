Judgment of row 1.5: README recipe wording vs the S-12 launch intent (change.md Goal; manifest itself is not in the repo).

Intent quoted from change.md: "extend README Configure with a recipe that restores the shipped Claude ladder in an OpenAI-configured project, preserves unrelated override keys, explains whole-array replacement and checks effective providers before a fresh run."

README.md (section "### Restore the shipped Claude ladder", inside the Configure section, before "### Claude Code subagent depth"):
- Restores: "can return to the shipped Claude ladder. Merge only the `ladder` key below, or delete that key" plus a single JSON fence with eight rungs.
- Preserves unrelated keys: "Leave `compare`, `limits`, `codex.profile` and every other key untouched."
- Whole-array replacement: "Arrays replace whole, so paste all eight rungs and never patch single rungs: a leftover `provider: "openai"` rung keeps its position on OpenAI."
- Checks providers before a fresh run: "Check the file first ... Then start the fresh run with `init <id> --goal "<text>" --provider-mode claude` ... read `providerMode` (`claude`), `providersByStep` (every value `claude`)"; "A resumed run keeps its stored mode, so this applies to a fresh run only."
- Ends with link to docs/REFERENCE.md#codex-and-provider-dispatch. Heading has no emoji; prose names no model outside the fence.
Markdown is plain heading, paragraphs and one json fence, which renders correctly. Every clause of the intent is covered.

Test backing (node --test ladder.test.mjs, 30 pass, 0 fail): "recipe: the README ladder equals the shipped Claude ladder", "recipe: replacing only the ladder of an OpenAI override restores Claude and keeps other keys", "recipe: a leftover OpenAI rung keeps its position" all passed.
