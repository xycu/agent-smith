Unattended rules for /10x-frame. No human answers, so every ask point of the skill has a fixed answer here. The observation is the goal text after "Run /10x-frame", or the plan review findings named in the first lines of this prompt.

## Rules

- **GIVEN** Step 1 echoes the observation, the stated cause and the proposed direction and asks you to confirm **WHEN** you run unattended **THEN** you **MUST** treat it as confirmed and go on.
- **GIVEN** Step 1.5 asks its clarifying questions and `change.md` notes, the goal or `research.md` answer one **WHEN** you pick an option **THEN** you **MUST** take that answer and cite the source.
- **GIVEN** Step 1.5 asks a question that none of `change.md` notes, the goal and `research.md` answers **WHEN** you pick an option **THEN** you **MUST** choose "I'm not sure / haven't separated them yet".
- **GIVEN** the Step 3 evidence is conclusive, one hypothesis strong and the others none **WHEN** Step 4 would ask narrowing questions **THEN** you **MUST** skip Step 4 and say so, as the skill allows.
- **GIVEN** the Step 3 evidence is not conclusive and Step 4 asks a narrowing question **WHEN** the Step 3 evidence answers it **THEN** you **MUST** answer from that evidence and cite `file:line`.
- **GIVEN** Step 4 asks a narrowing question that the Step 3 evidence does not answer **WHEN** you pick an option **THEN** you **MUST** choose "I'm not sure / haven't checked" and set Confidence to LOW.
- **GIVEN** Step 7 asks how to proceed and Confidence is HIGH or MEDIUM **WHEN** you pick an option **THEN** you **MUST** choose "Hand off to /10x-plan".
- **GIVEN** Step 7 asks how to proceed and Confidence is LOW **WHEN** you pick an option **THEN** you **MUST** choose "Stop here".
- **GIVEN** Step 7 copies the /10x-plan command to the clipboard **WHEN** you hand off **THEN** you **MUST NOT** run pbcopy, clip.exe, xclip or Set-Clipboard.
- **GIVEN** the skill would ask a question **WHEN** you run unattended **THEN** you **MUST NOT** print a plain-text question or wait for input, and you answer by the rules above.
- **GIVEN** Step 6 writes the brief **WHEN** you save it **THEN** you **MUST** write it to `context/changes/{id}/frame.md`, keep the heading `## Reframed (or Confirmed) Problem Statement` and state exactly one Confidence label.
- **GIVEN** Confidence is LOW **WHEN** you write the brief **THEN** you **MUST** list the verification step needed before planning and still finish with status `done`.
- **GIVEN** the goal names a task but no separate observation or cause **WHEN** you frame it **THEN** you **MUST** confirm the goal as the problem statement, set Confidence to LOW with a verification step and finish with status `done`.
- **GIVEN** the goal is empty and `change.md` holds nothing to frame **WHEN** you cannot form an observation **THEN** you **MUST** finish with status `blocked` and `signals.needsHuman` that names what is missing.
- **GIVEN** you record an assumption in the RESULT line **WHEN** you write it **THEN** you **MUST** cite the evidence for it.
