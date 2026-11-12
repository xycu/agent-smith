// A plan.md saved with CRLF line endings reads and routes like its LF copy.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import {
  cleanupAll, makeProject, init, run, writeLog, entry, readLogEntries,
  gitAvailable, gitEnv, gitInit, commitFiles, planText,
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";
import { readPlan, planFileTokens } from "../scripts/state.mjs";

after(cleanupAll);

const skip = gitAvailable() ? false : "git is not installed";
const crlf = (s) => s.replace(/\n/g, "\r\n");

const PROGRESS = `# Plan

## Phase 1: Core

**Files**: \`a.mjs\`

## Progress

### Phase 1: Core

#### Automated

- [x] 1.1 First done
- [ ] 1.2 Second pending

#### Manual

- [ ] 1.3 Look at it

### Phase 2

#### Automated

- [ ] 2.1 Third pending

#### Manual

- [ ] 2.2 Look again
`;

const withoutMtime = (p) => ({ ...p, mtime: undefined });

test("readPlan gives the same result for LF and CRLF", () => {
  const project = makeProject({ plan: PROGRESS });
  const lf = readPlan(project.planFile);
  writePlan(project, crlf(PROGRESS));
  const cr = readPlan(project.planFile);
  assert.deepEqual(withoutMtime(cr), withoutMtime(lf));
  assert.equal(cr.phases, 2);
  assert.equal(cr.rows, 5);
  assert.equal(cr.autoDone, 1);
  assert.equal(cr.autoPending, 2);
  assert.equal(cr.manualPending.length, 2);
  assert.deepEqual(cr.phaseList.map((p) => p.name), ["Core", ""]);
  assert.ok(!JSON.stringify(cr).includes("\\r"));
});

test("planFileTokens ignores a trailing carriage return", () => {
  for (const line of ["**Files**: `a.mjs`, `b.mjs`", "**Files**: a.mjs, b.mjs", "**File**: `a.mjs`"]) {
    const tokens = planFileTokens(line);
    assert.ok(tokens.length > 0);
    assert.deepEqual(planFileTokens(line + "\r"), tokens);
  }
});

function firstTemplate(text, log = null) {
  const project = makeProject({ plan: text });
  if (log) writeLog(project, log);
  const res = init(project, "add a thing");
  assert.equal(res.status, 0, res.stderr || res.stdout);
  assert.doesNotMatch(res.stdout + res.stderr, /Router error/);
  return { step: res.json.step, project };
}

test("init routes a CRLF plan like the LF plan", () => {
  const lf = planText({ phases: 1, rowsPerPhase: 2 });
  assert.equal(firstTemplate(crlf(lf)).step, firstTemplate(lf).step);

  // plan and plan-review done, a row pending: implement, not review or done.
  const log = [entry(1, "plan"), entry(2, "plan-review")];
  const project = makeProject({ plan: crlf(lf) });
  writeLog(project, log);
  writeReview(project, "plan-review", { verdict: "SOUND" });
  const res = init(project, "add a thing");
  assert.equal(res.status, 0, res.stderr || res.stdout);
  assert.equal(res.json.step, "implement");
  assert.equal(readLogEntries(project).at(-1).step, "implement");
});

test("risk gives the same output for LF and CRLF plans", { skip }, () => {
  const out = (text) => {
    const project = makeProject({ plan: text });
    gitInit(project);
    // Same history as dryRunRepo in churn.test.mjs: f9 in 9 commits, f4 in 4, README last.
    for (let i = 1; i <= 9; i++) commitFiles(project, i <= 4 ? ["f9.js", "f4.js", `g${i}.js`] : ["f9.js"], { message: `c${i}` });
    commitFiles(project, ["README.md"], { message: "c10" });
    const res = run(project, ["risk", project.id], { env: gitEnv(project) });
    assert.equal(res.status, 0, res.stderr || res.stdout);
    return res.json;
  };
  const lf = planText({ files: ["**File**: `f9.js`"] });
  const a = out(lf);
  assert.deepEqual(out(crlf(lf)), a);
  assert.deepEqual(a.planHits, ["f9.js"]);
});
