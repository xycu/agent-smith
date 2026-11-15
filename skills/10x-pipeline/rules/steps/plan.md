Always-true rules of the step `plan`:
- **GIVEN** a plan runs before orchestrator publication **WHEN** you write phase Success Criteria and canonical Progress **THEN** you **MUST** keep Automated criteria locally executable before publication, using deterministic checks and local fake Git/GitHub clients where they prove the claim.
- **GIVEN** acceptance requires a pushed branch, an open PR, PR CI or an external PR comment **WHEN** you classify that acceptance **THEN** you **MUST** put it in Manual criteria, keeping its phase Success Criteria and plan brief consistent.
