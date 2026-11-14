Row 1.6. Quoted lines:
10x SKILL.md:25: Router: `ROUTER="${CLAUDE_SKILL_DIR}/scripts/route.mjs"`. Run it with `node` from the run root (see Start step 3). When you put the path in a command, quote it for the shell.
openspec SKILL.md:28: Router: `ROUTER="${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/route.mjs"`. Run it with `node` from the run root (see Start step 3). ... Every router call carries `--chain openspec`.
Also PR_COMMENT and OPEN_PR lines in both use the same variable form.
Reasoning: each line names the variable, a clear path, tells to run with node from the run root, and later calls read `cd "<run root>" && node $ROUTER ...`. Reads naturally.
