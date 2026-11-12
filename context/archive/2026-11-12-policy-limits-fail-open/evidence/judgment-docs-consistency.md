Row 3.3 judgment: halt vs warn wording across docs.

docs/REFERENCE.md "Policy validation (ADR-022)": "`init`, `next` and `usage` check the merged policy ... and halt ... `Nothing was written.`" and "`status` never halts on it: it prints the usual JSON plus `policyProblem` ... `risk`, `verify-archive` and `compare` do not check."
skills/10x-pipeline/prompts/README.md: "Any other `{name}` in a template halts `init`, `next` and `usage` with the template and the name (ADR-022)".
AGENTS.md (policy-validate.test.mjs bullet): "`init`, `next` and `usage` halt with the key name and write nothing on a malformed limit, ladder, step tier or prompt placeholder; `status` reports `policyProblem`".

All three name the same halting set (init, next, usage) and the same non-halting command (status, with policyProblem). Matches observed behaviour (script-manual-halts.out.txt).
Minor note: REFERENCE.md line 224 says override key values "are not checked there" (meaning at the JSON parse step); the next section states the checks, so no contradiction.
