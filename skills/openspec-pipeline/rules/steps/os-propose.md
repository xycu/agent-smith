Always-true rules of the step `os-propose`:
- **GIVEN** apply tasks execute before orchestrator publication **WHEN** you write tasks.md **THEN** you **MUST** keep tasks locally executable before publication, using deterministic checks and local fake Git/GitHub clients where they prove the claim.
- **GIVEN** acceptance requires a pushed branch, an open PR, PR CI or an external PR comment **WHEN** you write planning artifacts **THEN** you **MUST** record that follow-up as Manual acceptance in the proposal or design, outside executable apply tasks.
