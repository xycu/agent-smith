import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPlan } from "../../../../skills/10x-pipeline/scripts/state.mjs";

const root = "context/archive";
const counts = { plans: 0, withOpenRows: 0, manualPending: 0, autoPending: 0 };
for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const plan = readPlan(path.join(root, dir.name, "plan.md"));
  if (!plan.exists) continue;
  counts.plans++;
  counts.withOpenRows += Number(plan.manualPending.length > 0 || plan.autoPending > 0);
  counts.manualPending += plan.manualPending.length;
  counts.autoPending += plan.autoPending;
}
console.log("Archived 10x plan recount using the production readPlan reader");
console.log(JSON.stringify(counts));
assert.deepEqual(counts, { plans: 92, withOpenRows: 35, manualPending: 58, autoPending: 0 });
