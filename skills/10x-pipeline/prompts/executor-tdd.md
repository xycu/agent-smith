Unattended rules for /10x-tdd. No human answers, so every ask point of the skill has a fixed answer here. You drive phase {phase} to phase {lastPhase} of context/changes/{id}/plan.md test-first and stop there. A redirect, a stop or a refusal of the skill is a normal ending: report it as status `blocked`, never as `failed`, and never set `signals.needsHuman` for it.

## Rules

- **GIVEN** the next-phase question asks how to proceed after phase {lastPhase} **WHEN** you pick an option **THEN** you **MUST** take the option that stops here (for example "Clear context first") and not continue to phase {lastPhase} plus one.
- **GIVEN** the skill offers "Skip - already done" or any other way to flip rows without a test **WHEN** you pick an option **THEN** you **MUST NOT** choose it.
- **GIVEN** the manual confirmation gate pauses for a human **WHEN** the automated checks pass **THEN** you **MUST** treat it as confirmed, list the pending Manual rows in your reply and leave every Manual row unticked.
- **GIVEN** the skill asks you to approve the proposed commit message **WHEN** you answer **THEN** you **MUST** approve it as proposed.
- **GIVEN** the skill finds dirty paths outside the files you touched **WHEN** it asks what to stage **THEN** you **MUST** commit only the planned set and leave the other paths alone.
- **GIVEN** the phase is finished and the tests are green **WHEN** the skill reaches its commit step **THEN** you **MUST** commit the tests and the code, write the commit SHA after the rows you flipped and leave no deliberate break in the tree.
- **GIVEN** a row would be ticked but the phase made no commit **WHEN** you update the Progress section **THEN** you **MUST NOT** tick the row, because the router counts only rows backed by a code commit.
- **GIVEN** the implementation of the phase already exists, no test runner is set up, or the phase is not a fit for test-first work **WHEN** the skill would redirect to /10x-implement, /10x-test-plan or a runner setup, or would ask how to handle the phase **THEN** you **MUST** stop, change nothing and finish with status `blocked` and a note that names the reason.
- **GIVEN** the skill asks how to handle a phase that mixes logic with scaffolding **WHEN** one option is marked Recommended **THEN** you **MUST** take that option.
- **GIVEN** an ambiguous gate has no Recommended option **WHEN** you cannot pick from the plan and the code **THEN** you **MUST** finish with status `blocked` and a note that names the question.
- **GIVEN** the skill asks whether to run /10x-impl-review between phases **WHEN** you answer **THEN** you **MUST** skip it, because the router runs the review.
- **GIVEN** the skill would copy a command to the clipboard **WHEN** you hand off or stop **THEN** you **MUST NOT** run pbcopy, clip.exe, xclip or Set-Clipboard.
- **GIVEN** the skill would ask a question **WHEN** you run unattended **THEN** you **MUST NOT** print a plain-text question or wait for input, and you answer by the rules above.
- **GIVEN** a test stays red after the skill's fix attempts **WHEN** you cannot make it pass **THEN** you **MUST** finish with status `failed` and a note that names the test, and you do not skip, delete or weaken it.
