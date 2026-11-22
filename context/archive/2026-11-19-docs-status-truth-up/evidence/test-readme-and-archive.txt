skills/10x-pipeline/test/step-guard.test.mjs — shipped hook uses synchronous Bash exec-form Node, bounded timeout and fail-closed handling | skills/10x-pipeline/test/skill-loop.test.mjs — frontmatter requires explicit invocation and preserves user invocation | skills/10x-pipeline/test/nested-subagents.test.mjs — top.md permits exactly one child layer with parent-owned gates and safety | skills/10x-pipeline/test/codex-usage.test.mjs — flat and multi-request archived child records reconcile once with cache/reasoning as subsets | skills/10x-pipeline/test/claude-usage.test.mjs — flat multi-request step: exact native request sets count four token buckets once | skills/10x-pipeline/test/accounting-readers.test.mjs — coverage distinguishes equal figures with verified and legacy scope without rewriting the ledger | skills/10x-pipeline/test/archive.test.mjs — next halts when only the archive folder exists and writes nothing | skills/10x-pipeline/test/archive-gate.test.mjs — 10x: allowed-tools lists AskUserQuestion | skills/openspec-pipeline/test/openspec-skill.test.mjs — frontmatter names the skill openspec-pipeline with its argument hint | skills/openspec-pipeline/test/openspec-archive.test.mjs — the archive prompt quotes error code/message and an optional diagnostic fix

## skills/10x-pipeline/test/step-guard.test.mjs — shipped hook uses synchronous Bash exec-form Node, bounded timeout and fail-closed handling
Exit 0
TAP version 13
# Subtest: shipped hook uses synchronous Bash exec-form Node, bounded timeout and fail-closed handling
ok 1 - shipped hook uses synchronous Bash exec-form Node, bounded timeout and fail-closed handling
  ---
  duration_ms: 1.107875
  type: 'test'
  ...
# Subtest: direct Git discard, hook bypass, unique-ref deletion and publication forms are denied
ok 2 - direct Git discard, hook bypass, unique-ref deletion and publication forms are denied
  ---
  duration_ms: 4427.508625
  type: 'test'
  ...
# Subtest: Git option values cannot masquerade as safety flags or hide hook bypass
ok 3 - Git option values cannot masquerade as safety flags or hide hook bypass
  ---
  duration_ms: 2597.844583
  type: 'test'
  ...
# Subtest: recursive shell deletion variants are denied using inert payloads only
ok 4 - recursive shell deletion variants are denied using inert payloads only
  ---
  duration_ms: 938.415208
  type: 'test'
  ...
# Subtest: literal quotes, escapes and supported shell separators retain command positions
ok 5 - literal quotes, escapes and supported shell separators retain command positions
  ---
  duration_ms: 3418.710916
  type: 'test'
  ...
# Subtest: orchestrator and unrelated agents pass through, including publication script calls
ok 6 - orchestrator and unrelated agents pass through, including publication script calls
  ---
  duration_ms: 581.678458
  type: 'test'
  ...
# Subtest: dynamic programs and wrappers are outside the documented direct-command subset
ok 7 - dynamic programs and wrappers are outside the documented direct-command subset
  ---
  duration_ms: 279.5165
  type: 'test'
  ...
# Subtest: malformed guarded events deny and malformed JSON, oversized input and quote errors fail closed
ok 8 - malformed guarded events deny and malformed JSON, oversized input and quote errors fail closed
  ---
  duration_ms: 1200.018125
  type: 'test'
  ...
# Subtest: hook argument vector preserves plugin paths containing spaces and shell metacharacters
ok 9 - hook argument vector preserves plugin paths containing spaces and shell metacharacters
  ---
  duration_ms: 62.0275
  type: 'test'
  ...
# Subtest: distinct HEAD, index and working-copy versions survive denied staged restore before a recording executable
ok 10 - distinct HEAD, index and working-copy versions survive denied staged restore before a recording executable
  ---
  duration_ms: 1063.848
  type: 'test'
  ...
# Subtest: the standalone guard has no execution, filesystem, network or routing dependency
ok 11 - the standalone guard has no execution, filesystem, network or routing dependency
  ---
  duration_ms: 0.415958
  type: 'test'
  ...
# Subtest: guarded leaf identities retain denials without broadening the orchestrator boundary
ok 12 - guarded leaf identities retain denials without broadening the orchestrator boundary
  ---
  duration_ms: 1124.583791
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
# duration_ms 15912.808167

## skills/10x-pipeline/test/skill-loop.test.mjs — frontmatter requires explicit invocation and preserves user invocation
Exit 0
TAP version 13
# Subtest: frontmatter requires explicit invocation and preserves user invocation
ok 1 - frontmatter requires explicit invocation and preserves user invocation
  ---
  duration_ms: 1.671333
  type: 'test'
  ...
# Subtest: plugin descriptions agree on the explicit pipeline entry point
ok 2 - plugin descriptions agree on the explicit pipeline entry point
  ---
  duration_ms: 0.851833
  type: 'test'
  ...
# Subtest: README records Claude Code invocation compatibility and acceptance limits
ok 3 - README records Claude Code invocation compatibility and acceptance limits
  ---
  duration_ms: 0.246958
  type: 'test'
  ...
# Subtest: the section holds exactly six rule lines, and SKILL.md has no other **GIVEN** line
ok 4 - the section holds exactly six rule lines, and SKILL.md has no other **GIVEN** line
  ---
  duration_ms: 0.199625
  type: 'test'
  ...
# Subtest: rule line k holds the needles of behavior k
ok 5 - rule line k holds the needles of behavior k
  ---
  duration_ms: 0.214291
  type: 'test'
  ...
# Subtest: the section lies between \#\# Loop and \#\# PR comment (opt-in), outside every Loop branch
ok 6 - the section lies between \#\# Loop and \#\# PR comment (opt-in), outside every Loop branch
  ---
  duration_ms: 0.229333
  type: 'test'
  ...
# Subtest: the run branch points at the anti-stall rules
ok 7 - the run branch points at the anti-stall rules
  ---
  duration_ms: 0.113125
  type: 'test'
  ...
# Subtest: the section names no model, effort or tier
ok 8 - the section names no model, effort or tier
  ---
  duration_ms: 0.199459
  type: 'test'
  ...
# Subtest: the OPEN_PR line points at the open-pr script, which exists
ok 9 - the OPEN_PR line points at the open-pr script, which exists
  ---
  duration_ms: 0.186916
  type: 'test'
  ...
# Subtest: every script path names ${CLAUDE_SKILL_DIR}, and the old placeholder is gone
ok 10 - every script path names ${CLAUDE_SKILL_DIR}, and the old placeholder is gone
  ---
  duration_ms: 0.349667
  type: 'test'
  ...
# Subtest: the pull request section follows \#\# PR comment (opt-in) and runs the script from the run root
ok 11 - the pull request section follows \#\# PR comment (opt-in) and runs the script from the run root
  ---
  duration_ms: 0.29025
  type: 'test'
  ...
# Subtest: done, archive and halt reach publication before STOP, with comments owned by publication
ok 12 - done, archive and halt reach publication before STOP, with comments owned by publication
  ---
  duration_ms: 0.266125
  type: 'test'
  ...
# Subtest: late usage has one owner and precedes terminal status, publication and archive launch
ok 13 - late usage has one owner and precedes terminal status, publication and archive launch
  ---
  duration_ms: 0.177916
  type: 'test'
  ...
# Subtest: the run branch points at rule 3 for a figure that arrives after next, and the Rules name usage as the one way in
ok 14 - the run branch points at rule 3 for a figure that arrives after next, and the Rules name usage as the one way in
  ---
  duration_ms: 0.071
  type: 'test'
  ...
# Subtest: the argument hint and Start step 1 name --rigor with its value and the goal text
ok 15 - the argument hint and Start step 1 name --rigor with its value and the goal text
  ---
  duration_ms: 0.072583
  type: 'test'
  ...
# Subtest: the Bash timeout line names the three scripts and `timeout: 600000`, outside the anti-stall section
ok 16 - the Bash timeout line names the three scripts and `timeout: 600000`, outside the anti-stall section
  ---
  duration_ms: 0.104208
  type: 'test'
  ...
# Subtest: 10x: numbered description and archive override record separate retry invocations
ok 17 - 10x: numbered description and archive override record separate retry invocations
  ---
  duration_ms: 0.057833
  type: 'test'
  ...
# Subtest: 10x: background flag is selected from the exposed schema before calling
ok 18 - 10x: background flag is selected from the exposed schema before calling
  ---
  duration_ms: 0.064292
  type: 'test'
  ...
# Subtest: 10x: rule 1 handles launch notices independently of the background flag
ok 19 - 10x: rule 1 handles launch notices independently of the background flag
  ---
  duration_ms: 0.104958
  type: 'test'
  ...
# Subtest: 10x: rule 6 rejects foreign, conflicting and superseded completion identities
ok 20 - 10x: rule 6 rejects foreign, conflicting and superseded completion identities
  ---
  duration_ms: 0.058583
  type: 'test'
  ...
# Subtest: 10x: on-time usage excludes earlier and foreign notifications without delaying next
ok 21 - 10x: on-time usage excludes earlier and foreign notifications without delaying next
  ---
  duration_ms: 0.082125
  type: 'test'
  ...
# Subtest: 10x: done late usage recovers the earlier numbered launch, not the latest repeated step
ok 22 - 10x: done late usage recovers the earlier numbered launch, not the latest repeated step
  ---
  duration_ms: 0.10225
  type: 'test'
  ...
# Subtest: 10x: archive late usage recovers the earlier numbered launch, not the latest repeated step
ok 23 - 10x: archive late usage recovers the earlier numbered launch, not the latest repeated step
  ---
  duration_ms: 0.07575
  type: 'test'
  ...
# Subtest: 10x: halt late usage recovers the earlier numbered launch, not the latest repeated step
ok 24 - 10x: halt late usage recovers the earlier numbered launch, not the latest repeated step
  ---
  duration_ms: 0.073375
  type: 'test'
  ...
# Subtest: openspec: numbered description and archive override record separate retry invocations
ok 25 - openspec: numbered description and archive override record separate retry invocations
  ---
  duration_ms: 0.034417
  type: 'test'
  ...
# Subtest: openspec: background flag is selected from the exposed schema before calling
ok 26 - openspec: background flag is selected from the exposed schema before calling
  ---
  duration_ms: 0.028708
  type: 'test'
  ...
# Subtest: openspec: rule 1 handles launch notices independently of the background flag
ok 27 - openspec: rule 1 handles launch notices independently of the background flag
  ---
  duration_ms: 0.057625
  type: 'test'
  ...
# Subtest: openspec: rule 6 rejects foreign, conflicting and superseded completion identities
ok 28 - openspec: rule 6 rejects foreign, conflicting and superseded completion identities
  ---
  duration_ms: 0.053875
  type: 'test'
  ...
# Subtest: openspec: on-time usage excludes earlier and foreign notifications without delaying next
ok 29 - openspec: on-time usage excludes earlier and foreign notifications without delaying next
  ---
  duration_ms: 0.062917
  type: 'test'
  ...
# Subtest: openspec: done late usage recovers the earlier numbered launch, not the latest repeated step
ok 30 - openspec: done late usage recovers the earlier numbered launch, not the latest repeated step
  ---
  duration_ms: 0.07775
  type: 'test'
  ...
# Subtest: openspec: archive late usage recovers the earlier numbered launch, not the latest repeated step
ok 31 - openspec: archive late usage recovers the earlier numbered launch, not the latest repeated step
  ---
  duration_ms: 0.083875
  type: 'test'
  ...
# Subtest: openspec: halt late usage recovers the earlier numbered launch, not the latest repeated step
ok 32 - openspec: halt late usage recovers the earlier numbered launch, not the latest repeated step
  ---
  duration_ms: 0.082542
  type: 'test'
  ...
# Subtest: Start step 3 consumes the shared setup result and retains run safety
ok 33 - Start step 3 consumes the shared setup result and retains run safety
  ---
  duration_ms: 0.231542
  type: 'test'
  ...
# Subtest: 10x: actual branch reporting uses publication, saved setup and unavailable identity
ok 34 - 10x: actual branch reporting uses publication, saved setup and unavailable identity
  ---
  duration_ms: 0.095666
  type: 'test'
  ...
# Subtest: 10x: cleanup uses saved fresh setup after successful init and before each dispatch
ok 35 - 10x: cleanup uses saved fresh setup after successful init and before each dispatch
  ---
  duration_ms: 0.151208
  type: 'test'
  ...
# Subtest: 10x: change inputs follow root selection with original-root diagnostic fallback
ok 36 - 10x: change inputs follow root selection with original-root diagnostic fallback
  ---
  duration_ms: 0.15775
  type: 'test'
  ...
# Subtest: openspec: actual branch reporting uses publication, saved setup and unavailable identity
ok 37 - openspec: actual branch reporting uses publication, saved setup and unavailable identity
  ---
  duration_ms: 0.048875
  type: 'test'
  ...
# Subtest: openspec: cleanup uses saved fresh setup after successful init and before each dispatch
ok 38 - openspec: cleanup uses saved fresh setup after successful init and before each dispatch
  ---
  duration_ms: 0.075834
  type: 'test'
  ...
# Subtest: openspec: change inputs follow root selection with original-root diagnostic fallback
ok 39 - openspec: change inputs follow root selection with original-root diagnostic fallback
  ---
  duration_ms: 0.069
  type: 'test'
  ...
# Subtest: both numbered dispatch loops forward file handoffs without loading the task
ok 40 - both numbered dispatch loops forward file handoffs without loading the task
  ---
  duration_ms: 0.219667
  type: 'test'
  ...
# Subtest: 10x: Anti-stall baseline is immutable apart from the required suspension STOP
ok 41 - 10x: Anti-stall baseline is immutable apart from the required suspension STOP
  ---
  duration_ms: 0.386917
  type: 'test'
  ...
# Subtest: 10x: routing literals stay in policy and reference
ok 42 - 10x: routing literals stay in policy and reference
  ---
  duration_ms: 1.015958
  type: 'test'
  ...
# Subtest: openspec: Anti-stall baseline is immutable apart from the required suspension STOP
ok 43 - openspec: Anti-stall baseline is immutable apart from the required suspension STOP
  ---
  duration_ms: 0.073542
  type: 'test'
  ...
# Subtest: openspec: routing literals stay in policy and reference
ok 44 - openspec: routing literals stay in policy and reference
  ---
  duration_ms: 0.534792
  type: 'test'
  ...
# Subtest: AGENTS assigns routing documentation to the reference for both skills
ok 45 - AGENTS assigns routing documentation to the reference for both skills
  ---
  duration_ms: 0.496458
  type: 'test'
  ...
# Subtest: 10x: skill byte budget and single procedure owners
ok 46 - 10x: skill byte budget and single procedure owners
  ---
  duration_ms: 0.146291
  type: 'test'
  ...
# Subtest: 10x: split dispatch preserves fault, result and usage boundaries
ok 47 - 10x: split dispatch preserves fault, result and usage boundaries
  ---
  duration_ms: 0.127875
  type: 'test'
  ...
# Subtest: openspec: skill byte budget and single procedure owners
ok 48 - openspec: skill byte budget and single procedure owners
  ---
  duration_ms: 0.113209
  type: 'test'
  ...
# Subtest: openspec: split dispatch preserves fault, result and usage boundaries
ok 49 - openspec: split dispatch preserves fault, result and usage boundaries
  ---
  duration_ms: 0.111709
  type: 'test'
  ...
# Subtest: 10x: setup retains field validation and isolated final-state diagnostics
ok 50 - 10x: setup retains field validation and isolated final-state diagnostics
  ---
  duration_ms: 0.124916
  type: 'test'
  ...
# Subtest: 10x: terminal reporting retains verdict, proof and worktree obligations
ok 51 - 10x: terminal reporting retains verdict, proof and worktree obligations
  ---
  duration_ms: 0.270166
  type: 'test'
  ...
# Subtest: openspec: setup retains field validation and isolated final-state diagnostics
ok 52 - openspec: setup retains field validation and isolated final-state diagnostics
  ---
  duration_ms: 0.093625
  type: 'test'
  ...
# Subtest: openspec: terminal reporting retains verdict, proof and worktree obligations
ok 53 - openspec: terminal reporting retains verdict, proof and worktree obligations
  ---
  duration_ms: 0.17075
  type: 'test'
  ...
# Subtest: 10x: enclosing report follows collection and failure reconciliation
ok 54 - 10x: enclosing report follows collection and failure reconciliation
  ---
  duration_ms: 0.045292
  type: 'test'
  ...
# Subtest: 10x: immediate accounting rejects final-request totals and always uses the shared reader
ok 55 - 10x: immediate accounting rejects final-request totals and always uses the shared reader
  ---
  duration_ms: 0.061375
  type: 'test'
  ...
# Subtest: 10x: late and archive accounting share collection without a second next or raw payload
ok 56 - 10x: late and archive accounting share collection without a second next or raw payload
  ---
  duration_ms: 0.146875
  type: 'test'
  ...
# Subtest: openspec: enclosing report follows collection and failure reconciliation
ok 57 - openspec: enclosing report follows collection and failure reconciliation
  ---
  duration_ms: 0.029708
  type: 'test'
  ...
# Subtest: openspec: immediate accounting rejects final-request totals and always uses the shared reader
ok 58 - openspec: immediate accounting rejects final-request totals and always uses the shared reader
  ---
  duration_ms: 0.026541
  type: 'test'
  ...
# Subtest: openspec: late and archive accounting share collection without a second next or raw payload
ok 59 - openspec: late and archive accounting share collection without a second next or raw payload
  ---
  duration_ms: 0.070792
  type: 'test'
  ...
# Subtest: 10x: unresolved native execution suspends before result intake and publication
ok 60 - 10x: unresolved native execution suspends before result intake and publication
  ---
  duration_ms: 0.25375
  type: 'test'
  ...
# Subtest: openspec: unresolved native execution suspends before result intake and publication
ok 61 - openspec: unresolved native execution suspends before result intake and publication
  ---
  duration_ms: 0.179417
  type: 'test'
  ...
1..61
# tests 61
# suites 0
# pass 61
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 269.104333

## skills/10x-pipeline/test/nested-subagents.test.mjs — top.md permits exactly one child layer with parent-owned gates and safety
Exit 0
TAP version 13
# Subtest: top.md permits exactly one child layer with parent-owned gates and safety
ok 1 - top.md permits exactly one child layer with parent-owned gates and safety
  ---
  duration_ms: 1.8355
  type: 'test'
  ...
# Subtest: implement, implement-segment and executor-retry.md retain enclosing step ownership
ok 2 - implement, implement-segment and executor-retry.md retain enclosing step ownership
  ---
  duration_ms: 0.910416
  type: 'test'
  ...
# Subtest: the tdd and e2e guides apply the shared child contract
ok 3 - the tdd and e2e guides apply the shared child contract
  ---
  duration_ms: 1.826833
  type: 'test'
  ...
# Subtest: research-with-map.md delegates read-only analyses and retains synthesis
ok 4 - research-with-map.md delegates read-only analyses and retains synthesis
  ---
  duration_ms: 0.507375
  type: 'test'
  ...
# Subtest: the router returns an implement prompt with the top.md rule and the implement rule, once each
ok 5 - the router returns an implement prompt with the top.md rule and the implement rule, once each
  ---
  duration_ms: 817.751791
  type: 'test'
  ...
# Subtest: the new lines name no model, effort or tier
ok 6 - the new lines name no model, effort or tier
  ---
  duration_ms: 0.622458
  type: 'test'
  ...
# Subtest: the sixth rule of both skills ignores a hand-back from a subagent the orchestrator did not launch
ok 7 - the sixth rule of both skills ignores a hand-back from a subagent the orchestrator did not launch
  ---
  duration_ms: 1.214041
  type: 'test'
  ...
# Subtest: the sixth rule is the same line in both skills
ok 8 - the sixth rule is the same line in both skills
  ---
  duration_ms: 0.336542
  type: 'test'
  ...
# Subtest: child notifications never certify a whole native step token total
ok 9 - child notifications never certify a whole native step token total
  ---
  duration_ms: 0.292916
  type: 'test'
  ...
# Subtest: the intro of both anti-stall sections names the sixth rule
ok 10 - the intro of both anti-stall sections names the sixth rule
  ---
  duration_ms: 0.385166
  type: 'test'
  ...
# Subtest: project settings cap Claude Code subagent depth at the string 2
ok 11 - project settings cap Claude Code subagent depth at the string 2
  ---
  duration_ms: 0.394542
  type: 'test'
  ...
# Subtest: the reference documents the depth cap and optional plugin-user setup
ok 12 - the reference documents the depth cap and optional plugin-user setup
  ---
  duration_ms: 1.578791
  type: 'test'
  ...
# Subtest: the README offers optional string-valued project setup and a fresh session
ok 13 - the README offers optional string-valued project setup and a fresh session
  ---
  duration_ms: 0.487625
  type: 'test'
  ...
# Subtest: ADR-018 amends the historical enforcement gap and records pending live acceptance
ok 14 - ADR-018 amends the historical enforcement gap and records pending live acceptance
  ---
  duration_ms: 0.503959
  type: 'test'
  ...
# Subtest: ADR-018 exists and its rule lines follow the rule form
ok 15 - ADR-018 exists and its rule lines follow the rule form
  ---
  duration_ms: 1.995916
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
# duration_ms 1053.568459

## skills/10x-pipeline/test/codex-usage.test.mjs — flat and multi-request archived child records reconcile once with cache/reasoning as subsets
Exit 0
TAP version 13
# Subtest: flat and multi-request archived child records reconcile once with cache/reasoning as subsets
ok 1 - flat and multi-request archived child records reconcile once with cache/reasoning as subsets
  ---
  duration_ms: 12.274084
  type: 'test'
  ...
# Subtest: stable response duplicates, even after the terminal marker, add nothing
ok 2 - stable response duplicates, even after the terminal marker, add nothing
  ---
  duration_ms: 41.938291
  type: 'test'
  ...
# Subtest: child app-server session identity belongs to its thread, not the causal root
ok 3 - child app-server session identity belongs to its thread, not the causal root
  ---
  duration_ms: 2.561959
  type: 'test'
  ...
# Subtest: child persisted session header must retain the causal root session
ok 4 - child persisted session header must retain the causal root session
  ---
  duration_ms: 2.028959
  type: 'test'
  ...
# Subtest: child persisted response must retain the causal root session
ok 5 - child persisted response must retain the causal root session
  ---
  duration_ms: 1.947417
  type: 'test'
  ...
# Subtest: a conflicting duplicate cannot supply a total
ok 6 - a conflicting duplicate cannot supply a total
  ---
  duration_ms: 1.46675
  type: 'test'
  ...
# Subtest: an attributable explicit zero is measured; empty/default-zero capture is unavailable
ok 7 - an attributable explicit zero is measured; empty/default-zero capture is unavailable
  ---
  duration_ms: 3.8615
  type: 'test'
  ...
# Subtest: missing first response with final snapshot retained omits all tokens
ok 8 - missing first response with final snapshot retained omits all tokens
  ---
  duration_ms: 1.747041
  type: 'test'
  ...
# Subtest: missing terminal omits all tokens
ok 9 - missing terminal omits all tokens
  ---
  duration_ms: 2.694542
  type: 'test'
  ...
# Subtest: foreign causal root omits all tokens
ok 10 - foreign causal root omits all tokens
  ---
  duration_ms: 2.1515
  type: 'test'
  ...
# Subtest: foreign actual thread omits all tokens
ok 11 - foreign actual thread omits all tokens
  ---
  duration_ms: 1.691542
  type: 'test'
  ...
# Subtest: foreign session omits all tokens
ok 12 - foreign session omits all tokens
  ---
  duration_ms: 36.182542
  type: 'test'
  ...
# Subtest: inherited root history omits all tokens
ok 13 - inherited root history omits all tokens
  ---
  duration_ms: 2.59875
  type: 'test'
  ...
# Subtest: unsupported version omits all tokens
ok 14 - unsupported version omits all tokens
  ---
  duration_ms: 1.262833
  type: 'test'
  ...
# Subtest: unsupported record schema omits all tokens
ok 15 - unsupported record schema omits all tokens
  ---
  duration_ms: 74.801917
  type: 'test'
  ...
# Subtest: snapshot conflict omits all tokens
ok 16 - snapshot conflict omits all tokens
  ---
  duration_ms: 26.167666
  type: 'test'
  ...
# Subtest: resumed root turn omits all tokens
ok 17 - resumed root turn omits all tokens
  ---
  duration_ms: 2.757666
  type: 'test'
  ...
# Subtest: collaboration without an accounted child tree and usage-only metadata errors fail closed
ok 18 - collaboration without an accounted child tree and usage-only metadata errors fail closed
  ---
  duration_ms: 1.613584
  type: 'test'
  ...
# Subtest: a reported incomplete response remains observed usage when its host counters reconcile
ok 19 - a reported incomplete response remains observed usage when its host counters reconcile
  ---
  duration_ms: 1.9105
  type: 'test'
  ...
# Subtest: a legacy copied child prefix has an exact own-thread boundary
ok 20 - a legacy copied child prefix has an exact own-thread boundary
  ---
  duration_ms: 2.848334
  type: 'test'
  ...
# Subtest: a paginated copied child prefix has an exact own-thread boundary
ok 21 - a paginated copied child prefix has an exact own-thread boundary
  ---
  duration_ms: 3.452292
  type: 'test'
  ...
# Subtest: unknown child history references and discontinuous ordinals are unavailable
ok 22 - unknown child history references and discontinuous ordinals are unavailable
  ---
  duration_ms: 8.249375
  type: 'test'
  ...
# Subtest: missing, redirected, outside-root, replaced and truncated sources expose bounded reasons
ok 23 - missing, redirected, outside-root, replaced and truncated sources expose bounded reasons
  ---
  duration_ms: 3.334583
  type: 'test'
  ...
# Subtest: fixed record, invocation-byte, session and read-time limits refuse without subtotals
ok 24 - fixed record, invocation-byte, session and read-time limits refuse without subtotals
  ---
  duration_ms: 43.723625
  type: 'test'
  ...
# Subtest: token sums cannot overflow safe integer arithmetic
ok 25 - token sums cannot overflow safe integer arithmetic
  ---
  duration_ms: 3.411834
  type: 'test'
  ...
1..25
# tests 25
# suites 0
# pass 25
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 555.582333

## skills/10x-pipeline/test/claude-usage.test.mjs — flat multi-request step: exact native request sets count four token buckets once
Exit 0
TAP version 13
# Subtest: flat multi-request step: exact native request sets count four token buckets once
ok 1 - flat multi-request step: exact native request sets count four token buckets once
  ---
  duration_ms: 12.670708
  type: 'test'
  ...
# Subtest: step and leaf: exact native request sets count four token buckets once
ok 2 - step and leaf: exact native request sets count four token buckets once
  ---
  duration_ms: 7.007458
  type: 'test'
  ...
# Subtest: streamed updates and stable transcript/export duplicates do not become separate requests
ok 3 - streamed updates and stable transcript/export duplicates do not become separate requests
  ---
  duration_ms: 6.699416
  type: 'test'
  ...
# Subtest: a missing process attribute is unavailable rather than inferred from the session
ok 4 - a missing process attribute is unavailable rather than inferred from the session
  ---
  duration_ms: 21.653875
  type: 'test'
  ...
# Subtest: a zero requires explicit matching native and telemetry request counters
ok 5 - a zero requires explicit matching native and telemetry request counters
  ---
  duration_ms: 13.440542
  type: 'test'
  ...
# Subtest: late exports remain unavailable until terminal and exact request membership reconcile
ok 6 - late exports remain unavailable until terminal and exact request membership reconcile
  ---
  duration_ms: 5.290416
  type: 'test'
  ...
# Subtest: unsupported host omits tokens and preserves independent counters
ok 7 - unsupported host omits tokens and preserves independent counters
  ---
  duration_ms: 2.114625
  type: 'test'
  ...
# Subtest: missing process provenance omits tokens and preserves independent counters
ok 8 - missing process provenance omits tokens and preserves independent counters
  ---
  duration_ms: 1.929583
  type: 'test'
  ...
# Subtest: resumed process omits tokens and preserves independent counters
ok 9 - resumed process omits tokens and preserves independent counters
  ---
  duration_ms: 2.701917
  type: 'test'
  ...
# Subtest: missing native stop omits tokens and preserves independent counters
ok 10 - missing native stop omits tokens and preserves independent counters
  ---
  duration_ms: 6.487916
  type: 'test'
  ...
# Subtest: resumed agent omits tokens and preserves independent counters
ok 11 - resumed agent omits tokens and preserves independent counters
  ---
  duration_ms: 3.958
  type: 'test'
  ...
# Subtest: superseded run omits tokens and preserves independent counters
ok 12 - superseded run omits tokens and preserves independent counters
  ---
  duration_ms: 2.549167
  type: 'test'
  ...
# Subtest: wrong native session omits tokens and preserves independent counters
ok 13 - wrong native session omits tokens and preserves independent counters
  ---
  duration_ms: 4.820666
  type: 'test'
  ...
# Subtest: wrong native agent omits tokens and preserves independent counters
ok 14 - wrong native agent omits tokens and preserves independent counters
  ---
  duration_ms: 9.396375
  type: 'test'
  ...
# Subtest: foreign event session omits tokens and preserves independent counters
ok 15 - foreign event session omits tokens and preserves independent counters
  ---
  duration_ms: 2.274208
  type: 'test'
  ...
# Subtest: wrong child parent omits tokens and preserves independent counters
ok 16 - wrong child parent omits tokens and preserves independent counters
  ---
  duration_ms: 2.346625
  type: 'test'
  ...
# Subtest: internal unexplained agent omits tokens and preserves independent counters
ok 17 - internal unexplained agent omits tokens and preserves independent counters
  ---
  duration_ms: 2.220292
  type: 'test'
  ...
# Subtest: missing terminal export omits tokens and preserves independent counters
ok 18 - missing terminal export omits tokens and preserves independent counters
  ---
  duration_ms: 2.764084
  type: 'test'
  ...
# Subtest: missing Agent tool result omits tokens and preserves independent counters
ok 19 - missing Agent tool result omits tokens and preserves independent counters
  ---
  duration_ms: 9.906291
  type: 'test'
  ...
# Subtest: failed Agent tool result omits tokens and preserves independent counters
ok 20 - failed Agent tool result omits tokens and preserves independent counters
  ---
  duration_ms: 3.504625
  type: 'test'
  ...
# Subtest: conflicting snapshot omits tokens and preserves independent counters
ok 21 - conflicting snapshot omits tokens and preserves independent counters
  ---
  duration_ms: 3.297542
  type: 'test'
  ...
# Subtest: unknown transcript lineage omits tokens and preserves independent counters
ok 22 - unknown transcript lineage omits tokens and preserves independent counters
  ---
  duration_ms: 2.867791
  type: 'test'
  ...
# Subtest: wrong final UUID omits tokens and preserves independent counters
ok 23 - wrong final UUID omits tokens and preserves independent counters
  ---
  duration_ms: 2.804875
  type: 'test'
  ...
# Subtest: equal sums with different request membership are unavailable
ok 24 - equal sums with different request membership are unavailable
  ---
  duration_ms: 2.4155
  type: 'test'
  ...
# Subtest: an extra assistant response cannot hide an unaccounted request
ok 25 - an extra assistant response cannot hide an unaccounted request
  ---
  duration_ms: 13.096791
  type: 'test'
  ...
# Subtest: decimal-string OTLP integers and text responses on earlier requests remain supported
ok 26 - decimal-string OTLP integers and text responses on earlier requests remain supported
  ---
  duration_ms: 4.643166
  type: 'test'
  ...
# Subtest: unsafe OTLP intValue -1 is unavailable
ok 27 - unsafe OTLP intValue -1 is unavailable
  ---
  duration_ms: 2.714292
  type: 'test'
  ...
# Subtest: unsafe OTLP intValue 1.5 is unavailable
ok 28 - unsafe OTLP intValue 1.5 is unavailable
  ---
  duration_ms: 2.56775
  type: 'test'
  ...
# Subtest: unsafe OTLP intValue 9007199254740992 is unavailable
ok 29 - unsafe OTLP intValue 9007199254740992 is unavailable
  ---
  duration_ms: 4.361125
  type: 'test'
  ...
# Subtest: unsafe OTLP intValue 1.5 is unavailable
ok 30 - unsafe OTLP intValue 1.5 is unavailable
  ---
  duration_ms: 2.898417
  type: 'test'
  ...
# Subtest: unsafe OTLP intValue -1 is unavailable
ok 31 - unsafe OTLP intValue -1 is unavailable
  ---
  duration_ms: 2.174542
  type: 'test'
  ...
# Subtest: unsafe OTLP intValue 9007199254740992 is unavailable
ok 32 - unsafe OTLP intValue 9007199254740992 is unavailable
  ---
  duration_ms: 7.803041
  type: 'test'
  ...
# Subtest: broken attachment history cannot establish invocation coverage
ok 33 - broken attachment history cannot establish invocation coverage
  ---
  duration_ms: 2.742625
  type: 'test'
  ...
# Subtest: cyclic attachment history cannot establish invocation coverage
ok 34 - cyclic attachment history cannot establish invocation coverage
  ---
  duration_ms: 3.358541
  type: 'test'
  ...
# Subtest: disconnected attachment history cannot establish invocation coverage
ok 35 - disconnected attachment history cannot establish invocation coverage
  ---
  duration_ms: 29.537459
  type: 'test'
  ...
# Subtest: wrong launch prompt attachment history cannot establish invocation coverage
ok 36 - wrong launch prompt attachment history cannot establish invocation coverage
  ---
  duration_ms: 3.174875
  type: 'test'
  ...
# Subtest: tool-only requests still require complete membership and a terminal assistant response
ok 37 - tool-only requests still require complete membership and a terminal assistant response
  ---
  duration_ms: 6.323834
  type: 'test'
  ...
# Subtest: request and message identity are a bijection, not just equal counters
ok 38 - request and message identity are a bijection, not just equal counters
  ---
  duration_ms: 3.675209
  type: 'test'
  ...
# Subtest: a selected child identity reused by another launch is ambiguous
ok 39 - a selected child identity reused by another launch is ambiguous
  ---
  duration_ms: 5.060208
  type: 'test'
  ...
# Subtest: conflicting exports and new-sequence terminal replays never move the boundary
ok 40 - conflicting exports and new-sequence terminal replays never move the boundary
  ---
  duration_ms: 6.727416
  type: 'test'
  ...
# Subtest: missing and unsafe sources, malformed records and resource exhaustion never expose a subtotal
ok 41 - missing and unsafe sources, malformed records and resource exhaustion never expose a subtotal
  ---
  duration_ms: 9.26925
  type: 'test'
  ...
# Subtest: agent count, arithmetic overflow and the invocation-wide read budget fail closed
ok 42 - agent count, arithmetic overflow and the invocation-wide read budget fail closed
  ---
  duration_ms: 17.4625
  type: 'test'
  ...
# Subtest: immediate, late and archive boundaries use the same read-only collector
ok 43 - immediate, late and archive boundaries use the same read-only collector
  ---
  duration_ms: 486.932125
  type: 'test'
  ...
# Subtest: unavailable CLI and malformed import boundaries are successful measurements without step-authored tokens
ok 44 - unavailable CLI and malformed import boundaries are successful measurements without step-authored tokens
  ---
  duration_ms: 295.689625
  type: 'test'
  ...
# Subtest: the CLI decodes a Unicode source path across arbitrary descriptor chunk boundaries
ok 45 - the CLI decodes a Unicode source path across arbitrary descriptor chunk boundaries
  ---
  duration_ms: 204.804875
  type: 'test'
  ...
# Subtest: an unfinished descriptor stream reaches the fixed deadline without waiting for telemetry
ok 46 - an unfinished descriptor stream reaches the fixed deadline without waiting for telemetry
  ---
  duration_ms: 2132.2615
  type: 'test'
  ...
1..46
# tests 46
# suites 0
# pass 46
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3691.19875

## skills/10x-pipeline/test/accounting-readers.test.mjs — coverage distinguishes equal figures with verified and legacy scope without rewriting the ledger
Exit 0
TAP version 13
# Subtest: coverage distinguishes equal figures with verified and legacy scope without rewriting the ledger
ok 1 - coverage distinguishes equal figures with verified and legacy scope without rewriting the ledger
  ---
  duration_ms: 1130.8195
  type: 'test'
  ...
# Subtest: mixed and unavailable coverage keeps measured zero, labels subtotals, and excludes skipped usage
ok 2 - mixed and unavailable coverage keeps measured zero, labels subtotals, and excludes skipped usage
  ---
  duration_ms: 583.882166
  type: 'test'
  ...
# Subtest: 10x: missing pending and counter-only steps do not invent legacy token figures
ok 3 - 10x: missing pending and counter-only steps do not invent legacy token figures
  ---
  duration_ms: 556.191792
  type: 'test'
  ...
# Subtest: openspec: missing pending and counter-only steps do not invent legacy token figures
ok 4 - openspec: missing pending and counter-only steps do not invent legacy token figures
  ---
  duration_ms: 682.893333
  type: 'test'
  ...
# Subtest: no figures render as missing while an explicit verified zero renders as zero
ok 5 - no figures render as missing while an explicit verified zero renders as zero
  ---
  duration_ms: 827.4115
  type: 'test'
  ...
# Subtest: aggregate overflow is sticky for tokens and counters, with no selectively smaller group totals
ok 6 - aggregate overflow is sticky for tokens and counters, with no selectively smaller group totals
  ---
  duration_ms: 424.647542
  type: 'test'
  ...
# Subtest: model grouping retains prototype-shaped aliases as ordinary own keys
ok 7 - model grouping retains prototype-shaped aliases as ordinary own keys
  ---
  duration_ms: 139.248125
  type: 'test'
  ...
# Subtest: cost preserves ordinary legacy arithmetic and rejects unavailable token claims
ok 8 - cost preserves ordinary legacy arithmetic and rejects unavailable token claims
  ---
  duration_ms: 0.822917
  type: 'test'
  ...
# Subtest: cost overflow is unavailable throughout JSON and Markdown, while routing groups use the enclosing model
ok 9 - cost overflow is unavailable throughout JSON and Markdown, while routing groups use the enclosing model
  ---
  duration_ms: 328.093083
  type: 'test'
  ...
# Subtest: 10x/codex: measured producer output survives real intake and legacy continuation refuses scope verdicts
ok 10 - 10x/codex: measured producer output survives real intake and legacy continuation refuses scope verdicts
  ---
  duration_ms: 2037.693083
  type: 'test'
  ...
# Subtest: 10x/claude: measured producer output survives real intake and legacy continuation refuses scope verdicts
ok 11 - 10x/claude: measured producer output survives real intake and legacy continuation refuses scope verdicts
  ---
  duration_ms: 1868.937333
  type: 'test'
  ...
# Subtest: openspec/codex: measured producer output survives real intake and legacy continuation refuses scope verdicts
ok 12 - openspec/codex: measured producer output survives real intake and legacy continuation refuses scope verdicts
  ---
  duration_ms: 2191.449042
  type: 'test'
  ...
# Subtest: openspec/claude: measured producer output survives real intake and legacy continuation refuses scope verdicts
ok 13 - openspec/claude: measured producer output survives real intake and legacy continuation refuses scope verdicts
  ---
  duration_ms: 1440.645333
  type: 'test'
  ...
# Subtest: 10x: structured late evidence refreshes coverage and pricing without counting archive-only usage
ok 14 - 10x: structured late evidence refreshes coverage and pricing without counting archive-only usage
  ---
  duration_ms: 647.113042
  type: 'test'
  ...
# Subtest: openspec: structured late evidence refreshes coverage and pricing without counting archive-only usage
ok 15 - openspec: structured late evidence refreshes coverage and pricing without counting archive-only usage
  ---
  duration_ms: 666.332959
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
# duration_ms 13779.052208

## skills/10x-pipeline/test/archive.test.mjs — next halts when only the archive folder exists and writes nothing
Exit 0
TAP version 13
# Subtest: next halts when only the archive folder exists and writes nothing
ok 1 - next halts when only the archive folder exists and writes nothing
  ---
  duration_ms: 277.994541
  type: 'test'
  ...
# Subtest: init halts when only the archive folder exists and writes nothing
ok 2 - init halts when only the archive folder exists and writes nothing
  ---
  duration_ms: 275.825333
  type: 'test'
  ...
# Subtest: status --report halts with the archive path and writes nothing
ok 3 - status --report halts with the archive path and writes nothing
  ---
  duration_ms: 164.553375
  type: 'test'
  ...
# Subtest: plain status on an archived change still prints an empty log
ok 4 - plain status on an archived change still prints an empty log
  ---
  duration_ms: 159.537875
  type: 'test'
  ...
# Subtest: init halts on a half-archived folder and leaves the tree byte-identical
ok 5 - init halts on a half-archived folder and leaves the tree byte-identical
  ---
  duration_ms: 207.66975
  type: 'test'
  ...
# Subtest: next halts on a half-archived folder and leaves the tree byte-identical
ok 6 - next halts on a half-archived folder and leaves the tree byte-identical
  ---
  duration_ms: 93.841
  type: 'test'
  ...
# Subtest: status --report halts on a half-archived folder and leaves the tree byte-identical
ok 7 - status --report halts on a half-archived folder and leaves the tree byte-identical
  ---
  duration_ms: 157.57775
  type: 'test'
  ...
# Subtest: a quoted status in change.md counts as archived for the half-archived guard
ok 8 - a quoted status in change.md counts as archived for the half-archived guard
  ---
  duration_ms: 210.226875
  type: 'test'
  ...
# Subtest: a suffix-collision archive folder does not trigger the guard
ok 9 - a suffix-collision archive folder does not trigger the guard
  ---
  duration_ms: 169.765708
  type: 'test'
  ...
# Subtest: a live folder with a same-named archive is left to /10x-archive
ok 10 - a live folder with a same-named archive is left to /10x-archive
  ---
  duration_ms: 158.166958
  type: 'test'
  ...
# Subtest: verify-archive returns archived true with path, archivedAt and report
ok 11 - verify-archive returns archived true with path, archivedAt and report
  ---
  duration_ms: 81.397958
  type: 'test'
  ...
# Subtest: verify-archive reports null report and null archivedAt when absent
ok 12 - verify-archive reports null report and null archivedAt when absent
  ---
  duration_ms: 267.889125
  type: 'test'
  ...
# Subtest: verify-archive maps a literal archived_at: null to JSON null
ok 13 - verify-archive maps a literal archived_at: null to JSON null
  ---
  duration_ms: 88.234709
  type: 'test'
  ...
# Subtest: verify-archive keeps a real archived_at as a string
ok 14 - verify-archive keeps a real archived_at as a string
  ---
  duration_ms: 111.548791
  type: 'test'
  ...
# Subtest: verify-archive strips quotes from status
ok 15 - verify-archive strips quotes from status
  ---
  duration_ms: 117.562125
  type: 'test'
  ...
# Subtest: verify-archive: no archive folder
ok 16 - verify-archive: no archive folder
  ---
  duration_ms: 142.775083
  type: 'test'
  ...
# Subtest: verify-archive: a suffix-collision folder alone is not an archive of the id
ok 17 - verify-archive: a suffix-collision folder alone is not an archive of the id
  ---
  duration_ms: 172.671
  type: 'test'
  ...
# Subtest: verify-archive: status other than archived
ok 18 - verify-archive: status other than archived
  ---
  duration_ms: 298.436667
  type: 'test'
  ...
# Subtest: verify-archive: archive folder without change.md
ok 19 - verify-archive: archive folder without change.md
  ---
  duration_ms: 152.528833
  type: 'test'
  ...
# Subtest: verify-archive: change folder still present next to a stamped archive (partial failure)
ok 20 - verify-archive: change folder still present next to a stamped archive (partial failure)
  ---
  duration_ms: 137.037125
  type: 'test'
  ...
# Subtest: verify-archive: stamped folder that was not moved has its own reason
ok 21 - verify-archive: stamped folder that was not moved has its own reason
  ---
  duration_ms: 103.010375
  type: 'test'
  ...
# Subtest: verify-archive: two archive folders (reused id) are listed and need --path
ok 22 - verify-archive: two archive folders (reused id) are listed and need --path
  ---
  duration_ms: 110.840625
  type: 'test'
  ...
# Subtest: verify-archive --path picks one of two folders
ok 23 - verify-archive --path picks one of two folders
  ---
  duration_ms: 366.5865
  type: 'test'
  ...
# Subtest: verify-archive --path accepts a trailing slash and a leading ./
ok 24 - verify-archive --path accepts a trailing slash and a leading ./
  ---
  duration_ms: 278.992
  type: 'test'
  ...
# Subtest: verify-archive --path with no value says it needs a folder
ok 25 - verify-archive --path with no value says it needs a folder
  ---
  duration_ms: 91.720875
  type: 'test'
  ...
# Subtest: verify-archive --path refuses anything but an archive folder of the id
ok 26 - verify-archive --path refuses anything but an archive folder of the id
  ---
  duration_ms: 1180.988833
  type: 'test'
  ...
# Subtest: verify-archive leaves the tree byte-identical
ok 27 - verify-archive leaves the tree byte-identical
  ---
  duration_ms: 422.902792
  type: 'test'
  ...
# Subtest: verify-archive answers when PATH holds no git
ok 28 - verify-archive answers when PATH holds no git
  ---
  duration_ms: 257.796125
  type: 'test'
  ...
# Subtest: init --archive stores archive: true
ok 29 - init --archive stores archive: true
  ---
  duration_ms: 660.2395
  type: 'test'
  ...
# Subtest: init --archive true is the same as the bare flag
ok 30 - init --archive true is the same as the bare flag
  ---
  duration_ms: 617.530625
  type: 'test'
  ...
# Subtest: a resume without the flag keeps archive: true
ok 31 - a resume without the flag keeps archive: true
  ---
  duration_ms: 1404.474125
  type: 'test'
  ...
# Subtest: --archive false stores false and a later bare resume keeps false
ok 32 - --archive false stores false and a later bare resume keeps false
  ---
  duration_ms: 545.497125
  type: 'test'
  ...
# Subtest: --archive false turns a stored true off
ok 33 - --archive false turns a stored true off
  ---
  duration_ms: 908.977125
  type: 'test'
  ...
# Subtest: --archive with an invalid value halts and writes nothing
ok 34 - --archive with an invalid value halts and writes nothing
  ---
  duration_ms: 271.232917
  type: 'test'
  ...
# Subtest: --archive in a directory that is not a repository halts and writes nothing
ok 35 - --archive in a directory that is not a repository halts and writes nothing
  ---
  duration_ms: 242.546333
  type: 'test'
  ...
# Subtest: a stored archive: true is checked again on a resume
ok 36 - a stored archive: true is checked again on a resume
  ---
  duration_ms: 1026.326083
  type: 'test'
  ...
# Subtest: --archive halts when .gitignore hides agent-smith/ that does not exist yet
ok 37 - --archive halts when .gitignore hides agent-smith/ that does not exist yet
  ---
  duration_ms: 540.481209
  type: 'test'
  ...
# Subtest: --archive halts when .gitignore has *.jsonl and names run.jsonl
ok 38 - --archive halts when .gitignore has *.jsonl and names run.jsonl
  ---
  duration_ms: 622.096458
  type: 'test'
  ...
# Subtest: --archive halts when .gitignore hides context/ and names change.md
ok 39 - --archive halts when .gitignore hides context/ and names change.md
  ---
  duration_ms: 522.301292
  type: 'test'
  ...
# Subtest: --archive passes when .gitignore ignores none of the four files
ok 40 - --archive passes when .gitignore ignores none of the four files
  ---
  duration_ms: 783.097208
  type: 'test'
  ...
# Subtest: --archive works when the project root is below the repository root
ok 41 - --archive works when the project root is below the repository root
  ---
  duration_ms: 1232.570875
  type: 'test'
  ...
# Subtest: init without --archive in a non-repository directory works and meta.json has no archive key
ok 42 - init without --archive in a non-repository directory works and meta.json has no archive key
  ---
  duration_ms: 250.342542
  type: 'test'
  ...
# Subtest: init --archive writes nothing when the change is archived
ok 43 - init --archive writes nothing when the change is archived
  ---
  duration_ms: 113.448375
  type: 'test'
  ...
# Subtest: steps.archive is pinned to one ladder entry with effort high or above
ok 44 - steps.archive is pinned to one ladder entry with effort high or above
  ---
  duration_ms: 0.137125
  type: 'test'
  ...
# Subtest: policy.archive holds the commit message template and the manual-pending gate
ok 45 - policy.archive holds the commit message template and the manual-pending gate
  ---
  duration_ms: 0.076667
  type: 'test'
  ...
# Subtest: prompts.archive gives the archive answers as eight one-line rules
ok 46 - prompts.archive gives the archive answers as eight one-line rules
  ---
  duration_ms: 0.747667
  type: 'test'
  ...
# Subtest: done with --archive commits the change folder and returns the archive action
ok 47 - done with --archive commits the change folder and returns the archive action
  ---
  duration_ms: 2007.49025
  type: 'test'
  ...
# Subtest: array archive and suffix overrides render joined, @prompts parts resolved
ok 48 - array archive and suffix overrides render joined, @prompts parts resolved
  ---
  duration_ms: 2132.925709
  type: 'test'
  ...
# Subtest: a string archive or suffix override that starts with @prompts/ or @<skill>/prompts/ is a file reference
ok 49 - a string archive or suffix override that starts with @prompts/ or @<skill>/prompts/ is a file reference
  ---
  duration_ms: 1711.380833
  type: 'test'
  ...
# Subtest: a string archive or suffix reference that does not resolve halts before the pre-archive commit
ok 50 - a string archive or suffix reference that does not resolve halts before the pre-archive commit
  ---
  duration_ms: 785.185208
  type: 'test'
  ...
# Subtest: a second next returns archive again with no new commit
ok 51 - a second next returns archive again with no new commit
  ---
  duration_ms: 3402.55825
  type: 'test'
  ...
# Subtest: a run without --archive ends done and makes no commit
ok 52 - a run without --archive ends done and makes no commit
  ---
  duration_ms: 679.099333
  type: 'test'
  ...
# Subtest: a run with archive: false ends done and makes no commit
ok 53 - a run with archive: false ends done and makes no commit
  ---
  duration_ms: 462.661625
  type: 'test'
  ...
# Subtest: kind A: a staged file halts before the commit and the run is written as halted
ok 54 - kind A: a staged file halts before the commit and the run is written as halted
  ---
  duration_ms: 1353.891708
  type: 'test'
  ...
# Subtest: a detached HEAD halts before the commit
ok 55 - a detached HEAD halts before the commit
  ---
  duration_ms: 1055.83325
  type: 'test'
  ...
# Subtest: a merge in progress halts before the commit
ok 56 - a merge in progress halts before the commit
  ---
  duration_ms: 1014.641916
  type: 'test'
  ...
# Subtest: kind C: a failing pre-commit hook halts with its output, nothing staged, outcome stays done
ok 57 - kind C: a failing pre-commit hook halts with its output, nothing staged, outcome stays done
  ---
  duration_ms: 1784.328375
  type: 'test'
  ...
# Subtest: kind C: the halt leaves report.md as it was when the hook ran
ok 58 - kind C: the halt leaves report.md as it was when the hook ran
  ---
  duration_ms: 1718.690417
  type: 'test'
  ...
# Subtest: a git commit that times out halts as kind C and names the timeout
ok 59 - a git commit that times out halts as kind C and names the timeout
  ---
  duration_ms: 1753.419667
  type: 'test'
  ...
# Subtest: a commit whose hash cannot be read: the archive action keeps the label HEAD, and a late usage figure is kept
ok 60 - a commit whose hash cannot be read: the archive action keeps the label HEAD, and a late usage figure is kept
  ---
  duration_ms: 2804.861916
  type: 'test'
  ...
# Subtest: a git that times out is reported as a timeout, not as a missing work tree, at init and at done
ok 61 - a git that times out is reported as a timeout, not as a missing work tree, at init and at done
  ---
  duration_ms: 11498.49475
  type: 'test'
  ...
# Subtest: a missing git is reported as such, not as a missing work tree, at init and at done
ok 62 - a missing git is reported as such, not as a missing work tree, at init and at done
  ---
  duration_ms: 766.685959
  type: 'test'
  ...
# Subtest: status --report on a running archive run says the archive did not run
ok 63 - status --report on a running archive run says the archive did not run
  ---
  duration_ms: 248.479125
  type: 'test'
  ...
# Subtest: kind C: a report.md that cannot be written halts before git add; nothing staged, no commit
ok 64 - kind C: a report.md that cannot be written halts before git add; nothing staged, no commit
  ---
  duration_ms: 1417.322333
  type: 'test'
  ...
# Subtest: kind D: a post-commit hook that dirties the folder halts, names the path, writes nothing, and a repeat passes
ok 65 - kind D: a post-commit hook that dirties the folder halts, names the path, writes nothing, and a repeat passes
  ---
  duration_ms: 3633.891708
  type: 'test'
  ...
# Subtest: kind D: a clean resume passes with commit null and makes no second commit
ok 66 - kind D: a clean resume passes with commit null and makes no second commit
  ---
  duration_ms: 3125.351667
  type: 'test'
  ...
# Subtest: kind D: a pre-commit hook that stages another file halts after the commit and names it
ok 67 - kind D: a pre-commit hook that stages another file halts after the commit and names it
  ---
  duration_ms: 1754.438833
  type: 'test'
  ...
# Subtest: kind D: a commit that holds an extra path is caught even when the index ends clean
ok 68 - kind D: a commit that holds an extra path is caught even when the index ends clean
  ---
  duration_ms: 1919.620792
  type: 'test'
  ...
# Subtest: kind B: after an archive, a staged file halts the next call with JSON only
ok 69 - kind B: after an archive, a staged file halts the next call with JSON only
  ---
  duration_ms: 2619.374375
  type: 'test'
  ...
# Subtest: an ordinary halt of an archive run carries archive and committed
ok 70 - an ordinary halt of an archive run carries archive and committed
  ---
  duration_ms: 2083.747708
  type: 'test'
  ...
# Subtest: a halt of a run without --archive carries no archive field
ok 71 - a halt of a run without --archive carries no archive field
  ---
  duration_ms: 415.03375
  type: 'test'
  ...
# Subtest: change.md with no created line halts before the commit as kind A
ok 72 - change.md with no created line halts before the commit as kind A
  ---
  duration_ms: 1269.222875
  type: 'test'
  ...
# Subtest: change.md with a quoted created halts before the commit as kind A
ok 73 - change.md with a quoted created halts before the commit as kind A
  ---
  duration_ms: 1064.129042
  type: 'test'
  ...
# Subtest: change.md with created without a space halts before the commit as kind A
ok 74 - change.md with created without a space halts before the commit as kind A
  ---
  duration_ms: 1223.463417
  type: 'test'
  ...
# Subtest: change.md with a created with a time halts before the commit as kind A
ok 75 - change.md with a created with a time halts before the commit as kind A
  ---
  duration_ms: 1053.943542
  type: 'test'
  ...
# Subtest: an existing archive destination halts before the commit
ok 76 - an existing archive destination halts before the commit
  ---
  duration_ms: 1212.390458
  type: 'test'
  ...
# Subtest: a .gitignore entry added after init halts at done before any commit
ok 77 - a .gitignore entry added after init halts at done before any commit
  ---
  duration_ms: 1628.042208
  type: 'test'
  ...
# Subtest: pending Manual rows are listed in the report; none means no such line
ok 78 - pending Manual rows are listed in the report; none means no such line
  ---
  duration_ms: 3219.223708
  type: 'test'
  ...
# Subtest: haltOnManualPending true halts before the commit; the default continues
ok 79 - haltOnManualPending true halts before the commit; the default continues
  ---
  duration_ms: 2816.765208
  type: 'test'
  ...
# Subtest: a blank commit message halts as kind A and never stages the folder
ok 80 - a blank commit message halts as kind A and never stages the folder
  ---
  duration_ms: 1363.352958
  type: 'test'
  ...
# Subtest: a custom ladder too short for the step tiers halts at load before git add
ok 81 - a custom ladder too short for the step tiers halts at load before git add
  ---
  duration_ms: 401.533584
  type: 'test'
  ...
# Subtest: the commit message comes from policy.archive.commitMessage
ok 82 - the commit message comes from policy.archive.commitMessage
  ---
  duration_ms: 1717.372917
  type: 'test'
  ...
# Subtest: a stray file that git does not ignore is part of the commit
ok 83 - a stray file that git does not ignore is part of the commit
  ---
  duration_ms: 1944.443667
  type: 'test'
  ...
# Subtest: ignored files outside the probes are reported, not committed, and do not halt
ok 84 - ignored files outside the probes are reported, not committed, and do not halt
  ---
  duration_ms: 1618.042917
  type: 'test'
  ...
# Subtest: non-ASCII file names in the folder pass the checks and are committed
ok 85 - non-ASCII file names in the folder pass the checks and are committed
  ---
  duration_ms: 1752.436291
  type: 'test'
  ...
# Subtest: nested root: the commit holds paths below the project prefix and a hook's extra file is named
ok 86 - nested root: the commit holds paths below the project prefix and a hook's extra file is named
  ---
  duration_ms: 3326.485625
  type: 'test'
  ...
# Subtest: nested root named with non-ASCII and a space: spaces in names stay unquoted
ok 87 - nested root named with non-ASCII and a space: spaces in names stay unquoted
  ---
  duration_ms: 3330.519958
  type: 'test'
  ...
# Subtest: verify-archive confirms a simulated move after the commit
ok 88 - verify-archive confirms a simulated move after the commit
  ---
  duration_ms: 1611.578542
  type: 'test'
  ...
# Subtest: git subcommands: init --archive and the full path run only allowed commands on the change folder
ok 89 - git subcommands: init --archive and the full path run only allowed commands on the change folder
  ---
  duration_ms: 2416.202833
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (10x, prior false, archive false)
ok 90 - duplicate archived init preserves all state (10x, prior false, archive false)
  ---
  duration_ms: 225.769125
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (10x, prior false, archive true)
ok 91 - duplicate archived init preserves all state (10x, prior false, archive true)
  ---
  duration_ms: 284.31075
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (10x, prior true, archive false)
ok 92 - duplicate archived init preserves all state (10x, prior true, archive false)
  ---
  duration_ms: 431.059333
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (10x, prior true, archive true)
ok 93 - duplicate archived init preserves all state (10x, prior true, archive true)
  ---
  duration_ms: 488.383708
  type: 'test'
  ...
# Subtest: init ignores suffix collisions and archives owned only by OpenSpec
ok 94 - init ignores suffix collisions and archives owned only by OpenSpec
  ---
  duration_ms: 388.204792
  type: 'test'
  ...
1..94
# tests 94
# suites 0
# pass 94
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 104181.575917

## skills/10x-pipeline/test/archive-gate.test.mjs — 10x: allowed-tools lists AskUserQuestion
Exit 0
TAP version 13
# Subtest: 10x: allowed-tools lists AskUserQuestion
ok 1 - 10x: allowed-tools lists AskUserQuestion
  ---
  duration_ms: 0.74675
  type: 'test'
  ...
# Subtest: 10x: the archive branch asks before it launches the subagent
ok 2 - 10x: the archive branch asks before it launches the subagent
  ---
  duration_ms: 0.242292
  type: 'test'
  ...
# Subtest: 10x: labels, fail-closed reading and STOP
ok 3 - 10x: labels, fail-closed reading and STOP
  ---
  duration_ms: 0.154292
  type: 'test'
  ...
# Subtest: 10x: step numbers stay and the other branches do not ask
ok 4 - 10x: step numbers stay and the other branches do not ask
  ---
  duration_ms: 0.511708
  type: 'test'
  ...
# Subtest: 10x: no task tool; terminal publication reaches the single authorization owner
ok 5 - 10x: no task tool; terminal publication reaches the single authorization owner
  ---
  duration_ms: 1.297042
  type: 'test'
  ...
# Subtest: 10x: archive publication covers verification success, failure and gate refusal
ok 6 - 10x: archive publication covers verification success, failure and gate refusal
  ---
  duration_ms: 0.267625
  type: 'test'
  ...
# Subtest: 10x: still exactly six GIVEN lines
ok 7 - 10x: still exactly six GIVEN lines
  ---
  duration_ms: 0.131875
  type: 'test'
  ...
# Subtest: openspec: allowed-tools lists AskUserQuestion
ok 8 - openspec: allowed-tools lists AskUserQuestion
  ---
  duration_ms: 0.115084
  type: 'test'
  ...
# Subtest: openspec: the archive branch asks before it launches the subagent
ok 9 - openspec: the archive branch asks before it launches the subagent
  ---
  duration_ms: 0.112042
  type: 'test'
  ...
# Subtest: openspec: labels, fail-closed reading and STOP
ok 10 - openspec: labels, fail-closed reading and STOP
  ---
  duration_ms: 0.158458
  type: 'test'
  ...
# Subtest: openspec: step numbers stay and the other branches do not ask
ok 11 - openspec: step numbers stay and the other branches do not ask
  ---
  duration_ms: 0.352125
  type: 'test'
  ...
# Subtest: openspec: no task tool; terminal publication reaches the single authorization owner
ok 12 - openspec: no task tool; terminal publication reaches the single authorization owner
  ---
  duration_ms: 0.347333
  type: 'test'
  ...
# Subtest: openspec: archive publication covers verification success, failure and gate refusal
ok 13 - openspec: archive publication covers verification success, failure and gate refusal
  ---
  duration_ms: 0.137334
  type: 'test'
  ...
# Subtest: openspec: still exactly six GIVEN lines
ok 14 - openspec: still exactly six GIVEN lines
  ---
  duration_ms: 0.08175
  type: 'test'
  ...
# Subtest: the router scripts never mention AskUserQuestion
ok 15 - the router scripts never mention AskUserQuestion
  ---
  duration_ms: 3.956625
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
# duration_ms 152.089709

## skills/openspec-pipeline/test/openspec-skill.test.mjs — frontmatter names the skill openspec-pipeline with its argument hint
Exit 0
TAP version 13
# Subtest: frontmatter names the skill openspec-pipeline with its argument hint
ok 1 - frontmatter names the skill openspec-pipeline with its argument hint
  ---
  duration_ms: 18.874333
  type: 'test'
  ...
# Subtest: frontmatter requires explicit invocation and preserves user invocation
ok 2 - frontmatter requires explicit invocation and preserves user invocation
  ---
  duration_ms: 0.25775
  type: 'test'
  ...
# Subtest: the router is the shared 10x-pipeline route.mjs, and it exists next to the skill folder
ok 3 - the router is the shared 10x-pipeline route.mjs, and it exists next to the skill folder
  ---
  duration_ms: 0.809167
  type: 'test'
  ...
# Subtest: the old base-directory placeholder is gone and Tuning names policy.json through ${CLAUDE_SKILL_DIR}
ok 4 - the old base-directory placeholder is gone and Tuning names policy.json through ${CLAUDE_SKILL_DIR}
  ---
  duration_ms: 0.140083
  type: 'test'
  ...
# Subtest: every router command line carries --chain openspec
ok 5 - every router command line carries --chain openspec
  ---
  duration_ms: 0.314583
  type: 'test'
  ...
# Subtest: the anti-stall section equals the one of the 10x skill and follows the rule form
ok 6 - the anti-stall section equals the one of the 10x skill and follows the rule form
  ---
  duration_ms: 0.429666
  type: 'test'
  ...
# Subtest: the anti-stall section lies between \#\# Loop and \#\# PR comment (opt-in), and the steps it names exist
ok 7 - the anti-stall section lies between \#\# Loop and \#\# PR comment (opt-in), and the steps it names exist
  ---
  duration_ms: 0.315583
  type: 'test'
  ...
# Subtest: the skill names no model alias, effort level or tier word
ok 8 - the skill names no model alias, effort level or tier word
  ---
  duration_ms: 0.552
  type: 'test'
  ...
# Subtest: every os- step has a template, and every os- template resolves to existing prompt files
ok 9 - every os- step has a template, and every os- template resolves to existing prompt files
  ---
  duration_ms: 0.358541
  type: 'test'
  ...
# Subtest: the OpenSpec policy fragment holds only os- steps and prompts, and shares no key with the 10x policy
ok 10 - the OpenSpec policy fragment holds only os- steps and prompts, and shares no key with the 10x policy
  ---
  duration_ms: 0.778375
  type: 'test'
  ...
# Subtest: every prompt of the plugin policy resolves, the @<skill>/prompts/ references included
ok 11 - every prompt of the plugin policy resolves, the @<skill>/prompts/ references included
  ---
  duration_ms: 43.396375
  type: 'test'
  ...
# Subtest: the resolver accepts @<skill>/prompts/<file>.md and rejects paths that leave the skills folder
ok 12 - the resolver accepts @<skill>/prompts/<file>.md and rejects paths that leave the skills folder
  ---
  duration_ms: 0.68325
  type: 'test'
  ...
# Subtest: the OPEN_PR line points at the shared open-pr script, which exists
ok 13 - the OPEN_PR line points at the shared open-pr script, which exists
  ---
  duration_ms: 0.124292
  type: 'test'
  ...
# Subtest: the pull request section follows \#\# PR comment (opt-in) and calls the script with --chain openspec
ok 14 - the pull request section follows \#\# PR comment (opt-in) and calls the script with --chain openspec
  ---
  duration_ms: 0.1925
  type: 'test'
  ...
# Subtest: terminal branches reach publication and archive verifies before publishing
ok 15 - terminal branches reach publication and archive verifies before publishing
  ---
  duration_ms: 0.136458
  type: 'test'
  ...
# Subtest: one chain-selected usage procedure is called before status and publication on every terminal path
ok 16 - one chain-selected usage procedure is called before status and publication on every terminal path
  ---
  duration_ms: 0.130541
  type: 'test'
  ...
# Subtest: the argument hint and Start step 1 name --rigor with its value and the goal text
ok 17 - the argument hint and Start step 1 name --rigor with its value and the goal text
  ---
  duration_ms: 0.075917
  type: 'test'
  ...
# Subtest: OpenSpec setup requires the custom verify workflow and tracked shared-skill discovery
ok 18 - OpenSpec setup requires the custom verify workflow and tracked shared-skill discovery
  ---
  duration_ms: 0.103708
  type: 'test'
  ...
# Subtest: the Bash timeout line names the three scripts and `timeout: 600000`, outside the anti-stall section, equal to the 10x copy
ok 19 - the Bash timeout line names the three scripts and `timeout: 600000`, outside the anti-stall section, equal to the 10x copy
  ---
  duration_ms: 0.106625
  type: 'test'
  ...
# Subtest: archive reuses dispatch with its archive description override
ok 20 - archive reuses dispatch with its archive description override
  ---
  duration_ms: 0.074875
  type: 'test'
  ...
# Subtest: native accounting shares the immediate, late and archive reader without final-request mapping
ok 21 - native accounting shares the immediate, late and archive reader without final-request mapping
  ---
  duration_ms: 0.165667
  type: 'test'
  ...
# Subtest: Start step 3 consumes shared OpenSpec setup and retains run safety
ok 22 - Start step 3 consumes shared OpenSpec setup and retains run safety
  ---
  duration_ms: 0.236042
  type: 'test'
  ...
1..22
# tests 22
# suites 0
# pass 22
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 213.180375

## skills/openspec-pipeline/test/openspec-archive.test.mjs — the archive prompt quotes error code/message and an optional diagnostic fix
Exit 0
TAP version 13
# Subtest: the archive prompt quotes error code/message and an optional diagnostic fix
ok 1 - the archive prompt quotes error code/message and an optional diagnostic fix
  ---
  duration_ms: 0.933
  type: 'test'
  ...
# Subtest: PASS with --archive commits only openspec/changes/<id>/ and returns the os-archive action
ok 2 - PASS with --archive commits only openspec/changes/<id>/ and returns the os-archive action
  ---
  duration_ms: 3238.388792
  type: 'test'
  ...
# Subtest: an open task row never reaches the archive: it routes to os-apply and makes no commit
ok 3 - an open task row never reaches the archive: it routes to os-apply and makes no commit
  ---
  duration_ms: 371.16
  type: 'test'
  ...
# Subtest: an existing archive target halts before the commit with committed false
ok 4 - an existing archive target halts before the commit with committed false
  ---
  duration_ms: 1390.527208
  type: 'test'
  ...
# Subtest: without --archive the run ends done with no commit
ok 5 - without --archive the run ends done with no commit
  ---
  duration_ms: 393.654208
  type: 'test'
  ...
# Subtest: a date-prefixed id keeps its name as the archive folder
ok 6 - a date-prefixed id keeps its name as the archive folder
  ---
  duration_ms: 2048.225291
  type: 'test'
  ...
# Subtest: init --chain openspec --archive halts when git ignores tasks.md
ok 7 - init --chain openspec --archive halts when git ignores tasks.md
  ---
  duration_ms: 774.9565
  type: 'test'
  ...
# Subtest: the archive action, a simulated move, verify-archive and next after the move
ok 8 - the archive action, a simulated move, verify-archive and next after the move
  ---
  duration_ms: 1936.837875
  type: 'test'
  ...
# Subtest: verify-archive: archived true with the folder and the report
ok 9 - verify-archive: archived true with the folder and the report
  ---
  duration_ms: 264.01175
  type: 'test'
  ...
# Subtest: verify-archive: false while the live folder exists, with or without an archive folder
ok 10 - verify-archive: false while the live folder exists, with or without an archive folder
  ---
  duration_ms: 298.141208
  type: 'test'
  ...
# Subtest: verify-archive: no folder at all is false
ok 11 - verify-archive: no folder at all is false
  ---
  duration_ms: 110.920834
  type: 'test'
  ...
# Subtest: verify-archive --path picks one folder, and a --path that misses lists the folders found
ok 12 - verify-archive --path picks one folder, and a --path that misses lists the folders found
  ---
  duration_ms: 660.879625
  type: 'test'
  ...
# Subtest: verify-archive: two folders without --path are ambiguous
ok 13 - verify-archive: two folders without --path are ambiguous
  ---
  duration_ms: 135.509833
  type: 'test'
  ...
# Subtest: status --chain openspec adds the OpenSpec state the router reads
ok 14 - status --chain openspec adds the OpenSpec state the router reads
  ---
  duration_ms: 290.476958
  type: 'test'
  ...
# Subtest: risk --chain openspec reports no plan paths and no plan hits
ok 15 - risk --chain openspec reports no plan paths and no plan hits
  ---
  duration_ms: 286.3625
  type: 'test'
  ...
# Subtest: compare --chain openspec reads a live and an archived side
ok 16 - compare --chain openspec reads a live and an archived side
  ---
  duration_ms: 196.690417
  type: 'test'
  ...
# Subtest: compare --chain openspec does not read a 10x side
ok 17 - compare --chain openspec does not read a 10x side
  ---
  duration_ms: 115.903666
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, demo, prior false, archive false)
ok 18 - duplicate archived init preserves all state (openspec, demo, prior false, archive false)
  ---
  duration_ms: 255.865125
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, demo, prior false, archive true)
ok 19 - duplicate archived init preserves all state (openspec, demo, prior false, archive true)
  ---
  duration_ms: 328.311417
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, demo, prior true, archive false)
ok 20 - duplicate archived init preserves all state (openspec, demo, prior true, archive false)
  ---
  duration_ms: 876.948416
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, demo, prior true, archive true)
ok 21 - duplicate archived init preserves all state (openspec, demo, prior true, archive true)
  ---
  duration_ms: 927.677292
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior false, archive false)
ok 22 - duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior false, archive false)
  ---
  duration_ms: 289.40775
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior false, archive true)
ok 23 - duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior false, archive true)
  ---
  duration_ms: 485.654583
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior true, archive false)
ok 24 - duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior true, archive false)
  ---
  duration_ms: 665.496875
  type: 'test'
  ...
# Subtest: duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior true, archive true)
ok 25 - duplicate archived init preserves all state (openspec, 2026-01-02-dated, prior true, archive true)
  ---
  duration_ms: 580.823792
  type: 'test'
  ...
# Subtest: OpenSpec init ignores suffix collisions and archives owned only by 10x
ok 26 - OpenSpec init ignores suffix collisions and archives owned only by 10x
  ---
  duration_ms: 536.975333
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
# duration_ms 18229.037416
