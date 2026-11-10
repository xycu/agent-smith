Row 4.4 judgment. Compared route.mjs usageCommand (lines ~686-760) with docs.

Syntax: route.mjs usage line: `usage <change-id> <n> --tokens N [--tool-uses N] [--duration-ms N] [--chain 10x|openspec]`. Same string in AGENTS.md:64, REFERENCE.md:231, ADR-019 D1.
Guards: router checks args first (n positive int directly after id, flags non-negative ints, >=1 flag), then guardArchived, openspec change folder, run log, logged step, step has result; never overwrites (equal => unchanged:true). ADR-019 D2 lists exactly this order; REFERENCE.md:231 states n/flags/at-least-one rules.
Output: router prints { action:"usage", attached, n, step, usage, unchanged, report, commit } or attached:false + reason exit 1. AGENTS.md:64 states exactly that.
Archive state: router commits via archive.usageMessage "chore({id}): add late usage figure of step {n}" (policy.json:115); REFERENCE.md:107 and ADR-019 D4 give the same message and key; restore of old bytes on failure matches ADR D4.
Verdict: consistent.
