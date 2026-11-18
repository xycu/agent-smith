// Synthetic reproduction of the retained reviews; this is not live-host qualification.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { collectCodexUsage } from "../../../../skills/10x-pipeline/scripts/codex-usage.mjs";
import { collectClaudeUsage } from "../../../../skills/10x-pipeline/scripts/claude-usage.mjs";
import { codexUsageRecords } from "../../../../skills/10x-pipeline/test/codex-helpers.mjs";
import { claudeUsageFixture } from "../../../../skills/10x-pipeline/test/claude-helpers.mjs";
import { removeTree } from "../../../../skills/10x-pipeline/scripts/remove-tree.mjs";

const evidence = path.dirname(fileURLToPath(import.meta.url));
const scratch = fs.mkdtempSync(path.join(evidence, "script-adapter-scratch-"));
const unavailable = (value, reason) => {
  assert.equal(value.usage?.totalTokens, undefined);
  assert.equal(value.usageEvidence.status, "unavailable");
  assert.equal(value.usageEvidence.reason, reason);
};
console.log("Synthetic adapter recheck; no model launches, host capture, router intake or settlement proof.");
try {
  const codexHome = path.join(scratch, "host");
  fs.mkdirSync(path.join(codexHome, "sessions"), { recursive: true });
  const threads = ["root-fixture", "child"].map(id => {
    const parentThreadId = id === "child" ? "root-fixture" : null;
    const file = path.join(codexHome, "sessions", `${id}.jsonl`);
    const records = codexUsageRecords({ id, rootId: "root-fixture", parentId: parentThreadId });
    fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join("\n") + "\n");
    return { id, turn: { id: `turn-${id}`, rootTurnId: "turn-root-fixture" },
      metadata: { id, sessionId: "root-fixture", parentThreadId, forkedFromId: null, cliVersion: "0.169.0", path: file } };
  });
  const input = { rootThreadId: "root-fixture", codexHome, threads, delegated: true };
  assert.equal(collectCodexUsage(input).usage.totalTokens, 220);
  threads[1].metadata.sessionId = "child";
  unavailable(collectCodexUsage(input), "missing-identity");
  console.log("Codex 0.169.0 shapes: baseline verified 220; per-thread metadata sessionId from retained review => unavailable/missing-identity, no total.");
  for (const chain of ["10x", "openspec"]) {
    const root = path.join(scratch, chain);
    fs.mkdirSync(root);
    const f = claudeUsageFixture({ project: { root, id: "synthetic" }, chain });
    assert.equal(collectClaudeUsage(f.descriptor).usage.totalTokens, 151);
    for (const attr of f.events.flatMap(event => event.attributes)) {
      if (attr.key === "event.sequence") attr.value.intValue = Number(attr.value.intValue);
    }
    f.write();
    unavailable(collectClaudeUsage(f.descriptor), "unsupported-schema");
    console.log(`Claude 2.1.311 shapes (${chain}): baseline verified 151; numeric event.sequence intValue from retained review => unavailable/unsupported-schema, no total.`);
  }
  console.log("PASS: current adapters reproduce both documented compatibility gaps; positive live paths remain unqualified.");
} finally {
  const removed = removeTree(scratch);
  console.log(`Scratch removed file by file: ${removed.files} files, ${removed.dirs} directories.`);
}
