// This probe runs inside the selected Codex sandbox, with the execution's cwd, config and PATH.
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createInterface } from "node:readline";

export async function proveCodexToolkit({ skill, openspec, profile }) {
  if (openspec && execFileSync("openspec", ["--version"], { timeout: 5000, encoding: "utf8" }).trim() !== "2.0.0") {
    throw new Error("OpenSpec 2.0.0 is required in the execution environment.");
  }
  if (!skill) return;
  const root = fs.realpathSync(process.cwd());
  const config = profile ? ["-c", `profile=${JSON.stringify(profile)}`] : [];
  const child = spawn("codex", [...config, "app-server", "--stdio"], { stdio: ["pipe", "pipe", "ignore"] });
  const closed = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 10000);
  child.stdin.on("error", () => {});
  const send = (message) => child.stdin.write(JSON.stringify(message) + "\n");
  const lines = createInterface({ input: child.stdout });
  try {
    send({ method: "initialize", id: 1, params: { clientInfo: { name: "agent-smith", version: "1" }, capabilities: {} } });
    for await (const line of lines) {
      if (Buffer.byteLength(line) > 4 * 1024 * 1024) break;
      const message = JSON.parse(line);
      if (message.error) break;
      if (message.id === 1 && message.result) {
        send({ method: "initialized", params: {} });
        send({ method: "skills/list", id: 2, params: { cwds: [root], forceReload: true } });
      } else if (message.id === 2) {
        const rows = message.result?.data?.find(row => row.cwd === root)?.skills ?? [];
        const found = rows.filter(row => row.name === skill && row.enabled === true);
        if (found.length === 1 && path.isAbsolute(found[0].path) && fs.statSync(found[0].path).isFile()) return;
        break;
      }
    }
    throw new Error(`Codex cannot discover required skill ${skill} in ${root}.`);
  } finally {
    lines.close();
    child.stdin.end();
    child.kill();
    await closed;
    clearTimeout(timeout);
  }
}
