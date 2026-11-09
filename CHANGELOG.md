# Changelog

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
