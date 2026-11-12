import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIMIT = 12288;

// AGENTS.md loads into every agent session, so it stays rules and pointers.
test("AGENTS.md stays within its size limit", () => {
  const size = statSync(join(root, "AGENTS.md")).size;
  assert.ok(
    size <= LIMIT,
    `AGENTS.md is ${size} bytes, over the limit of ${LIMIT}. Put new detail in the index of its folder ` +
      "(skills/10x-pipeline/test/README.md, docs/ADR/README.md, skills/10x-pipeline/prompts/README.md), not in AGENTS.md.",
  );
});
