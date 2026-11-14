# Row 3.5 verification attempt

The pending row requires “A live host invocation for each chain performs the post-init call before its first step and reports retained original paths in its final message.”

Read the change brief, plan brief, plan review, implementation plan, both skill Start sections, cleanup implementation and relevant setup/skill tests.

Both skills instruct “Perform cleanup once for this fresh invocation, before dispatching the returned action. It precedes the first step launch for `run`, final reporting and PR handling for `done`, and archive dispatch for `archive`.” Both also require that “the final message names the branch” and includes “any retained original paths from `left`, and cleanup diagnostics”. The OpenSpec invocation adds `--chain openspec`.

Ran both existing instruction-content tests now. Their output is saved in test-3.5-cleanup-instructions.txt. Both passed. These assertions establish that the required instructions are present. The setup lifecycle tests invoke preparation, initialization and cleanup explicitly and inspect CLI results. They do not observe a host following the instructions through its final message.

No live invocation of either complete host pipeline was performed. This unattended step explicitly prohibits starting any subagent, including through another runner. Both host pipelines require subagent execution to reach their final messages. Their normal execution also writes implementation and router state beyond the files this verification step permits writing. A hand-written simulation would supply the ordering and final message being checked itself.

Row 3.5 stays pending because neither host execution ordering nor its final retained-path message was observed. No assumption substitutes for those observations.
