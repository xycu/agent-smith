// Only the headless runner sets this binding. Native sessions keep their existing hook behavior.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const pluginRoot = fs.realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));
export const digest = (value) => createHash("sha256").update(value).digest("hex");

export function guardRevision(root, agent) {
  if (!["agent-smith:step", "agent-smith:score"].includes(agent)) throw new Error("Unsupported Claude agent.");
  return digest(["hooks/hooks.json", "skills/10x-pipeline/scripts/step-guard.mjs",
    "skills/10x-pipeline/scripts/claude-hook.mjs", `agents/${agent.split(":")[1]}.md`]
    .map(file => digest(fs.readFileSync(path.join(root, file)))).join("/"));
}

async function receipt() {
  const session = process.env.AGENT_SMITH_CLAUDE_SESSION;
  if (!session) return;
  const agent = process.env.AGENT_SMITH_CLAUDE_AGENT;
  let input = "";
  for await (const bytes of process.stdin) {
    input += bytes;
    if (Buffer.byteLength(input) > 8 * 1024 * 1024) throw new Error("Oversized Claude lifecycle event.");
  }
  const event = JSON.parse(input);
  if (event.session_id !== session || event.agent_type !== (event.agent_id ? "agent-smith:step" : agent)
      || fs.realpathSync(process.env.CLAUDE_PLUGIN_ROOT) !== pluginRoot) throw new Error("Claude lifecycle identity mismatch.");
  const record = { session, event: event.hook_event_name, agent: event.agent_type, id: event.agent_id };
  switch (record.event) {
    case "SessionStart":
      if (event.agent_id !== undefined || event.source !== "startup" || fs.realpathSync(event.cwd) !== fs.realpathSync(process.cwd())) {
        throw new Error("Expected the fresh guarded main session.");
      }
      record.root = pluginRoot;
      record.revision = guardRevision(pluginRoot, agent);
      break;
    case "SubagentStart":
    case "SubagentStop":
      if (typeof record.id !== "string" || !record.id) throw new Error("Missing native leaf identity.");
      break;
    case "Stop":
      if (event.agent_id !== undefined || typeof event.last_assistant_message !== "string") throw new Error("Missing enclosing stop.");
      record.reply = digest(event.last_assistant_message);
      record.idle = Array.isArray(event.background_tasks) && !event.background_tasks.length
        && Array.isArray(event.session_crons) && !event.session_crons.length;
      break;
    default: throw new Error("Unexpected Claude lifecycle event.");
  }
  // Hook result stream comes from the CLI. Don't add evidence or transcripts to the model's context.
  process.stderr.write("agent-smith-hook " + JSON.stringify(record) + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  receipt().catch(error => { process.stderr.write(error.message + "\n"); process.exitCode = 2; });
}
