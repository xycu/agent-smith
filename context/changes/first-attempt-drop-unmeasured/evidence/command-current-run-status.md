# Read-only status of the current 10x run

Command: `node skills/10x-pipeline/scripts/route.mjs status first-attempt-drop-unmeasured --chain 10x`

Exit code 0. The output below retains coverage, settlement counts and the source, status, scope and version of observed usage evidence. Invocation identifiers and raw step details are omitted.

```json
{
  "host": "claude",
  "providerMode": "codex",
  "usageCoverage": {
    "verified": 0,
    "unavailable": 5,
    "legacy": 0,
    "missing": 6
  },
  "settledSteps": 5,
  "pendingSteps": 1,
  "observedEvidence": [
    {
      "status": "unavailable",
      "scope": "step-tree",
      "source": "codex-rollout",
      "hostVersion": "0.171.0"
    }
  ]
}
```

The current run is still in progress and has zero verified figures. Its observed Codex CLI version is 0.171.0, while the experiment pins 0.169.0 for Codex. This status does not qualify the experiment setup for 2.1.
