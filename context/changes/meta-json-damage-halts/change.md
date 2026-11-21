---
change_id: meta-json-damage-halts
title: Halt on a damaged meta.json instead of replacing it with defaults
status: impl_reviewed
created: 2026-11-19
updated: 2026-11-21
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 7 (should fix). Reproduced through the router CLI in a scratch project.

**The defect.** `readJson` in `skills/10x-pipeline/scripts/state.mjs:50-52` returns its fallback on any error, and `readMeta` (`state.mjs:533-536`) returns the fallback for anything that is not a plain object. A missing file and an unparsable file are treated the same. The callers in `skills/10x-pipeline/scripts/route.mjs` (lines 90, 121, 775, 871, 999, 1062 and 1084-1109) then continue with defaults, and `next` writes the defaults back over the damaged file.

**Reproduced case.** A `meta.json` that held `isolated: true`, `archive: true` and `host: "codex"` was wrapped in conflict markers (`<<<<<<< HEAD ... >>>>>>> main`). `next demo` returned `action: "run"` with `n: 2`, and the file afterwards was `{"id":"demo","goal":"","rigor":{"level":"standard","by":"goal plain"}}`.

**What is lost.** The goal (the prompt gets an empty one), the isolation flag and branch (no step commits, no rollback), the `--archive` choice, the host (a Codex run becomes a Claude run), the base commit and the provenance record. The `usage` command then sees no `outcome`, so it skips the report rewrite and the archive-state commit.

**One rule applied three ways.** A damaged line in `run.jsonl` halts with "Preserve the damaged copy". A damaged per-project override halts (`override-json.test.mjs`). A damaged `meta.json` is silently wiped.

**Direction (for the plan to confirm).**
- `readMeta` returns the fallback only when the file does not exist (`ENOENT`). A parse failure or a non-object throws.
- `init`, `next`, `usage` and `status --report` turn that into the normal JSON halt, with a message that names the file and tells the user to preserve the damaged copy, as the `run.jsonl` halt does.
- Plain `status`, `risk` and `compare` are read-only; the plan decides whether they keep a tolerant read (and say so in their output) or halt too.

**Constraints.**
- `route.mjs` and the modules it imports own `meta.json`; nothing else writes it.
- The first `init` of a run, where the file does not exist yet, must work as today.
- A `meta.json` written by an older plugin version (fewer keys) is valid and must still load.

**Done when.**
- A test: `next` on a run with an unparsable `meta.json` halts, and the file on disk is byte-identical afterwards.
- A test: the same for `init` on resume and for `usage`.
- A test: a missing `meta.json` still falls back as before.
- `docs/REFERENCE.md` lists the damaged-`meta.json` halt next to the damaged-log halt.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
