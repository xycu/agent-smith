import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { CAPTURE_ENV, CAPTURE_LIMITS, appendNative, markCaptureFailure, projectNative, readCaptureBinding } from "./claude-capture-data.mjs";

async function capture(root) {
  let binding;
  try {
    const pluginRoot = fs.realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));
    if (fs.realpathSync(process.env.CLAUDE_PLUGIN_ROOT) !== pluginRoot) return;
    binding = readCaptureBinding(root);
    const timer = setTimeout(() => process.stdin.destroy(new Error()), 1500);
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of process.stdin) {
        size += chunk.length;
        if (size > CAPTURE_LIMITS.bodyBytes) throw new Error();
        chunks.push(chunk);
      }
      const event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size)));
      const projected = projectNative(event, binding.sessionId);
      if (projected) appendNative(root, projected);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    if (binding) markCaptureFailure(root);
  }
}

const root = process.env[CAPTURE_ENV];
if (root && !process.env.AGENT_SMITH_CLAUDE_SESSION) await capture(root);
