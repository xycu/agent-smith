# Implementation review fixes

- [x] F1 — Preserve execution ownership after runner death. User selected Fix now on 2026-11-14. Shared lock now retains child/process-group identity and refuses uncertain recovery. Both-chain crash and recovery regressions pass. Runner/lock tests pass 52/52, and the full suite passes with 1,242 passed, 3 skipped and zero failures. Source finding and verification are in `../reviews/impl-review.md`.
