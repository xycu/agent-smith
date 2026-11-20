// The Progress reader ignores code fences, archived plans and reviews read as before, and a plan or plan-revise step
// verifies only with a pending Automated row in the `- [ ] N.M title` form.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cleanupAll, makeProject } from "./helpers.mjs";
import { readPlan, readReview, openCounts } from "../scripts/state.mjs";

after(cleanupAll);

const withoutMtime = (p) => ({ ...p, mtime: undefined });

const REAL = `## Progress

### Phase 1: Core

#### Automated

- [x] 1.1 First done
- [ ] 1.2 Second pending

#### Manual

- [ ] 1.3 Look at it
`;

const QUOTED = (fence) => `${fence}markdown
## Progress

### Phase 9: Example

#### Automated

- [ ] 9.1 Example row
- [ ] 9.2 Another example row

## Notes
${fence}
`;

function planIn(text) {
  const project = makeProject({ plan: text });
  return readPlan(project.planFile);
}

function assertReal(p) {
  assert.equal(p.hasProgress, true);
  assert.equal(p.phases, 1);
  assert.equal(p.rows, 3);
  assert.equal(p.autoDone, 1);
  assert.equal(p.autoPending, 1);
  assert.deepEqual(p.manualPending, ["1.3 Look at it"]);
}

test("a backtick-fenced Progress example before the real section leaves the real rows read", () => {
  assertReal(planIn(`# Plan\n\nFormat:\n\n${QUOTED("```")}\n${REAL}`));
});

test("a tilde-fenced Progress example before the real section leaves the real rows read", () => {
  assertReal(planIn(`# Plan\n\n${QUOTED("~~~~")}\n${REAL}`));
});

test("a fenced Progress example in a CRLF plan leaves the real rows read", () => {
  const text = `# Plan\n\n${QUOTED("```")}\n${REAL}`.replace(/\n/g, "\r\n");
  assertReal(planIn(text));
});

test("a quoted Progress after the real section and fenced lines inside it change nothing", () => {
  const inside = REAL.replace("- [ ] 1.2 Second pending\n", "- [ ] 1.2 Second pending\n\n```\n## Notes\n- [ ] 9.9 Fenced row\n### Phase 7: Fenced\n```\n");
  const base = planIn(`# Plan\n\n${REAL}`);
  const mixed = planIn(`# Plan\n\n${inside}\n## Appendix\n\n${QUOTED("```")}`);
  assertReal(mixed);
  assert.deepEqual(withoutMtime(mixed), withoutMtime(base));
});

test("a plan whose only Progress heading is fenced reads no Progress", () => {
  const p = planIn(`# Plan\n\n${QUOTED("```")}`);
  assert.equal(p.exists, true);
  assert.equal(p.hasProgress, false);
  assert.equal(p.rows, 0);
});

test("an unclosed fence reads as fenced to the end of the text", () => {
  const p = planIn(`# Plan\n\n${REAL}\n\`\`\`\n- [ ] 1.4 After an unclosed fence\n`);
  assertReal(p);
  const q = planIn(`# Plan\n\n\`\`\`\n${REAL}`);
  assert.equal(q.hasProgress, false);
});

test("a backtick line whose info string holds a backtick opens no fence", () => {
  assertReal(planIn(`# Plan\n\n\`\`\`not a \`fence\`\n\n${REAL}`));
});

// ---- archive equivalence ---------------------------------------------------

// A copy of the reader before fences were tracked, kept to pin the archive.
function oldReadPlan(text) {
  const res = { hasProgress: false, phases: 0, rows: 0, autoDone: 0, autoPending: 0, manualPending: [], phaseNames: [] };
  const idx = text.search(/^## Progress\s*$/m);
  if (idx < 0) return res;
  res.hasProgress = true;
  let section = null;
  for (const line of text.slice(idx).split(/\r?\n/)) {
    if (/^## /.test(line) && !/^## Progress\s*$/.test(line)) break;
    if (/^### Phase \d+/.test(line)) {
      res.phases++;
      section = null;
      res.phaseNames.push(line.match(/^### Phase (\d+)\s*:?\s*(.*)$/)[2].trim());
      continue;
    }
    if (/^#### Automated/.test(line)) { section = "auto"; continue; }
    if (/^#### Manual/.test(line)) { section = "manual"; continue; }
    const m = line.match(/^- \[( |x|X)\] (.*)$/);
    if (!m) continue;
    res.rows++;
    const done = m[1] !== " ";
    if (section === "manual") { if (!done) res.manualPending.push(m[2].trim()); }
    else if (done) res.autoDone++;
    else res.autoPending++;
  }
  return res;
}

const ARCHIVE = path.resolve(process.cwd(), "context/archive");
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;

test("archived plans read the same as with the old reader", { skip: fs.existsSync(ARCHIVE) ? false : "no context/archive here" }, () => {
  let compared = 0;
  for (const dir of fs.readdirSync(ARCHIVE)) {
    const file = path.join(ARCHIVE, dir, "plan.md");
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    const at = lines.findIndex((l) => /^## Progress\s*$/.test(l));
    // A future archived plan that quotes a fence in or after its Progress section is out of scope here.
    if (at >= 0 && lines.slice(at).some((l) => FENCE_LINE.test(l))) continue;
    const now = readPlan(file);
    const old = oldReadPlan(text);
    const got = {
      hasProgress: now.hasProgress, phases: now.phases, rows: now.rows, autoDone: now.autoDone,
      autoPending: now.autoPending, manualPending: now.manualPending, phaseNames: now.phaseList.map((p) => p.name),
    };
    assert.deepEqual(got, old, file);
    compared++;
  }
  assert.ok(compared > 0, "no archived plan was compared");
});

// ---- review findings -------------------------------------------------------

function reviewIn(body) {
  const project = makeProject();
  const dir = path.join(project.changeDir, "reviews");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "impl-review.md");
  fs.writeFileSync(file, body);
  return readReview(file);
}

const HEADER = "# Review\n\n- **Verdict**: REVISE\n- **Findings**: 1 critical, 1 warnings\n\n## Findings\n\n";

test("a fenced ### line inside a finding block keeps its Decision", () => {
  const r = reviewIn(`${HEADER}### F1 Bad thing\n\n- **Severity**: CRITICAL\n\n\`\`\`md\n### Example\n## Also fenced\n\`\`\`\n\n- **Decision**: APPLIED - abc1234\n\n### F2 Other\n\n- **Severity**: WARNING\n- **Decision**: SKIPPED\n`);
  assert.deepEqual(r.findings, [
    { id: "F1", severity: "critical", decision: "APPLIED" },
    { id: "F2", severity: "warning", decision: "SKIPPED" },
  ]);
});

test("an unfenced heading still cuts a finding block", () => {
  const r = reviewIn(`${HEADER}### F1 Bad thing\n\n- **Severity**: CRITICAL\n\n### Example\n\n- **Decision**: APPLIED\n`);
  assert.deepEqual(r.findings, [{ id: "F1", severity: "critical", decision: null }]);
});

test("an unclosed fence in a finding block never reads cleaner than the header counts", () => {
  const r = reviewIn(`${HEADER}### F1 Bad thing\n\n- **Severity**: CRITICAL\n- **Decision**: APPLIED\n\n\`\`\`\n### F2 Hidden\n\n- **Severity**: WARNING\n- **Decision**: APPLIED\n`);
  assert.deepEqual(r.findings.map((f) => f.id), ["F1"]);
  const open = openCounts(r, { review: { openFindings: { enabled: true } } });
  assert.equal(open.openCritical, 0);
  assert.equal(open.openWarnings, 1);
  assert.equal(open.unparsed, 1);
});
