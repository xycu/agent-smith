Unattended rules for the manual-verify step. You prove the pending Manual rows of context/changes/{id}/plan.md on your own, with the tools you have. You start with no memory of earlier steps: read the plan, the change folder and the code first. A row you cannot prove stays pending with its reason, and ending with no tick is a normal result.

## Rules

- **GIVEN** a Manual row of plan.md is pending `[ ]` **WHEN** you decide which rows to check **THEN** you **MUST** treat it as in scope, including a row that asks a person to read, judge, look at or confirm something and a row that asks the owner for a decision, and judge such a row yourself.
- **GIVEN** an automated test covers the claim of a pending Manual row **WHEN** you prove that row **THEN** you **MUST** run that test now, tick the row only if it passes, and save the test run output as `test-` evidence whose first line names the test file and the test name.
- **GIVEN** a pending Manual row names a command **WHEN** you run that command **THEN** you **MUST** tick the row only if the output proves what the row says, and save the output as `command-` evidence.
- **GIVEN** the command or the test of a row fails, or its output does not prove the row **WHEN** you update plan.md **THEN** you **MUST NOT** tick the row.
- **GIVEN** no existing command or test proves a row **WHEN** you write a throw-away script to check it **THEN** you **MUST** put the script in a scratch directory outside the repository made with `mktemp -d`, or under `context/changes/{id}/evidence/`, never in the source tree or the test tree.
- **GIVEN** you made a scratch directory with `mktemp -d` **WHEN** you remove it before the step ends **THEN** you **MUST** list its files, delete them one by one and `rmdir` the empty directories deepest first, never with `rm -rf` or another recursive delete.
- **GIVEN** a throw-away script proved a row **WHEN** you save its evidence **THEN** you **MUST** save the script source and its output as `script-` evidence, so the check can be run again.
- **GIVEN** a row other than a Browser row asks to read or judge a text, a wording or a behaviour, or asks the owner for a decision **WHEN** you judge it **THEN** you **MUST** save a `judgment-` evidence file that quotes the text or behaviour you checked and gives your reasoning, and tick the row only if the quoted text supports what the row says.
- **GIVEN** a row is listed under Browser rows in the first line of this prompt **WHEN** you prove it **THEN** you **MUST** use `browser-`, `test-`, `command-` or `script-` evidence and never a `judgment-` file or a read of the source, because the router lists any other kind as unproven.
- **GIVEN** a row listed under Browser rows stays at `[ ]` **WHEN** you write `evidence/unproven.md` **THEN** you **MUST** give the reason that kept it from a browser, a test, a command or a script.
- **GIVEN** you save an evidence file **WHEN** you name it **THEN** you **MUST** start the name with its kind, one of `command-`, `test-`, `script-`, `browser-` or `judgment-`, and use only letters, digits, `.`, `_` and `-` in the rest of the name.
- **GIVEN** you tick a Manual row **WHEN** you save plan.md **THEN** you **MUST** save its evidence to `context/changes/{id}/evidence/<name>` (not empty, under 1 MB) and append ` — evidence: evidence/<name>` to that row.
- **GIVEN** several rows are proved by one check **WHEN** you tick them **THEN** you **MAY** point all of them at the same evidence file.
- **GIVEN** an evidence file or a judgment would hold a credential, a token, an environment dump or personal data **WHEN** you save it **THEN** you **MUST** redact that part first, because the step commit stores `evidence/` in the run branch.
- **GIVEN** you cannot prove a row (a live pipeline run is needed, a tool is missing, Chrome is not connected, the check fails) **WHEN** you update plan.md **THEN** you **MUST** leave the row at `[ ]` and list it in `context/changes/{id}/evidence/unproven.md` as `- <row id> — <reason>`, one line per row.
- **GIVEN** you finish an attempt **WHEN** you write `evidence/unproven.md` **THEN** you **MUST** rewrite the whole file so that it lists every row still pending, and only those.
- **GIVEN** `evidence/unproven.md` exists from an earlier attempt **WHEN** you start **THEN** you **MUST** read it first and try another proof for the rows it lists.
- **GIVEN** you edit plan.md **WHEN** you save it **THEN** you **MUST NOT** change a row title, an Automated row or a commit SHA suffix.
- **GIVEN** a Manual row was ticked before you started **WHEN** you save plan.md **THEN** you **MUST NOT** untick it.
- **GIVEN** a row is listed as rejected last time: {unproven} **WHEN** you start **THEN** you **MUST** add valid evidence to it or set it back to `[ ]`.
- **GIVEN** no row could be proved **WHEN** you finish **THEN** you **MUST** end with status `done` and no tick.
- **GIVEN** a check would push, deploy, publish or post to an external service **WHEN** you decide whether to run it **THEN** you **MUST NOT** run it, and you leave the row at `[ ]` with that reason.
- **GIVEN** you write a file **WHEN** it lies outside the run root and your scratch directory **THEN** you **MUST NOT** write it.
- **GIVEN** you write a file in the run root **WHEN** it is not plan.md and not under `context/changes/{id}/evidence/` **THEN** you **MUST NOT** write it.
- **GIVEN** you use git **WHEN** you check a row **THEN** you **MUST** use only read-only git commands: never `git reset`, `git commit`, `git checkout` or another command that writes, in the run root, because the router owns the git writes of the run (ADR-010).
- **GIVEN** a check would delete a branch, a worktree or a ref **WHEN** you decide whether to run it **THEN** you **MUST NOT** run it.
- **GIVEN** a command never ends by itself or waits for input (a watcher, a prompt, a server in the foreground) **WHEN** you decide whether to run it **THEN** you **MUST NOT** run it and you leave the row at `[ ]`, unless you prove the row another way.
- **GIVEN** a check needs a running server **WHEN** you start it **THEN** you **MUST** start it in the background with its output sent to a file, and stop it before the step ends.
- **GIVEN** the skill or a tool would ask a question **WHEN** you run unattended **THEN** you **MUST NOT** print a plain-text question or wait for input, and you decide from the plan, the code and the output of the commands.
