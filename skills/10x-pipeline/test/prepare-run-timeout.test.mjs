// Git and detached project gate deadlines run independently of the other pre-init checks.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cleanupAll } from "./helpers.mjs";
import { PROJECT_POLICY, commitProjectFiles, fixture, launchSetup, projectTools, relChange, setup, wrapper } from "./prepare-run-helpers.mjs";

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

async function waitFor(file) {
  const deadline = Date.now() + 30000;
  while (!fs.existsSync(file)) {
    assert.ok(Date.now() < deadline, `Timed out waiting for ${file}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

for (const signal of [null, "SIGINT", "SIGTERM"]) {
  const label = signal ?? "setup deadline";
  test(`${label}: setup retains its lock through project process-group termination and can retry`,
    { timeout: 60000, skip: process.platform === "win32" }, async () => {
      const p = fixture(signal ? "openspec" : "10x");
      const prefix = path.join(p.base, ".git");
      const ready = path.join(prefix, "gate-ready");
      const terminated = path.join(prefix, "gate-terminated");
      const late = path.join(prefix, "gate-wrote-after-termination");
      const record = path.join(prefix, "agent-smith-setup-agent-smith%2Fdemo.pending");
      const lock = path.join(prefix, "agent-smith-setup-agent-smith%2Fdemo.lock");
      const childCode = `
import fs from "node:fs";
process.on("SIGTERM", () => {
  fs.writeFileSync(${JSON.stringify(terminated)}, String(Date.now()));
  setTimeout(() => {
    fs.writeFileSync(${JSON.stringify(late)}, "escaped");
    process.exit(1);
  }, 2500);
});
fs.writeFileSync(${JSON.stringify(ready)}, "ready");
setTimeout(() => process.exit(2), 45000);
`;
      const toolName = signal ? "verify-ready" : "npm";
      const tools = projectTools(p, {
        [toolName]: `
process.on("SIGTERM", () => process.exit(0));
spawn(process.execPath, ["--input-type=module", "-e", ${JSON.stringify(childCode)}], { stdio: "ignore" });
setTimeout(() => process.exit(2), 45000);
`,
      });
      commitProjectFiles(p, signal
        ? { [PROJECT_POLICY]: { isolation: { require: true }, readiness: toolName } }
        : { "package.json": { dependencies: { fixture: "1" } }, "package-lock.json": "locked" });
      const env = { ...tools.env };
      if (!signal) {
        // Keep the production deadline and advance only the subprocess clock.
        const preload = path.join(prefix, "gate-clock.mjs");
        fs.writeFileSync(preload, `
const now = performance.now.bind(performance);
let first = true;
Object.defineProperty(performance, "now", { value: () => {
  const offset = first ? 0 : 575000;
  first = false;
  return now() + offset;
} });
`);
        env.NODE_OPTIONS = `--import=${JSON.stringify(preload)}`;
      }
      const launched = launchSetup(p, env);
      try {
        await waitFor(ready);
        assert.match(setup(p, { env: tools.env }).reason, /Setup lock exists/);
        assert.equal(JSON.parse(fs.readFileSync(record, "utf8")).copyComplete, true);
        if (signal) assert.equal(launched.child.kill(signal), true);
        await waitFor(terminated);
        assert.equal(fs.existsSync(lock), true);
        const out = await launched.done;
        assert.equal(out.runRoot, null);
        assert.equal(out.copied, true);
        assert.match(out.reason, signal
          ? new RegExp(`Readiness command "verify-ready".*interrupted by ${signal}`)
          : /npm ci.*timed out at the setup deadline/);
        assert.ok(out.reason.includes(p.root));
        assert.ok(Date.now() - Number(fs.readFileSync(terminated, "utf8")) >= 700,
          "the branch lock outlives the direct child's SIGTERM exit");
        assert.equal(fs.existsSync(lock), false);
        assert.equal(fs.existsSync(record), true);
        const copied = path.join(out.worktree, relChange(p.chain), "change.md");
        fs.writeFileSync(copied, "retained edit");
        tools.writeTool(toolName, "");
        const retry = setup(p, { env: tools.env });
        assert.equal(retry.reason, null, retry.reason);
        assert.equal(retry.case, "reused");
        assert.equal(retry.copied, false);
        assert.equal(fs.readFileSync(copied, "utf8"), "retained edit");
        assert.equal(fs.existsSync(path.join(p.changeDir, "change.md")), true);
        assert.equal(fs.existsSync(record), false);
        await new Promise((resolve) => setTimeout(resolve, 2500));
        assert.equal(fs.existsSync(late), false, "the surviving descendant must receive SIGKILL");
      } finally {
        if (launched.child.exitCode === null && launched.child.signalCode === null) launched.child.kill("SIGTERM");
        await launched.done.catch(() => {});
      }
    });
}

