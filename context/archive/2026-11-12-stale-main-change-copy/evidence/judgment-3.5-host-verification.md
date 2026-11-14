# Row 3.5 verification attempt

## Required observation

The pending row reads “A live host invocation for each chain performs the post-init call before its first step and reports retained original paths in its final message.”

Read the existing unproven record first, then the change brief, plan brief, review, implementation plan, both skill Start and dispatch instructions, cleanup implementation and relevant setup/skill tests.

## Checked instructions and behavior

Both skills require “Preserve the original setup JSON verbatim, independently of the cleanup response.” They specify cleanup “after step 4 returns `action: run`, `done` or `archive`” and “Perform cleanup once for this fresh invocation, before dispatching the returned action. It precedes the first step launch for `run`, final reporting and PR handling for `done`, and archive dispatch for `archive`.” The OpenSpec cleanup invocation includes `--chain openspec`.

Both final-message instructions require “the final message names the branch” and “any retained original paths from `left`, and cleanup diagnostics”. These passages support the intended ordering and reporting contract.

Both skills dispatch through the Agent tool for Claude actions or the shared runner for OpenAI actions. Their terminal instructions require the pull request step, whose description says it “pushes” the run branch and “opens a pull request”. This verification prompt prohibits starting any child agent, pushing, and posting to external services. It also restricts run-root writes to plan.md and this evidence directory, and Git use to read-only commands.

The cleanup implementation verifies retention, selectively unlinks approved inputs and returns surviving paths in `left`. The existing setup lifecycle tests call preparation, real initialization and cleanup explicitly. They check CLI results and retained paths. Their callers supply the operation ordering, and they have no observation of a live host final message.

## Current test evidence

Reran and expanded the previous proof attempt with five existing checks in skills/10x-pipeline/test/skill-loop.test.mjs. Both chains passed cleanup ordering/reporting content checks and source-absent root-selection checks. The terminal pull-request ordering check also passed. Node v24.19.0 reported five passes, zero failures and zero skips. The complete command and current output are saved in test-3.5-cleanup-instructions.txt.

These checks verify the written host contract. Row 3.5 additionally requires observed execution through each host final message. No available covering test supplies that observation. A scripted simulation would supply the ordering and final message itself.

## Outcome

Row 3.5 remains pending. Live host execution of both chains through their final messages was not performed because it requires prohibited child-agent execution, run-state writes and external terminal handling. The test evidence supports the instruction contract, while the required runtime ordering and final retained-path reports remain unobserved. No assumption replaces those observations. The plan and all existing ticks remain unchanged.
