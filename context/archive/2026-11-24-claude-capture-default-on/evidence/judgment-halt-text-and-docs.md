# Judgment: rows 1.8, 2.5, 2.6

## 1.8 halt text (quoted from evidence/command-halt-text.txt)
"Native Claude token capture is off in this session." = cause.
"Start a fresh Claude session with the capture launcher: node \".../claude-capture.mjs\" (run it from a terminal outside Claude Code, in the project root)" = pasteable command.
"then run /agent-smith:10x-pipeline x again in that session with the same flags; a run that already has steps resumes..." = resume.
"set { \"claudeCapture\": { \"require\": false } } in context/foundation/agent-smith-policy.json" = opt-out. "Nothing was written." Cause, command, resume, opt-out all present and clear.

## 2.5 README and ADRs state 2026-11-24 decision
README: "On a native Claude host whose capture is not ready, `init` halts instead, before anything is written." and "To run without capture, set `{ \"claudeCapture\": { \"require\": false } }`..."
ADR-018 Amendment 8 (Date 2026-11-24): "the default moves from opt-in to expected ... `init` halts on a native Claude host whose readiness is not `ready`" and "overturns the opt-in decision ... by the owner's decision of 2026-11-24."
ADR-019 Amendment 3 (Date 2026-11-24): "`init` now halts a native Claude host without ready capture (ADR-018 Amendment 8) ... Amendment 2 is superseded on the default, not on the mechanism."
All three state the decision.

## 2.6 release type
docs/REFERENCE.md: "A Claude-hosted run started in an ordinary session now halts at `init`: this is a breaking default". Precedent, REFERENCE.md:212: "`isolation.require` ships `true` ... It shipped as a breaking change (`feat!`)." Same shape (new halting gate shipping true, opt-out key), so decision: breaking, derive the PR title as `feat!`. Phase 1 commit is `feat(...)`, so a release PR is produced.
