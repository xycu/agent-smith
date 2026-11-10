Browser tool calls in this manual-verify subagent (2026-11-10):
1. ToolSearch query "select:mcp__claude-in-chrome__tabs_context_mcp" -> schema loaded, tool callable.
2. mcp__claude-in-chrome__tabs_context_mcp (no args) -> normal tool result, not an error:
"This session has no tab group of its own. Any tabs opened earlier in this conversation may still be open in Chrome, in a group this session cannot see or control. Use createIfEmpty: true to create this session's group."

Agreement with docs/REFERENCE.md "Limits" (line ~314): it says a step subagent can load the tools through ToolSearch and call tabs_context_mcp, which answered that the session has no tab group and to use createIfEmpty: true; opening a page and exporting evidence not seen. Matches this result. Line 182 (Live check) matches too.
