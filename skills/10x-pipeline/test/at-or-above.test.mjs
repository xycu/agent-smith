import test from "node:test";
import assert from "node:assert/strict";
import { atOrAbove } from "../scripts/state.mjs";

const policy = { rigor: { levels: ["lean", "standard", "thorough"] } };

test("atOrAbove: known levels compare by order", () => {
  assert.equal(atOrAbove(policy, "standard", "standard"), true);
  assert.equal(atOrAbove(policy, "thorough", "standard"), true);
  assert.equal(atOrAbove(policy, "lean", "standard"), false);
});

test("atOrAbove: an unknown level or minRigor is closed", () => {
  assert.equal(atOrAbove(policy, "huge", "lean"), false);
  assert.equal(atOrAbove(policy, undefined, "lean"), false);
  for (const min of ["huge", null, undefined, 1, {}]) assert.equal(atOrAbove(policy, "thorough", min), false);
});
