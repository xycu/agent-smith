// A project override file that does not parse, or holds JSON that is not an object, halts the router with the file
// name; a missing file is no override.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cleanupAll, makeProject, init, run } from "./helpers.mjs";

after(cleanupAll);

const overrideFile = (project) => path.join(project.root, "context/foundation/agent-smith-policy.json");

test("init halts on a trailing-comma override and writes nothing", () => {
  const project = makeProject();
  fs.writeFileSync(overrideFile(project), '{ "isolation": { "require": false }, }');
  const res = init(project, "fix typo");
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /agent-smith-policy\.json/);
  assert.match(res.json.reason, /Cannot parse/);
  assert.equal(fs.existsSync(path.join(project.agentDir, "meta.json")), false);
});

test("status halts on a broken override; a missing file is no override", () => {
  const project = makeProject();
  fs.writeFileSync(overrideFile(project), "{ nope");
  const bad = run(project, ["status", project.id]);
  assert.equal(bad.status, 1);
  assert.match(bad.json.reason, /Cannot parse/);
  fs.unlinkSync(overrideFile(project));
  assert.equal(run(project, ["status", project.id]).status, 0);
});

test("an override that is valid JSON but not an object halts and writes nothing", () => {
  const kinds = { "[]": "an array", null: "null", '"x"': "a string", 5: "a number", false: "a boolean" };
  for (const [text, kind] of Object.entries(kinds)) {
    const project = makeProject();
    fs.writeFileSync(overrideFile(project), text);
    const res = init(project, "fix typo");
    assert.equal(res.status, 1, text);
    assert.equal(res.json.action, "halt");
    assert.ok(res.json.reason.includes("agent-smith-policy.json must hold a JSON object of policy keys, not " + kind + "."), res.json.reason);
    assert.equal(fs.existsSync(path.join(project.agentDir, "meta.json")), false);
    assert.equal(run(project, ["status", project.id]).status, 1, text);
  }
});
