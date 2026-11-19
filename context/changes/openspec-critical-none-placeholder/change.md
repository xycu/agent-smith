---
change_id: openspec-critical-none-placeholder
title: Stop a "- None" line under Critical from failing an OpenSpec verification
status: new
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 13 (should fix). Case A reproduced by importing `readVerdict`; case B confirmed by reading the same code path.

**The defect.** `readVerdict` in `skills/openspec-pipeline/scripts/openspec.mjs:116-126` counts every line that starts with `- ` under the `## Critical` heading of `verify.md`, and sets the verdict to `FAIL` when that count or the `Critical:` header count is above zero. The rule behind it is sound: never read the file as cleaner than it says. But a placeholder line counts as a finding.

**Case A (reproduced).** `verify.md` with `Verdict: PASS`, `Critical: 0`, `Warnings: 0`, then `## Critical` and `- None`. Result: `{"ok":true,"verdict":"FAIL","critical":1,"warnings":0,"criticalLines":["- None"]}`. The run starts a fix loop whose only finding is `- None`: up to two fix steps and two verify steps, then a halt. The prompt `skills/openspec-pipeline/prompts/os-verify.md` says to keep the heading when the list is empty; it does not forbid a placeholder line.

**Case B (read).** The fix-loop halt (`openspec.mjs:199`) tells the human to set the first lines to `Verdict: PASS` and `Critical: 0`. With real `- ` lines still under `## Critical`, the file reads `FAIL` again and the same halt returns.

**Direction (for the plan to confirm).**
- Skip placeholder lines such as `- None`, `- (none)`, `- N/A`, with or without a final period, in any letter case.
- Add to the halt text: "and remove the `- ` lines under `## Critical`".
- Tighten `os-verify.md` so the step writes no line under an empty heading.

**Constraints.**
- A real finding must never be skipped: the placeholder pattern matches the whole line only.
- When you change `decideOpenspec` or the verification, update the OpenSpec section of `docs/REFERENCE.md` (AGENTS.md Coding Style).
- The OpenSpec prompts are indexed in `skills/openspec-pipeline/prompts/README.md`; keep the index in step.

**Done when.**
- A test: `Verdict: PASS` with `- None` under `## Critical` reads `PASS` with `critical: 0`.
- A test: `- None of the migrations ran` still counts as one critical finding.
- A test: the halt text names the lines to remove.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
