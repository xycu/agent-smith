# Pending Manual row

Owner decision, 2026-11-24. Row 2.4 stays unticked and is not moved to S-20. The change stays open in `context/changes/` and its archive stays on hold.

- 2.4 needs the owner's real project: a real lockfile, a committed readiness hook and a deliberately unavailable shared service. The fixture tests of rows 2.1 to 2.3 use fake package managers and a local hook.
- The change merged as [#259](https://github.com/xycu/agent-smith/pull/259); the release 1.16.2 is out. The owner runs the check on their own project and records it here, then archives the change.
