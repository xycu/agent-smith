// The production Git deadline runs independently of the other pre-init checks.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cleanupAll } from "./helpers.mjs";
import { fixture, setup, wrapper } from "./prepare-run-helpers.mjs";

after(cleanupAll);

test("real Git deadline returns failure JSON before the outer helper deadline", { timeout: 155000 }, () => {
  const p = fixture();
  const w = wrapper(p, "timeout", "show-ref");
  const start = Date.now();
  const out = setup(p, { env: w.env, timeout: 150000 });
  assert.match(out.reason, /timed out after 120000 ms/);
  assert.ok(Date.now() - start >= 120000);
  assert.equal(fs.readFileSync(w.signal, "utf8"), "terminated");
});

