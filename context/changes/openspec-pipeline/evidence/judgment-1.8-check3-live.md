Judgment for row 1.8, source: evidence/check-3-live.md (read in full for these quotes).

Unattended steps (probes 1-4, quoted):
- Probe 1 os-propose: `"status":"done"` ... "Questions observed: none." Criterion: "ends `done`; predicate A holds ... no plain-text question. **Met.**"
- Probe 2 os-apply: `"status":"done"` ... "Questions observed: none." "**Met.**"
- Probe 3 os-verify: "Criterion: ends `done`; `verify.md` has the three header lines and the two sections. **Met.**"
- Probe 4 os-archive: "Criterion: ends `done` with `archivedAs`; the change folder moved under `openspec/changes/archive/` ... **Met.**"

Blocked negative probe (probe 5, quoted):
RESULT: {"status":"blocked","note":"Goal is empty and openspec/changes/empty-probe/ holds only .openspec.yaml, so nothing describes the change; no artifact written.","assumptions":[],"signals":{"needsHuman":"Missing input: what empty-probe should build. ..."}}
"Criterion: ends `blocked` with `signals.needsHuman`. **Met.**"

Reasoning: the file shows all four steps run unattended with no question asked, and the negative probe ends blocked with needsHuman. That is exactly what row 1.8 states. Row ticked.
