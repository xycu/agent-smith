# Changelog

## [1.6.0](https://github.com/xycu/agent-smith/compare/v1.5.0...v1.6.0) (2026-11-12)


### Features

* **step-commit-code-under-chore:** implement-class prompts commit their code under a typed subject (p3) ([e3ec8b1](https://github.com/xycu/agent-smith/commit/e3ec8b141cb14b3ec28c13611859dd33a7afec00))
* **step-commit-code-under-chore:** open-pr.mjs reports the code of its leftover commit (p2) ([1ad61aa](https://github.com/xycu/agent-smith/commit/1ad61aabbaaa095b14da4c8cff4e263271a15375))
* **step-commit-code-under-chore:** record the paths a step commit takes outside the change folder (p1) ([74384b2](https://github.com/xycu/agent-smith/commit/74384b2b0a3aadad4195d45bf22cf91f4148b753))


### Bug Fixes

* **router:** align archive test title and override note with the policy check ([7fc7673](https://github.com/xycu/agent-smith/commit/7fc767364571a991df2add112c9655e7c5acfe26))
* **router:** halt on a prompt placeholder the router never fills (p2) ([5988b61](https://github.com/xycu/agent-smith/commit/5988b6132a3c3341f008413ce25adb9cbdf3686a))
* **router:** halt on malformed spend caps, ladder and step tiers at load ([c47b4e7](https://github.com/xycu/agent-smith/commit/c47b4e7938533f6e3c55335196c4eba6dca62709))
* **skill-rigor-flag:** keep --pr-comment parsed like --archive, not like --rigor ([a51115b](https://github.com/xycu/agent-smith/commit/a51115b1ef373b23f4994c22baf3588499e0e2cf))
* **step-commit-code-under-chore:** leave both sides of a staged archive move out of open-pr swept ([595e6d3](https://github.com/xycu/agent-smith/commit/595e6d3d1fa8dfd307d2dba79a07949978daf3fa))

## [1.5.0](https://github.com/xycu/agent-smith/compare/v1.4.13...v1.5.0) (2026-11-12)


### Features

* **agent-smith-coauthor:** open-pr.mjs leftovers commit (p2) ([56aaa75](https://github.com/xycu/agent-smith/commit/56aaa75d0296e9c4f7cc837d411eda098f50c3eb))
* **agent-smith-coauthor:** policy key and router commits (p1) ([854e1ca](https://github.com/xycu/agent-smith/commit/854e1ca0c8299f75d552a984ceff3577f7c889b8))


### Bug Fixes

* **agent-smith-coauthor:** apply impl-review fixes ([4650b1e](https://github.com/xycu/agent-smith/commit/4650b1ecec83650ef2f623b6ca5364b23f16b0cc))

## [1.4.13](https://github.com/xycu/agent-smith/compare/v1.4.12...v1.4.13) (2026-11-11)


### Bug Fixes

* **router:** status --report writes no report for a 10x change without change.md ([9e003b6](https://github.com/xycu/agent-smith/commit/9e003b6194200e1b86cd8a629927a19ecc0c5b4b))

## [1.4.12](https://github.com/xycu/agent-smith/compare/v1.4.11...v1.4.12) (2026-11-11)


### Bug Fixes

* **router:** halt on a project override that is not a JSON object ([435064a](https://github.com/xycu/agent-smith/commit/435064ad2c5f7a21f48516efc06312fd5a4e1c22))

## [1.4.11](https://github.com/xycu/agent-smith/compare/v1.4.10...v1.4.11) (2026-11-11)


### Bug Fixes

* keep the maxLevel comment above maxLevel ([a6b98e4](https://github.com/xycu/agent-smith/commit/a6b98e4cf333a7b9767f1f257c5baa4274e91490))

## [1.4.10](https://github.com/xycu/agent-smith/compare/v1.4.9...v1.4.10) (2026-11-11)


### Bug Fixes

* **run-state-lock:** remove the lock test scratch folders ([5e27f64](https://github.com/xycu/agent-smith/commit/5e27f6457865f9784bcce4b0b844979f1bdf4281))

## [1.4.9](https://github.com/xycu/agent-smith/compare/v1.4.8...v1.4.9) (2026-11-11)


### Bug Fixes

* **router:** log no skip on a budget halt ([4b89859](https://github.com/xycu/agent-smith/commit/4b898592f016ef4f14377991b9b255c7dbffbc98))

## [1.4.8](https://github.com/xycu/agent-smith/compare/v1.4.7...v1.4.8) (2026-11-11)


### Bug Fixes

* **isolation:** routerCommit reports a made commit apart from its hash ([56d1b9d](https://github.com/xycu/agent-smith/commit/56d1b9dcea3ecad235791d08278f63b61a1a6ab1))

## [1.4.7](https://github.com/xycu/agent-smith/compare/v1.4.6...v1.4.7) (2026-11-11)


### Bug Fixes

* **router:** read --key=value and halt init on unknown flags ([4fad616](https://github.com/xycu/agent-smith/commit/4fad6164d0fc17968b82acd719e6e73062e24bf4))

## [1.4.6](https://github.com/xycu/agent-smith/compare/v1.4.5...v1.4.6) (2026-11-11)


### Bug Fixes

* place label-form sentence in first review bullet ([542759d](https://github.com/xycu/agent-smith/commit/542759dd9272a85cd56708cd8cf537e4133bcd01))

## [1.4.5](https://github.com/xycu/agent-smith/compare/v1.4.4...v1.4.5) (2026-11-11)


### Bug Fixes

* **pr-scripts-shared:** write the zero-width space as an escape in pr-common.mjs ([ec5b568](https://github.com/xycu/agent-smith/commit/ec5b5681de4bff9c8c2def94a18de85b300ecf7f))

## [1.4.4](https://github.com/xycu/agent-smith/compare/v1.4.3...v1.4.4) (2026-11-11)


### Bug Fixes

* **tools:** read .yaml workflows and composite actions in the pin guard ([9b252c2](https://github.com/xycu/agent-smith/commit/9b252c2c334b59c796bb4a6017630de59ba8d41c))

## [1.4.3](https://github.com/xycu/agent-smith/compare/v1.4.2...v1.4.3) (2026-11-10)


### Bug Fixes

* **browser-row-proof:** Chrome rules cover every row that needs a browser ([2f9035d](https://github.com/xycu/agent-smith/commit/2f9035de75d7b27f28834156f1ab37b2b1e18618))
* **browser-row-proof:** outputs and report carry the browser-row reason (p2) ([4fafa5d](https://github.com/xycu/agent-smith/commit/4fafa5de6c966ea9efb6531513f00065ee93fa6b)), closes [#37](https://github.com/xycu/agent-smith/issues/37)
* **browser-row-proof:** router detects browser rows and rejects weak proof (p1) ([c3b5263](https://github.com/xycu/agent-smith/commit/c3b526342f8e05d6ce69c8784905aefdfdc7f71a)), closes [#37](https://github.com/xycu/agent-smith/issues/37)
* **browser-row-proof:** templates require Chrome first and recorded proof (p3) ([88f398b](https://github.com/xycu/agent-smith/commit/88f398b4ab0072e9c7a1e6062285bbd79e6c77e9)), closes [#37](https://github.com/xycu/agent-smith/issues/37)

## [1.4.2](https://github.com/xycu/agent-smith/compare/v1.4.1...v1.4.2) (2026-11-10)


### Bug Fixes

* **late-step-usage:** attach late usage figures before status in done and halt ([72ee545](https://github.com/xycu/agent-smith/commit/72ee5452975bdd88c7a32843f48b707f896baf4d))
* **late-step-usage:** Docs and ADR-019 for the usage command (p4) ([2d302df](https://github.com/xycu/agent-smith/commit/2d302df5391eb43ee74d07d764f4669fd1d9ce6f)), closes [#71](https://github.com/xycu/agent-smith/issues/71)
* **late-step-usage:** Late figure in the archive state (p2) ([da34d34](https://github.com/xycu/agent-smith/commit/da34d34e60632df7a6b548304eb55ae3d391cad1))
* **late-step-usage:** Orchestrator skills attach a late figure (p3) ([b7d2a9c](https://github.com/xycu/agent-smith/commit/b7d2a9cdd915a8d908175f1ebfd02256a4251aef)), closes [#71](https://github.com/xycu/agent-smith/issues/71)
* **late-step-usage:** REFERENCE says a bad usage value is refused, not dropped ([5adc43f](https://github.com/xycu/agent-smith/commit/5adc43f39c20d18590c20343c5990cb5a80d9d27))
* **late-step-usage:** The usage command for running and ended runs (p1) ([8b82c25](https://github.com/xycu/agent-smith/commit/8b82c2592e876d5a2da921ccd5cc7c79275c976f))

## [1.4.1](https://github.com/xycu/agent-smith/compare/v1.4.0...v1.4.1) (2026-11-10)


### Bug Fixes

* **no-nested-subagents:** ban the Agent tool also on the subagent's own judgment ([ab9ab8d](https://github.com/xycu/agent-smith/commit/ab9ab8d9e037ce426e06479d9e147e12ef8a784f))
* **no-nested-subagents:** Orchestrator rule in both skills (p2) ([afe5bde](https://github.com/xycu/agent-smith/commit/afe5bdeee1ff955f3cfd9f12d23550cd2eb37f6e))
* **no-nested-subagents:** Subagent-side rules (p1) ([b9ea360](https://github.com/xycu/agent-smith/commit/b9ea360eb972eb32bd85f4030099b4a5d82c5ac6))

## [1.4.0](https://github.com/xycu/agent-smith/compare/v1.3.0...v1.4.0) (2026-11-09)


### Features

* **no-recursive-delete:** put the deletion rule in the text agents follow (p3) ([8bb5ece](https://github.com/xycu/agent-smith/commit/8bb5eceebb8787a5fd839be8d086bc105a4c5c67))
* **no-recursive-delete:** the removeTree helper (p1) ([cb4ffd2](https://github.com/xycu/agent-smith/commit/cb4ffd2bb2840f979c5af3f990b96ea97462bf39))


### Bug Fixes

* **no-recursive-delete:** keep removeTree inside its target and catch bare delete calls ([52ca1b9](https://github.com/xycu/agent-smith/commit/52ca1b9784fb583133c2c038b99aeed30ecd97ca))
* **open-pr:** delete the temporary body folder with removeTree ([f0eba6b](https://github.com/xycu/agent-smith/commit/f0eba6be6e2d88fc7c8d2a421a7c776b34d3d3ad))
* **test:** allow "block" in the delete guard only as the ban's reason phrase ([1a301e1](https://github.com/xycu/agent-smith/commit/1a301e1645f0a26b01de043e1e6e2c6181eb47d5))
* **test:** let cleanupAll try every scratch folder before it throws ([1049f47](https://github.com/xycu/agent-smith/commit/1049f47906668f6e56c7d09f5f3d5505af6a06f4))
* **test:** match ban and forbid as whole words in the delete guard ([9e9f018](https://github.com/xycu/agent-smith/commit/9e9f018ef403f693768730401f9771b1f1b39c50))

## [1.3.0](https://github.com/xycu/agent-smith/compare/v1.2.0...v1.3.0) (2026-11-09)


### Features

* **worktree-pr-only:** open-pr script and its tests (p1) ([a679fb8](https://github.com/xycu/agent-smith/commit/a679fb8116c2c5586557d9236b2349a95a1cbf8d))
* **worktree-pr-only:** orchestrator skills run the pull request step (p2) ([ee83ab5](https://github.com/xycu/agent-smith/commit/ee83ab51d52ac162a940802a50bd66762c2f87fd))


### Bug Fixes

* **open-pr:** count base candidates in one call and unstage only the script's own add ([511189e](https://github.com/xycu/agent-smith/commit/511189e2f48455871d734fc39f30159a67c632a2))
* **skills:** keep the archive Manual gate working with the pull request step ([240c06b](https://github.com/xycu/agent-smith/commit/240c06bdac36ec24d760072e714a4f68ed7efef6))
* **worktree-pr-only:** open-pr always sets manual when nothing is pushed ([562e7e7](https://github.com/xycu/agent-smith/commit/562e7e765b2ec6b9e3f2fc5d567a3c71a1c1bf00))

## [1.2.0](https://github.com/xycu/agent-smith/compare/v1.1.1...v1.2.0) (2026-11-09)


### Features

* **neutral-orchestrator-retry:** Router core and the 10x chain (p1) ([2d9d6ec](https://github.com/xycu/agent-smith/commit/2d9d6ec61642811f3d3c461095411ca683225af3))
* **neutral-orchestrator-retry:** Visibility, OpenSpec chain and isolated runs (p2) ([7ee4f52](https://github.com/xycu/agent-smith/commit/7ee4f52fe144328df85ef266fa611502cbb242ae))


### Bug Fixes

* **neutral-orchestrator-retry:** treat a subagent orchestrator-error status as unknown ([1196803](https://github.com/xycu/agent-smith/commit/1196803147f6acc134b0eaaa25c234380e20033c))

## [1.1.1](https://github.com/xycu/agent-smith/compare/v1.1.0...v1.1.1) (2026-11-09)


### Miscellaneous Chores

* **license:** release the new license as 1.1.1 ([a28d351](https://github.com/xycu/agent-smith/commit/a28d3513d01eb2b44b2458c9f3c20511ffffd487))

## [1.1.0](https://github.com/xycu/agent-smith/compare/v1.0.1...v1.1.0) (2026-11-09)


### Features

* **run-cost-estimate:** cost in compare (p3) ([b01ad82](https://github.com/xycu/agent-smith/commit/b01ad8298ff906f22cb9bcec5250d4dcc9e6ecf6))
* **run-cost-estimate:** cost in report.md and status (p2) ([187f3e7](https://github.com/xycu/agent-smith/commit/187f3e782dee0bea8758de806d65df83bff658dc))
* **run-cost-estimate:** prices block and cost reader (p1) ([6a906fb](https://github.com/xycu/agent-smith/commit/6a906fb9b300b39f2e51b96d9e45202d1422b8c8))


### Bug Fixes

* **cost:** give compare cost.usd null when nothing is priced ([70f7f5f](https://github.com/xycu/agent-smith/commit/70f7f5f8366133dd5c508859bed252e72074a22c))

## [1.0.1](https://github.com/xycu/agent-smith/compare/v1.0.0...v1.0.1) (2026-11-09)


### Bug Fixes

* **openspec-pipeline:** read step usage from the task notification ([79f9fba](https://github.com/xycu/agent-smith/commit/79f9fbab95ed1c9831fe659b293dbda08e960692))

## [1.0.0](https://github.com/xycu/agent-smith/compare/v0.8.1...v1.0.0) (2026-11-09)


### Documentation

* **openspec-pipeline:** tick row 5.6 after the live run ([448c5ae](https://github.com/xycu/agent-smith/commit/448c5ae730013cce2a071eeb4f4ae7ed2720cea9))

## [0.8.1](https://github.com/xycu/agent-smith/compare/v0.8.0...v0.8.1) (2026-11-09)


### Bug Fixes

* **openspec-pipeline:** read tasks like the CLI, guard the readers, halt on a 10x run ([eafc2d2](https://github.com/xycu/agent-smith/commit/eafc2d2ee469bb7eaddb9e932a02f8ed86ee5bfb))

## [0.8.0](https://github.com/xycu/agent-smith/compare/v0.7.1...v0.8.0) (2026-11-09)


### Features

* **openspec-pipeline:** archive and read-only commands (p4) ([4714cd7](https://github.com/xycu/agent-smith/commit/4714cd7aa81831e123df0868c5c27bf0eaa2787e))
* **openspec-pipeline:** chain switch, run state and routing order (p2) ([8ee62e6](https://github.com/xycu/agent-smith/commit/8ee62e68cb25623a0c0f175e2ac252fdb3b3126f))
* **openspec-pipeline:** skill and documentation (p5) ([b5e9229](https://github.com/xycu/agent-smith/commit/b5e922990de8b49aaba1baf0adc23c3165aeb003))
* **openspec-pipeline:** step verification, verdict and fix loop (p3) ([7627434](https://github.com/xycu/agent-smith/commit/7627434f98c1a685240c8a6e33bb6a49265368b1))


### Bug Fixes

* **openspec-pipeline:** apply implementation review fixes ([454ce03](https://github.com/xycu/agent-smith/commit/454ce0394cbc55313ccb41c5df0d341c7d45257a))
* **openspec-pipeline:** apply implementation review retry fixes ([63d082c](https://github.com/xycu/agent-smith/commit/63d082c8a4b7fb0e1d9f41e53f0b17b3414040c7))

## [0.7.1](https://github.com/xycu/agent-smith/compare/v0.7.0...v0.7.1) (2026-11-07)


### Bug Fixes

* **pipeline:** name the rerun command in the open-findings halt ([cfee7d6](https://github.com/xycu/agent-smith/commit/cfee7d630816ed9d76e737e2cbfcf62e865a884f))

## [0.7.0](https://github.com/xycu/agent-smith/compare/v0.6.0...v0.7.0) (2026-11-06)


### Features

* **automate-manual-checks:** every row, every level, outside the pool (p1) ([907c3f2](https://github.com/xycu/agent-smith/commit/907c3f2e77426ae911456d7277e1fc20ee41211d))
* **automate-manual-checks:** record evidence kind and unproved reasons (p2) ([5e4732a](https://github.com/xycu/agent-smith/commit/5e4732a5ff0a50149d4c1b8d1f6ca29b3c8a4802))
* **automate-manual-checks:** the prompt, and Chrome on by default (p3) ([eb0619b](https://github.com/xycu/agent-smith/commit/eb0619ba791275f46eb8be0d21ec3e6d3acdf611))


### Bug Fixes

* **automate-manual-checks:** document --chrome false in the skill entry and AGENTS.md ([68a3aa7](https://github.com/xycu/agent-smith/commit/68a3aa75596f240382c98ce0aedfb1f12b40a3db))

## [0.6.0](https://github.com/xycu/agent-smith/compare/v0.5.0...v0.6.0) (2026-11-04)


### Features

* **review-open-findings:** add opt-in confirmation review round (p3) ([59b7db8](https://github.com/xycu/agent-smith/commit/59b7db83f2a4d9a42ed85a55537f643cf109acc3))
* **review-open-findings:** parse review findings and log the counts (p1) ([86a78fa](https://github.com/xycu/agent-smith/commit/86a78fa4c5ccef7dc3694b23920242120428130b))
* **review-open-findings:** route reviews on open findings (p2) ([5d90c95](https://github.com/xycu/agent-smith/commit/5d90c957317cfa5442043b0c88c969158de37e5f))


### Bug Fixes

* **review-open-findings:** read bold or backticked Decision words and the **Severity:** label ([5bae57f](https://github.com/xycu/agent-smith/commit/5bae57ffc33668f0d31cbc45e214c6fd85064517))

## [0.5.0](https://github.com/xycu/agent-smith/compare/v0.4.1...v0.5.0) (2026-11-04)


### ⚠ BREAKING CHANGES

* **worktree-step-commits:** a run started in the main checkout halts at init; set { "isolation": { "require": false } } in the project override to keep the old behaviour.

### Features

* **worktree-step-commits:** cheaper first implement attempt (p5) ([1cf0004](https://github.com/xycu/agent-smith/commit/1cf0004a38adf921217e886ed46547b106e35a3a))
* **worktree-step-commits:** failed-step rollback (p4) ([9a31a68](https://github.com/xycu/agent-smith/commit/9a31a68fc1b00cc1e2c2d706cc16ed07b4fbf9c7))
* **worktree-step-commits:** opus/medium rung and renumbering (p1) ([98605ce](https://github.com/xycu/agent-smith/commit/98605ce36560c62da42e47c55b6b764dceeacbaf))
* **worktree-step-commits:** per-step commits (p3) ([c720b00](https://github.com/xycu/agent-smith/commit/c720b00e73609d6a1914ec83c92b9f18f3ffea75))
* **worktree-step-commits:** run isolation gate (p2) ([edb2ec1](https://github.com/xycu/agent-smith/commit/edb2ec142aef5c812fc6b8b7355c1f8408eeb7d5))


### Bug Fixes

* **worktree-step-commits:** keep interactive escalation, run token in side ref, startSha halt, net cheap drop ([f864d1e](https://github.com/xycu/agent-smith/commit/f864d1efc9735473cd8cbae5dcfab17faaf9d43a))
* **worktree-step-commits:** rollback ref namespace, undo on router error, state before file times ([97bbdd3](https://github.com/xycu/agent-smith/commit/97bbdd392b5000be3bc11e2c7af04b74e8ad7139))

## [0.4.1](https://github.com/xycu/agent-smith/compare/v0.4.0...v0.4.1) (2026-11-02)


### Performance Improvements

* **pipeline:** keep subagent replies short and drop unread reply text ([3fc1592](https://github.com/xycu/agent-smith/commit/3fc1592b0d42793752237dc4820f43d94fb4db25))

## [0.4.0](https://github.com/xycu/agent-smith/compare/v0.3.0...v0.4.0) (2026-11-02)


### Features

* **orchestrator-anti-stall:** anti-stall rules in SKILL.md (p1) ([26de3ee](https://github.com/xycu/agent-smith/commit/26de3ee1bc7dd96dac56c6e134a3c9e78a77ad46))


### Bug Fixes

* **orchestrator-anti-stall:** scope rules 4 and 5 to the whole run ([384705e](https://github.com/xycu/agent-smith/commit/384705ed30bbc0ad85e4ffe44ef704d3b6b4d103))

## [0.3.0](https://github.com/xycu/agent-smith/compare/v0.2.0...v0.3.0) (2026-11-02)


### Features

* **managed-agent-patterns:** opt-in advisor and ADR-009 (p3) ([bf96928](https://github.com/xycu/agent-smith/commit/bf96928de37b741b90b5444aa6eb59c4ade6d654))
* **managed-agent-patterns:** run provenance (p1) ([6b337e2](https://github.com/xycu/agent-smith/commit/6b337e2591262b6ec8066bade5298230857db108))
* **managed-agent-patterns:** tool-restricted step agents (p2) ([c4935d6](https://github.com/xycu/agent-smith/commit/c4935d68f0c65e8df2532dfda782dd6135464ccc))

## [0.2.0](https://github.com/xycu/agent-smith/compare/v0.1.0...v0.2.0) (2026-11-02)


### Features

* **release:** add release-please pipeline and Semantic Versioning (p3) ([28a6a6d](https://github.com/xycu/agent-smith/commit/28a6a6dd9bfdc8edadac211a1a72a9fe192e909e))
