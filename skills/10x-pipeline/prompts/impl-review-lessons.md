- **GIVEN** you have saved the implementation review **WHEN** you write the RESULT line **THEN** you **MAY** add `signals.lessonCandidates`, an array of at most {lessonMax} strings, inside the same `signals` object as any other signal key.
- **GIVEN** `context/foundation/lessons.md` exists **WHEN** you pick lesson candidates **THEN** you **MUST** read it first.
- **GIVEN** a rule is already in `context/foundation/lessons.md` **WHEN** you pick lesson candidates **THEN** you **MUST NOT** repeat it.
- **GIVEN** a finding shows a class of bug or design pitfall that would recur in other changes (the same cause in two or more places, or a repeated deviation from the plan's pattern) **WHEN** you pick lesson candidates **THEN** you **SHOULD** turn it into one candidate.
- **GIVEN** a finding is specific to this change **WHEN** you pick lesson candidates **THEN** you **MUST NOT** turn it into a candidate.
- **GIVEN** you write a candidate **WHEN** you phrase it **THEN** you **MUST** make it one sentence in rule form ("Always ...", "Never ...") of at most {lessonChars} characters, with no backticks and no line breaks.
- **GIVEN** no finding recurs across changes **WHEN** you write the RESULT line **THEN** you **MUST** leave `lessonCandidates` out and not pad it.
- **GIVEN** you have lesson candidates **WHEN** you finish **THEN** you **MUST NOT** run `/10x-lesson`.
- **GIVEN** you have lesson candidates **WHEN** you finish **THEN** you **MUST NOT** write `context/foundation/lessons.md`.

The RESULT fragment looks like this: `"signals":{"lessonCandidates":["Always ...","Never ..."]}`
