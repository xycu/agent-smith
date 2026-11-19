skills/10x-pipeline/test/step-guard.test.mjs — shipped hook uses synchronous Bash exec-form Node, bounded timeout and fail-closed handling | skills/10x-pipeline/test/skill-loop.test.mjs — frontmatter requires explicit invocation and preserves user invocation | skills/openspec-pipeline/test/openspec-skill.test.mjs — frontmatter requires explicit invocation and preserves user invocation | skills/10x-pipeline/test/nested-subagents.test.mjs — child notifications never certify a whole native step token total | skills/10x-pipeline/test/accounting-readers.test.mjs — coverage distinguishes equal figures with verified and legacy scope without rewriting the ledger | skills/10x-pipeline/test/archive.test.mjs — verify-archive returns archived true with path, archivedAt and report | skills/10x-pipeline/test/archive-gate.test.mjs — 10x: allowed-tools lists AskUserQuestion | skills/openspec-pipeline/test/openspec-archive.test.mjs — the archive prompt quotes error code/message and an optional diagnostic fix

skills/10x-pipeline/test/step-guard.test.mjs — shipped hook uses synchronous Bash exec-form Node, bounded timeout and fail-closed handling
Exit 0
TAP version 13
# Subtest: shipped hook uses synchronous Bash exec-form Node, bounded timeout and fail-closed handling
ok 1 - shipped hook uses synchronous Bash exec-form Node, bounded timeout and fail-closed handling
  ---
  duration_ms: 1.134584
  type: 'test'
  ...
# Subtest: direct Git discard, hook bypass, unique-ref deletion and publication forms are denied
ok 2 - direct Git discard, hook bypass, unique-ref deletion and publication forms are denied
  ---
  duration_ms: 5158.14575
  type: 'test'
  ...
# Subtest: Git option values cannot masquerade as safety flags or hide hook bypass
ok 3 - Git option values cannot masquerade as safety flags or hide hook bypass
  ---
  duration_ms: 2241.741708
  type: 'test'
  ...
# Subtest: recursive shell deletion variants are denied using inert payloads only
ok 4 - recursive shell deletion variants are denied using inert payloads only
  ---
  duration_ms: 1063.587334
  type: 'test'
  ...
# Subtest: literal quotes, escapes and supported shell separators retain command positions
ok 5 - literal quotes, escapes and supported shell separators retain command positions
  ---
  duration_ms: 3537.070958
  type: 'test'
  ...
# Subtest: orchestrator and unrelated agents pass through, including publication script calls
ok 6 - orchestrator and unrelated agents pass through, including publication script calls
  ---
  duration_ms: 554.335166
  type: 'test'
  ...
# Subtest: dynamic programs and wrappers are outside the documented direct-command subset
ok 7 - dynamic programs and wrappers are outside the documented direct-command subset
  ---
  duration_ms: 340.806583
  type: 'test'
  ...
# Subtest: malformed guarded events deny and malformed JSON, oversized input and quote errors fail closed
ok 8 - malformed guarded events deny and malformed JSON, oversized input and quote errors fail closed
  ---
  duration_ms: 1523.006959
  type: 'test'
  ...
# Subtest: hook argument vector preserves plugin paths containing spaces and shell metacharacters
ok 9 - hook argument vector preserves plugin paths containing spaces and shell metacharacters
  ---
  duration_ms: 83.617708
  type: 'test'
  ...
# Subtest: distinct HEAD, index and working-copy versions survive denied staged restore before a recording executable
ok 10 - distinct HEAD, index and working-copy versions survive denied staged restore before a recording executable
  ---
  duration_ms: 1279.878375
  type: 'test'
  ...
# Subtest: the standalone guard has no execution, filesystem, network or routing dependency
ok 11 - the standalone guard has no execution, filesystem, network or routing dependency
  ---
  duration_ms: 0.365709
  type: 'test'
  ...
# Subtest: guarded leaf identities retain denials without broadening the orchestrator boundary
ok 12 - guarded leaf identities retain denials without broadening the orchestrator boundary
  ---
  duration_ms: 606.947833
  type: 'test'
  ...
1..12
# tests 12
# suites 0
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 16596.734

skills/10x-pipeline/test/skill-loop.test.mjs — frontmatter requires explicit invocation and preserves user invocation
Exit 0
TAP version 13
# Subtest: frontmatter requires explicit invocation and preserves user invocation
ok 1 - frontmatter requires explicit invocation and preserves user invocation
  ---
  duration_ms: 1.43525
  type: 'test'
  ...
# Subtest: README records Claude Code invocation compatibility and acceptance limits
ok 2 - README records Claude Code invocation compatibility and acceptance limits
  ---
  duration_ms: 0.139042
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 179.568166

skills/openspec-pipeline/test/openspec-skill.test.mjs — frontmatter requires explicit invocation and preserves user invocation
Exit 0
TAP version 13
# Subtest: frontmatter requires explicit invocation and preserves user invocation
ok 1 - frontmatter requires explicit invocation and preserves user invocation
  ---
  duration_ms: 1.367292
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 228.281333

skills/10x-pipeline/test/nested-subagents.test.mjs — child notifications never certify a whole native step token total
Exit 0
TAP version 13
# Subtest: child notifications never certify a whole native step token total
ok 1 - child notifications never certify a whole native step token total
  ---
  duration_ms: 1.029584
  type: 'test'
  ...
# Subtest: project settings cap Claude Code subagent depth at the string 2
ok 2 - project settings cap Claude Code subagent depth at the string 2
  ---
  duration_ms: 3.54825
  type: 'test'
  ...
# Subtest: the README offers optional string-valued project setup and a fresh session
ok 3 - the README offers optional string-valued project setup and a fresh session
  ---
  duration_ms: 0.622666
  type: 'test'
  ...
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 177.133458

skills/10x-pipeline/test/accounting-readers.test.mjs — coverage distinguishes equal figures with verified and legacy scope without rewriting the ledger
Exit 0
TAP version 13
# Subtest: coverage distinguishes equal figures with verified and legacy scope without rewriting the ledger
ok 1 - coverage distinguishes equal figures with verified and legacy scope without rewriting the ledger
  ---
  duration_ms: 1136.728
  type: 'test'
  ...
# Subtest: mixed and unavailable coverage keeps measured zero, labels subtotals, and excludes skipped usage
ok 2 - mixed and unavailable coverage keeps measured zero, labels subtotals, and excludes skipped usage
  ---
  duration_ms: 476.630291
  type: 'test'
  ...
# Subtest: 10x: missing pending and counter-only steps do not invent legacy token figures
ok 3 - 10x: missing pending and counter-only steps do not invent legacy token figures
  ---
  duration_ms: 535.211459
  type: 'test'
  ...
# Subtest: openspec: missing pending and counter-only steps do not invent legacy token figures
ok 4 - openspec: missing pending and counter-only steps do not invent legacy token figures
  ---
  duration_ms: 472.968917
  type: 'test'
  ...
# Subtest: no figures render as missing while an explicit verified zero renders as zero
ok 5 - no figures render as missing while an explicit verified zero renders as zero
  ---
  duration_ms: 722.235292
  type: 'test'
  ...
# Subtest: aggregate overflow is sticky for tokens and counters, with no selectively smaller group totals
ok 6 - aggregate overflow is sticky for tokens and counters, with no selectively smaller group totals
  ---
  duration_ms: 637.566875
  type: 'test'
  ...
# Subtest: model grouping retains prototype-shaped aliases as ordinary own keys
ok 7 - model grouping retains prototype-shaped aliases as ordinary own keys
  ---
  duration_ms: 156.615917
  type: 'test'
  ...
# Subtest: cost preserves ordinary legacy arithmetic and rejects unavailable token claims
ok 8 - cost preserves ordinary legacy arithmetic and rejects unavailable token claims
  ---
  duration_ms: 0.49075
  type: 'test'
  ...
# Subtest: cost overflow is unavailable throughout JSON and Markdown, while routing groups use the enclosing model
ok 9 - cost overflow is unavailable throughout JSON and Markdown, while routing groups use the enclosing model
  ---
  duration_ms: 340.287167
  type: 'test'
  ...
# Subtest: 10x/codex: measured producer output survives real intake and legacy continuation refuses scope verdicts
ok 10 - 10x/codex: measured producer output survives real intake and legacy continuation refuses scope verdicts
  ---
  duration_ms: 2312.355292
  type: 'test'
  ...
# Subtest: 10x/claude: measured producer output survives real intake and legacy continuation refuses scope verdicts
ok 11 - 10x/claude: measured producer output survives real intake and legacy continuation refuses scope verdicts
  ---
  duration_ms: 1749.875833
  type: 'test'
  ...
# Subtest: openspec/codex: measured producer output survives real intake and legacy continuation refuses scope verdicts
ok 12 - openspec/codex: measured producer output survives real intake and legacy continuation refuses scope verdicts
  ---
  duration_ms: 2342.775209
  type: 'test'
  ...
# Subtest: openspec/claude: measured producer output survives real intake and legacy continuation refuses scope verdicts
ok 13 - openspec/claude: measured producer output survives real intake and legacy continuation refuses scope verdicts
  ---
  duration_ms: 1884.454167
  type: 'test'
  ...
# Subtest: 10x: structured late evidence refreshes coverage and pricing without counting archive-only usage
ok 14 - 10x: structured late evidence refreshes coverage and pricing without counting archive-only usage
  ---
  duration_ms: 788.445833
  type: 'test'
  ...
# Subtest: openspec: structured late evidence refreshes coverage and pricing without counting archive-only usage
ok 15 - openspec: structured late evidence refreshes coverage and pricing without counting archive-only usage
  ---
  duration_ms: 673.395042
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 14431.456541

skills/10x-pipeline/test/archive.test.mjs — verify-archive returns archived true with path, archivedAt and report
Exit 0
TAP version 13
# Subtest: verify-archive returns archived true with path, archivedAt and report
ok 1 - verify-archive returns archived true with path, archivedAt and report
  ---
  duration_ms: 123.805375
  type: 'test'
  ...
# Subtest: verify-archive reports null report and null archivedAt when absent
ok 2 - verify-archive reports null report and null archivedAt when absent
  ---
  duration_ms: 102.025667
  type: 'test'
  ...
# Subtest: verify-archive maps a literal archived_at: null to JSON null
ok 3 - verify-archive maps a literal archived_at: null to JSON null
  ---
  duration_ms: 152.002917
  type: 'test'
  ...
# Subtest: verify-archive keeps a real archived_at as a string
ok 4 - verify-archive keeps a real archived_at as a string
  ---
  duration_ms: 80.992875
  type: 'test'
  ...
# Subtest: verify-archive strips quotes from status
ok 5 - verify-archive strips quotes from status
  ---
  duration_ms: 77.946042
  type: 'test'
  ...
# Subtest: verify-archive: no archive folder
ok 6 - verify-archive: no archive folder
  ---
  duration_ms: 147.962958
  type: 'test'
  ...
# Subtest: verify-archive: a suffix-collision folder alone is not an archive of the id
ok 7 - verify-archive: a suffix-collision folder alone is not an archive of the id
  ---
  duration_ms: 112.590125
  type: 'test'
  ...
# Subtest: verify-archive: status other than archived
ok 8 - verify-archive: status other than archived
  ---
  duration_ms: 74.903834
  type: 'test'
  ...
# Subtest: verify-archive: archive folder without change.md
ok 9 - verify-archive: archive folder without change.md
  ---
  duration_ms: 84.3365
  type: 'test'
  ...
# Subtest: verify-archive: change folder still present next to a stamped archive (partial failure)
ok 10 - verify-archive: change folder still present next to a stamped archive (partial failure)
  ---
  duration_ms: 76.832334
  type: 'test'
  ...
# Subtest: verify-archive: stamped folder that was not moved has its own reason
ok 11 - verify-archive: stamped folder that was not moved has its own reason
  ---
  duration_ms: 118.7025
  type: 'test'
  ...
# Subtest: verify-archive: two archive folders (reused id) are listed and need --path
ok 12 - verify-archive: two archive folders (reused id) are listed and need --path
  ---
  duration_ms: 155.048584
  type: 'test'
  ...
# Subtest: verify-archive --path picks one of two folders
ok 13 - verify-archive --path picks one of two folders
  ---
  duration_ms: 335.749125
  type: 'test'
  ...
# Subtest: verify-archive --path accepts a trailing slash and a leading ./
ok 14 - verify-archive --path accepts a trailing slash and a leading ./
  ---
  duration_ms: 423.421458
  type: 'test'
  ...
# Subtest: verify-archive --path with no value says it needs a folder
ok 15 - verify-archive --path with no value says it needs a folder
  ---
  duration_ms: 232.0565
  type: 'test'
  ...
# Subtest: verify-archive --path refuses anything but an archive folder of the id
ok 16 - verify-archive --path refuses anything but an archive folder of the id
  ---
  duration_ms: 1368.195166
  type: 'test'
  ...
# Subtest: verify-archive leaves the tree byte-identical
ok 17 - verify-archive leaves the tree byte-identical
  ---
  duration_ms: 356.369583
  type: 'test'
  ...
# Subtest: verify-archive answers when PATH holds no git
ok 18 - verify-archive answers when PATH holds no git
  ---
  duration_ms: 218.760417
  type: 'test'
  ...
# Subtest: haltOnManualPending true halts before the commit; the default continues
ok 19 - haltOnManualPending true halts before the commit; the default continues
  ---
  duration_ms: 2939.304667
  type: 'test'
  ...
# Subtest: verify-archive confirms a simulated move after the commit
ok 20 - verify-archive confirms a simulated move after the commit
  ---
  duration_ms: 2801.209917
  type: 'test'
  ...
1..20
# tests 20
# suites 0
# pass 20
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10397.088542

skills/10x-pipeline/test/archive-gate.test.mjs — 10x: allowed-tools lists AskUserQuestion
Exit 0
TAP version 13
# Subtest: 10x: allowed-tools lists AskUserQuestion
ok 1 - 10x: allowed-tools lists AskUserQuestion
  ---
  duration_ms: 0.733583
  type: 'test'
  ...
# Subtest: 10x: the archive branch asks before it launches the subagent
ok 2 - 10x: the archive branch asks before it launches the subagent
  ---
  duration_ms: 0.220291
  type: 'test'
  ...
# Subtest: 10x: labels, fail-closed reading and STOP
ok 3 - 10x: labels, fail-closed reading and STOP
  ---
  duration_ms: 0.14625
  type: 'test'
  ...
# Subtest: 10x: step numbers stay and the other branches do not ask
ok 4 - 10x: step numbers stay and the other branches do not ask
  ---
  duration_ms: 0.412833
  type: 'test'
  ...
# Subtest: 10x: no task tool; terminal publication reaches the single authorization owner
ok 5 - 10x: no task tool; terminal publication reaches the single authorization owner
  ---
  duration_ms: 1.151333
  type: 'test'
  ...
# Subtest: 10x: archive publication covers verification success, failure and gate refusal
ok 6 - 10x: archive publication covers verification success, failure and gate refusal
  ---
  duration_ms: 0.217583
  type: 'test'
  ...
# Subtest: 10x: still exactly six GIVEN lines
ok 7 - 10x: still exactly six GIVEN lines
  ---
  duration_ms: 0.121625
  type: 'test'
  ...
# Subtest: openspec: allowed-tools lists AskUserQuestion
ok 8 - openspec: allowed-tools lists AskUserQuestion
  ---
  duration_ms: 0.116334
  type: 'test'
  ...
# Subtest: openspec: the archive branch asks before it launches the subagent
ok 9 - openspec: the archive branch asks before it launches the subagent
  ---
  duration_ms: 0.130083
  type: 'test'
  ...
# Subtest: openspec: labels, fail-closed reading and STOP
ok 10 - openspec: labels, fail-closed reading and STOP
  ---
  duration_ms: 0.170334
  type: 'test'
  ...
# Subtest: openspec: step numbers stay and the other branches do not ask
ok 11 - openspec: step numbers stay and the other branches do not ask
  ---
  duration_ms: 0.248292
  type: 'test'
  ...
# Subtest: openspec: no task tool; terminal publication reaches the single authorization owner
ok 12 - openspec: no task tool; terminal publication reaches the single authorization owner
  ---
  duration_ms: 0.337583
  type: 'test'
  ...
# Subtest: openspec: archive publication covers verification success, failure and gate refusal
ok 13 - openspec: archive publication covers verification success, failure and gate refusal
  ---
  duration_ms: 0.132375
  type: 'test'
  ...
# Subtest: openspec: still exactly six GIVEN lines
ok 14 - openspec: still exactly six GIVEN lines
  ---
  duration_ms: 0.101458
  type: 'test'
  ...
# Subtest: the router scripts never mention AskUserQuestion
ok 15 - the router scripts never mention AskUserQuestion
  ---
  duration_ms: 26.472375
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 154.232917

skills/openspec-pipeline/test/openspec-archive.test.mjs — the archive prompt quotes error code/message and an optional diagnostic fix
Exit 0
TAP version 13
# Subtest: the archive prompt quotes error code/message and an optional diagnostic fix
ok 1 - the archive prompt quotes error code/message and an optional diagnostic fix
  ---
  duration_ms: 0.922709
  type: 'test'
  ...
# Subtest: PASS with --archive commits only openspec/changes/<id>/ and returns the os-archive action
ok 2 - PASS with --archive commits only openspec/changes/<id>/ and returns the os-archive action
  ---
  duration_ms: 3168.295417
  type: 'test'
  ...
# Subtest: an open task row never reaches the archive: it routes to os-apply and makes no commit
ok 3 - an open task row never reaches the archive: it routes to os-apply and makes no commit
  ---
  duration_ms: 360.621167
  type: 'test'
  ...
# Subtest: an existing archive target halts before the commit with committed false
ok 4 - an existing archive target halts before the commit with committed false
  ---
  duration_ms: 1143.33875
  type: 'test'
  ...
# Subtest: without --archive the run ends done with no commit
ok 5 - without --archive the run ends done with no commit
  ---
  duration_ms: 316.719583
  type: 'test'
  ...
# Subtest: a date-prefixed id keeps its name as the archive folder
ok 6 - a date-prefixed id keeps its name as the archive folder
  ---
  duration_ms: 2682.386959
  type: 'test'
  ...
# Subtest: init --chain openspec --archive halts when git ignores tasks.md
ok 7 - init --chain openspec --archive halts when git ignores tasks.md
  ---
  duration_ms: 825.617
  type: 'test'
  ...
# Subtest: the archive action, a simulated move, verify-archive and next after the move
ok 8 - the archive action, a simulated move, verify-archive and next after the move
  ---
  duration_ms: 2707.222333
  type: 'test'
  ...
# Subtest: verify-archive: archived true with the folder and the report
ok 9 - verify-archive: archived true with the folder and the report
  ---
  duration_ms: 393.142208
  type: 'test'
  ...
# Subtest: verify-archive: false while the live folder exists, with or without an archive folder
ok 10 - verify-archive: false while the live folder exists, with or without an archive folder
  ---
  duration_ms: 309.2135
  type: 'test'
  ...
# Subtest: verify-archive: no folder at all is false
ok 11 - verify-archive: no folder at all is false
  ---
  duration_ms: 95.395833
  type: 'test'
  ...
# Subtest: verify-archive --path picks one folder, and a --path that misses lists the folders found
ok 12 - verify-archive --path picks one folder, and a --path that misses lists the folders found
  ---
  duration_ms: 1457.867583
  type: 'test'
  ...
# Subtest: verify-archive: two folders without --path are ambiguous
ok 13 - verify-archive: two folders without --path are ambiguous
  ---
  duration_ms: 119.1295
  type: 'test'
  ...
# Subtest: status --chain openspec adds the OpenSpec state the router reads
ok 14 - status --chain openspec adds the OpenSpec state the router reads
  ---
  duration_ms: 445.883833
  type: 'test'
  ...
# Subtest: risk --chain openspec reports no plan paths and no plan hits
ok 15 - risk --chain openspec reports no plan paths and no plan hits
  ---
  duration_ms: 344.585375
  type: 'test'
  ...
# Subtest: compare --chain openspec reads a live and an archived side
ok 16 - compare --chain openspec reads a live and an archived side
  ---
  duration_ms: 360.59375
  type: 'test'
  ...
# Subtest: compare --chain openspec does not read a 10x side
ok 17 - compare --chain openspec does not read a 10x side
  ---
  duration_ms: 277.913667
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, demo, prior false, archive false)
ok 18 - duplicate archived init preserves all state (openspec, demo, prior false, archive false)
  ---
  duration_ms: 521.736584
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, demo, prior false, archive true)
ok 19 - duplicate archived init preserves all state (openspec, demo, prior false, archive true)
  ---
  duration_ms: 457.463959
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, demo, prior true, archive false)
ok 20 - duplicate archived init preserves all state (openspec, demo, prior true, archive false)
  ---
  duration_ms: 905.182
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, demo, prior true, archive true)
ok 21 - duplicate archived init preserves all state (openspec, demo, prior true, archive true)
  ---
  duration_ms: 905.139625
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior false, archive false)
ok 22 - duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior false, archive false)
  ---
  duration_ms: 405.162958
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior false, archive true)
ok 23 - duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior false, archive true)
  ---
  duration_ms: 535.511333
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior true, archive false)
ok 24 - duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior true, archive false)
  ---
  duration_ms: 1084.962167
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior true, archive true)
ok 25 - duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior true, archive true)
  ---
  duration_ms: 742.108417
  type: 'test'
  ...
# Subtest: OpenSpec init ignores suffix collisions and archives owned only by 10x
ok 26 - OpenSpec init ignores suffix collisions and archives owned only by 10x
  ---
  duration_ms: 825.098208
  type: 'test'
  ...
1..26
# tests 26
# suites 0
# pass 26
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 22179.03975
