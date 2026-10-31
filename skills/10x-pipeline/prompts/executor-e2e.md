Unattended rules for /10x-e2e. No human answers, so every ask point of the skill has a fixed answer here. You drive phase {phase} to phase {lastPhase} of context/changes/{id}/plan.md and stop there. A redirect, a stop or a refusal of the skill is a normal ending: report it as status `blocked`, never as `failed`, and never set `signals.needsHuman` for it.

## Rules

- **GIVEN** the next-phase question asks how to proceed after phase {lastPhase} **WHEN** you pick an option **THEN** you **MUST** take the option that stops here (for example "Start a fresh session first") and not continue to phase {lastPhase} plus one.
- **GIVEN** the skill offers "Skip - already done" or any other way to flip rows without a test **WHEN** you pick an option **THEN** you **MUST NOT** choose it.
- **GIVEN** the manual confirmation gate pauses for a human **WHEN** the automated checks pass **THEN** you **MUST** treat it as confirmed, list the pending Manual rows in your reply and leave every Manual row unticked.
- **GIVEN** the skill asks you to approve the proposed commit message **WHEN** you answer **THEN** you **MUST** approve it as proposed.
- **GIVEN** the skill finds dirty paths outside the files you touched **WHEN** it asks what to stage **THEN** you **MUST** commit only the planned set and leave the other paths alone.
- **GIVEN** the skill offers to commit the setup files of /10x-e2e-setup first **WHEN** you answer **THEN** you **MUST** decline and stage only the files of this phase.
- **GIVEN** the phase is finished and the specs are green **WHEN** the skill reaches its commit step **THEN** you **MUST** commit the new tests, write the commit SHA after the rows you flipped and leave no deliberate break in the tree.
- **GIVEN** a row would be ticked but the phase made no commit **WHEN** you update the Progress section **THEN** you **MUST NOT** tick the row, because the router counts only rows backed by a code commit.
- **GIVEN** the Playwright config or the seed test is missing, the feature under test is not built, or the risk is not browser-level **WHEN** the skill would redirect to /10x-e2e-setup, /10x-tdd or /10x-implement **THEN** you **MUST** stop, change nothing and finish with status `blocked` and a note that names the reason.
- **GIVEN** a passing spec for the risk already exists **WHEN** the skill would flip rows without a commit **THEN** you **MUST** leave the rows unticked and finish with status `blocked` and a note that names the spec.
- **GIVEN** the skill asks whether to run a whole-phase E2E, a mixed phase or any other ambiguous gate **WHEN** one option is marked Recommended **THEN** you **MUST** take that option.
- **GIVEN** an ambiguous gate has no Recommended option **WHEN** you cannot pick from the plan and the code **THEN** you **MUST** finish with status `blocked` and a note that names the question.
- **GIVEN** the skill asks whether to run /10x-impl-review after the last phase **WHEN** you answer **THEN** you **MUST** skip it, because the router runs the review.
- **GIVEN** the skill would copy a command to the clipboard **WHEN** you hand off or stop **THEN** you **MUST NOT** run pbcopy, clip.exe, xclip or Set-Clipboard.
- **GIVEN** the skill would ask a question **WHEN** you run unattended **THEN** you **MUST NOT** print a plain-text question or wait for input, and you answer by the rules above.
- **GIVEN** a spec stays red or flaky after the review loop **WHEN** you cannot make it pass against the real app **THEN** you **MUST** finish with status `failed` and a note that names the spec, and you do not skip, fixme or weaken it.
