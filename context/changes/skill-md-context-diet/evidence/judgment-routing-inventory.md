# Independent routing inventory for Manual row 1.4

Reviewed original commit `6b697d86d3a0ff95a0e13eceb771359f9cae85c1` against the current skills and reference. Original and current texts are saved verbatim in `command-original-10x.md`, `command-original-openspec.md`, `command-current-10x.md`, `command-current-openspec.md` and `command-current-reference.md`. Original snapshots were obtained with read-only `git show`, current snapshots with `cat`, from the run worktree. Section names below identify destinations in docs/REFERENCE.md. Quoted subjects identify every original How the tier moves bullet in source order.

| Original bullet subject | Reference destination and reviewed preservation |
| --- | --- |
| “Rigor level” | Rigor retains stored/resumed level, goal or flag initialization, monotone phase/failure/churn/result increases, and configurable `rigor.fromPhases` and `rigor.fromFailures`. |
| “Hot paths” | Rigor retains history at `meta.baseSha`, lowest-rigor exclusion, risk command and unmeasured missing/short/unreadable history. |
| “The lowest level skips plan review” | Rigor explicitly requires measured risk, named measurable paths and no hot path before implementation. Logged skips consume no budget, implementation review continues. |
| “The step budget” | Rigor and Budget retain base plus delta, 12/19/24 budgets, longest 10/17/22 paths, room for failure/retry, exempt score/cheap failures and the separate extra-step pool. Manual verification and its retry remain budgeted outside that pool. |
| “Effort floor” | How routing works retains final floor, discount absorption, simple marker and eligible-rung failure escalation. It explicitly says “The floor beats the simple-change discount”. |
| “The lowest level also moves implementation review” | Rigor retains `rigor.tierOffset`, one tier down with the floor. |
| “The archive step is not moved” | How routing works says “the policy pins its tier”. |
| “Pre-plan steps” | Pre-plan steps retains research → domain-brief → frame order, default thorough gates, signal predicates, silent rigor-closed gates, logged artifact/signal skips, first-plan cutoff and pinned frame. |
| “Verification by artifact” | Pre-plan steps retains changed-after-start checks, research status frontmatter, frame Reframed heading and brief refactor-plan type. Failure follows attempt escalation. |
| “Loops” | Loops retains current-rigor gating, one frame after RETHINK and halt after the next, research before the second REVISE re-plan, and Decision-bearing REVISE reaching this only with onOpen retry. Lower levels retain ordinary re-plans. |
| “Score step” | Complexity score retains standard default, after pre-plan/before first plan, six factors, pinned base, shape/mtime validation, existing valid artifact skip, three failures/two invalid caps, neutral failed cost/rigor/discount and dropped rigor signals. Null minRigor disables it. |
| “Score shift” | Complexity score retains cognitive first-plan up-only and execution up/down, confidence/unknown/churn/failure/discount/size guards, log-owned values, pre-clamp/floor application and absorbed-shift reports. Rigor stays unchanged. |
| “The description and the Start section stay valid” | This dispatch obligation stays local. Both current skills say “Execute router actions” and run step 2 forwards “the router's `prompt`, copied verbatim.” No special orchestrator-side selection was introduced for pre-plan or score steps. |
| “Phase executors” | Phase executors retains implement step with alternate templates, valid e2e setup plus browser wording, thorough pure-logic tdd and segmented phases before special executors. |
| “Extra-step pool” | Phase executors and Budget retain one per-rigor pool, charging regardless of outcome, no manual-verify charge, and reservation for segment plus following executor. Insufficient funds selects whole-plan implement. |
| “Commit check” | Phase executors retains per-step tick-plus-code-commit verification, count fallback without usable Git/head, and review warning when retry evidence is unavailable. Plain/segment implement remains count-based. |
| “Retry” | Phase executors retains one implement-retry for strict rows ticked without commit, then progression with named-row warning. |
| “Fallback” | Phase executors retains blocked tdd/e2e as neutral fallback, no failure/tier/rigor increase and no reselection for that phase. |
| “Code re-plans” | Phase executors retains standard-or-higher, once per run, two consecutive implementation failures, first REJECTED before fix, pool cost for rejected re-plan and failed plan-replan halt. |
| “manual-verify” | Manual verification retains pending Automated/Manual predicates, pre-first-review placement, clean context, command/test/script/browser/judgment proof, evidence validation, reasons, neutral capped retry bump, no post-review rerun and final pending/unproven fields. Null minRigor disables it. |
| “--chrome” | Manual verification retains default on, stored explicit false selecting nochrome, explicit true, resume and old-state defaults, alternative proof or pending reason on unavailable tools, and no orchestrator probing. |
| “Lesson candidates” | Lesson candidates retains per-review maxCandidates/maxChars caps, report entries and ready lesson commands. Current skill Rules retain human ownership of lesson capture. |
| “Plan size” | How routing works retains one tier per reached `complexity.phaseThresholds` entry and Progress phase count. |
| “First plan, from the goal text” | How routing works retains maxWords default 25, short/no-hard-keyword reduction of two plus simple discount, hard keyword preventing reduction and all other goals reducing two. Policy owns word limit/list. |
| “A simple change” | How routing works retains one phase/six rows, minus one on the three named steps, minTier absorption, failure withholding and a two-tier first retry increase. |
| “Plan review RETHINK” | How routing works and Review routing on open findings retain +2 RETHINK, +1 REVISE, Decision-aware closed/observation exclusions, warning tolerance, default halt with finding ids and retry option. Header-only and disabled-aware fallback remain explicit. |
| “A noisy plan review” | How routing works retains three-or-more warnings increasing implement one tier and clean SOUND lowering one. |
| “Each failed or unverified attempt” | Routing and Limits retain per-failure increase and maxAttemptsPerStep cap. Artifact failure is explicitly described alongside result status failure. |
| “First attempt” | How routing works retains isolated-run requirement, listed templates, minus one, failed/simple exclusions, score/clamp/floor absorption, report marking, neutral rigor/budget failure, retry/attempt/re-plan accounting and no stacking with score downshift. |
| “Impl review after retries or fixes” | How routing works explicitly retains one-tier reviewer increase. |
| “Impl review REJECTED” | How routing works and Phase executors retain first rejection before fixes, one plan-tier-plus-one re-plan when rigor/pool permit, otherwise last-code-tier-plus-one fix, including later rejections. |
| “Impl review NEEDS ATTENTION” | Review routing on open findings retains Decision-aware tolerance, done when closed/tolerated, halt/retry when open and legacy critical/fixOnNeedsAttention routing at last code tier. |
| “Confirmation round” | Review routing on open findings retains default zero, applied critical/warning fixes plus no open findings, same-kind confirmation, per-kind cap including failures, pre-implementation plan confirmations, exclusions for RETHINK/REJECTED/unaware reviews and plus-two budget per round. |
| “A step counts as failed” | How routing works explicitly retains non-done or unchanged expected artifact, Progress plan shape, review verdict, new Automated ticks and tdd/e2e code commit. Neutral orchestration errors retain their exception. |

The three introductory Tuning bullets retain their local owners. Current 10x says “Arrays such as `ladder` are replaced whole” and that immutable rules are read “by fixed path, and no override reaches them.” Both skills retain policy, project override and reference pointers. AGENTS.md now assigns literal routing documentation to the reference.

Judgment for 1.4 is proved. All removed routing bullets have a destination with thresholds, exceptions and sequencing preserved. The generic dispatch bullet remains an executable local obligation. Review compared documentation claims to documentation, which is the requested inventory criterion.

Covering content tests were run now with `node --test --test-reporter=tap --test-concurrency=2 skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs`. `test-manual-contracts.log` records all 86 passing, zero failures and zero skips, including literal-routing-value, Tuning-path and AGENTS ownership checks. Semantic threshold correspondence is established by the inventory above.
