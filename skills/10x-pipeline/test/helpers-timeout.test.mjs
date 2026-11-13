// helpers-timeout: the `run` and `git` helpers time out and throw a clear error instead of returning a null result.
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeProject, cleanupAll, run, git, gitAvailable } from "./helpers.mjs";

afterEach(cleanupAll);

const writeScript = (project, body) => {
  const script = path.join(project.base, "script.mjs");
  fs.writeFileSync(script, body);
  return script;
};

test("run throws a clear error when the script outlives the timeout", () => {
  const project = makeProject();
  const script = writeScript(project, "await new Promise((r) => setTimeout(r, 60000));\n");
  const start = Date.now();
  assert.throws(() => run(project, ["status", "x"], { script, timeout: 300 }), /route\.mjs status x timed out after 300 ms/);
  assert.ok(Date.now() - start < 10000);
});

test("run still returns the result of a fast script", () => {
  const project = makeProject();
  const script = writeScript(project, 'console.log(JSON.stringify({ ok: true }));\n');
  const res = run(project, ["status", "x"], { script, timeout: 5000 });
  assert.equal(res.status, 0);
  assert.equal(res.json.ok, true);
});

test("git throws a timeout error", { skip: !gitAvailable() }, () => {
  const project = makeProject();
  const start = Date.now();
  assert.throws(
    () => git(project, ["-c", "alias.slow=!exec sleep 5", "slow"], { timeout: 300 }),
    /git -c alias\.slow=!exec sleep 5 slow timed out after 300 ms/,
  );
  assert.ok(Date.now() - start < 10000);
});
