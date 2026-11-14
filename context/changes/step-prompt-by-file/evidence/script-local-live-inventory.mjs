import fs from "node:fs";
import { execFileSync } from "node:child_process";

// Run from the worktree root. Report metadata without copying prompt text or usage payloads.
const files = execFileSync("rg", ["--files", "context", "openspec"], { encoding: "utf8" })
  .trim().split("\n");
const logs = files.filter(file => file.endsWith("/agent-smith/run.jsonl"));
let entryCount = 0;
const handoffs = [];
for (const file of logs) {
  for (const [index, line] of fs.readFileSync(file, "utf8").split("\n").entries()) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    entryCount++;
    if (Object.hasOwn(entry, "pendingHandoff") || Object.hasOwn(entry, "promptFile")) {
      handoffs.push({ file, line: index + 1, n: entry.n, step: entry.step });
    }
  }
}
const measurementFile = "context/changes/step-prompt-by-file/evidence/size-measurements.json";
const measurement = JSON.parse(fs.readFileSync(measurementFile, "utf8"));
console.log(JSON.stringify({
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  command: "node context/changes/step-prompt-by-file/evidence/script-local-live-inventory.mjs",
  logsInspected: logs.length,
  entriesInspected: entryCount,
  retainedHandoffRecords: handoffs,
  candidateArtifacts: files.filter(file => file.includes("/evidence/")
    && /(?:compar|live|transcript|telemetry)/i.test(file)
    && !file.endsWith("/script-local-live-inventory.mjs")
    && !file.endsWith("/script-local-live-inventory.json")),
  measurements: { file: measurementFile, kind: measurement.kind, livePairs: measurement.livePairs },
  limit: "Consumed entries drop pendingHandoff. Log inventory alone cannot establish whether a live file-mode session occurred or prove live acceptance.",
}, null, 2));
