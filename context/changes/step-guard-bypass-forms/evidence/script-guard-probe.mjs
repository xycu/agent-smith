import { spawnSync } from "node:child_process";
const guard = process.argv[2];
const cmds = process.argv.slice(3);
for (const command of cmds) {
  const ev = { session_id: "s", agent_type: "agent-smith:step", agent_id: "a1", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } };
  const r = spawnSync("node", [guard], { input: JSON.stringify(ev), encoding: "utf8", env: { PATH: process.env.PATH } });
  const out = (r.stdout + r.stderr).trim().replace(/\s+/g, " ").slice(0, 60);
  console.log(`${r.status === 0 && !/deny/.test(r.stdout) ? "ALLOW" : "DENY "} | ${command} | ${out}`);
}
