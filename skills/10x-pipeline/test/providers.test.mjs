// Provider/host dispatch contracts through the real CLI; no external model is called.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, init, run, writeOverride, writeResult, readLogEntries, readMetaFile,
  writeMetaFile, writeLog, entry, planText, gitAvailable, gitInit, gitEnv, git, commitFiles,
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";
import { makeOpenspecProject } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { providerOf, policyProblems } from "../scripts/state.mjs";

after(cleanupAll);

const DEFAULT = JSON.parse(fs.readFileSync(new URL("../policy.json", import.meta.url), "utf8"));
const PRESET = JSON.parse(fs.readFileSync(new URL("../codex-policy.json", import.meta.url), "utf8"));
const GPT = { ...PRESET, codex: { profile: "fixture-git-profile" } };
const PASS = "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n";
const noGit = !gitAvailable() && "git is unavailable";

function snapshot(dir) {
  const files = {};
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) {
      files[name + "/"] = null;
      for (const [child, bytes] of Object.entries(snapshot(file))) files[`${name}/${child}`] = bytes;
    } else files[name] = fs.readFileSync(file);
  }
  return files;
}

test("the GPT overlay preserves all eight tier/effort positions without changing Claude defaults", () => {
  assert.deepEqual(Object.keys(PRESET), ["ladder"]);
  assert.deepEqual(PRESET.ladder.map((r) => r.effort), DEFAULT.ladder.map((r) => r.effort));
  assert.deepEqual(PRESET.ladder.map((r) => r.model), [
    "gpt-6-luna", "gpt-6.2-sol", "gpt-6.2-sol", "gpt-6.2-sol",
    "gpt-6.2-astra", "gpt-6.2-astra", "gpt-6.2-astra", "gpt-6.2-astra",
  ]);
  assert.equal(PRESET.ladder.every((r) => r.provider === "openai"), true);
  assert.deepEqual(DEFAULT.ladder.map((r) => r.model), ["haiku", "sonnet", "sonnet", "sonnet", "opus", "opus", "opus", "opus"]);
  assert.equal(DEFAULT.ladder.every((r) => providerOf(r) === "claude"), true);
  assert.deepEqual(DEFAULT.codex, { profile: null });
  assert.equal(policyProblems({ ...DEFAULT, ...GPT }), null);
  assert.equal(policyProblems({ ...DEFAULT, ...PRESET }), null);
  assert.equal(policyProblems({ ...DEFAULT, ...PRESET, codex: undefined }), null);
});

for (const chain of ["10x", "openspec"]) {
  const make = (policy) => chain === "openspec" ? makeOpenspecProject({ policy }) : makeProject({ policy });
  const start = (project, extra = []) => init(project, "fix typo", [...extra, "--chain", chain]);

  test(`${chain}: damaged metadata cannot change a logged run's provider mode`, () => {
    const p = make({});
    const first = start(p, ["--host=codex", "--provider-mode=split"]).json;
    assert.equal(first.action, "run");
    writeResult(p, { status: "done", note: "keep the pending result for recovery" });
    for (const damaged of ["not JSON", "[]", null]) {
      if (damaged === null) fs.unlinkSync(path.join(p.agentDir, "meta.json"));
      else writeMetaFile(p, damaged);
      const before = snapshot(p.changeDir);
      for (const args of [["init", p.id], ["next", p.id], ["usage", p.id, "1", "--tokens=1"], ["status", p.id, "--report"]]) {
        const response = run(p, [...args, "--chain", chain]);
        assert.match(response.json.reason, /Recover its metadata/);
        assert.deepEqual(snapshot(p.changeDir), before);
      }
      const status = run(p, ["status", p.id, "--chain", chain]);
      assert.equal(status.status, 0, status.stdout);
      assert.equal(status.json.host, null);
      assert.equal(status.json.providerMode, null);
      assert.match(status.json.metadataProblem, /Recover its metadata/);
      assert.equal(status.json.steps.find(step => step.n === first.n).provider, first.provider);
      assert.deepEqual(snapshot(p.changeDir), before);
    }
  });

  for (const host of ["claude", "codex"]) {
    for (const mode of ["claude", "codex", "split", undefined]) {
      test(`${chain} ${host} host, ${mode ?? "implicit"} mode resolves all roles`, () => {
        const project = make({});
        const flags = ["--host", host, ...(mode ? [`--provider-mode=${mode}`] : [])];
        const result = start(project, flags);
        assert.equal(result.json.action, "run", result.stdout);
        assert.equal(result.json.providerMode, mode ?? host);
        assert.equal(readMetaFile(project).providerMode, mode ?? host);
        const assignments = result.json.providersByStep;
        const hostProvider = host === "codex" ? "openai" : "claude";
        const other = host === "codex" ? "claude" : "openai";
        const roles = chain === "10x" ? Object.keys(DEFAULT.steps) : ["os-propose", "os-apply", "os-apply-fix", "os-verify", "os-archive"];
        assert.deepEqual(Object.keys(assignments).sort(), roles.sort());
        for (const role of roles) {
          const external = ["plan", "implement", "os-propose", "os-apply"].includes(role);
          const expected = mode === "split" ? (external ? other : hostProvider) : (mode ?? host) === "codex" ? "openai" : "claude";
          assert.equal(assignments[role], expected, role);
        }
        assert.equal(result.json.provider, assignments[result.json.step]);
        assert.equal(readMetaFile(project).provenance.flags.providerMode, mode ?? host);
      });
    }
  }

  test(`${chain}: default and explicit Claude dispatch, host and legacy status/report`, () => {
    for (const explicit of [false, true]) {
      const policy = explicit ? { ladder: DEFAULT.ladder.map((r) => ({ ...r, provider: "claude" })) } : {};
      const p = make(policy);
      const first = start(p);
      assert.equal(first.json.action, "run", first.stdout);
      assert.equal(first.json.provider, "claude");
      assert.equal(first.json.agent, "agent-smith:step");
      assert.equal(first.json.host, "claude");
      assert.equal(Object.hasOwn(first.json, "profile"), false);
      assert.equal(readMetaFile(p).host, "claude");
      const [logged] = readLogEntries(p);
      assert.equal(logged.provider, "claude");
      delete logged.provider;
      writeLog(p, [logged]);
      const meta = readMetaFile(p);
      delete meta.host;
      delete meta.providerMode;
      writeMetaFile(p, meta);
      const before = snapshot(p.changeDir);
      const plain = run(p, ["status", p.id, "--chain", chain]).json;
      assert.equal(plain.host, "claude");
      assert.equal(plain.providerMode, "legacy");
      assert.equal(plain.metadataProblem, undefined);
      assert.equal(plain.steps[0].provider, "claude");
      assert.deepEqual(snapshot(p.changeDir), before);
      const status = run(p, ["status", p.id, "--chain", chain, "--report"]);
      assert.equal(status.json.host, "claude");
      assert.equal(status.json.steps[0].provider, "claude");
      assert.match(fs.readFileSync(path.join(p.agentDir, "report.md"), "utf8"), /\| Provider \| Model \|/);
      assert.equal(Object.hasOwn(readLogEntries(p)[0], "provider"), false, "reading must not migrate historical entries");
    }
  });

  test(`${chain}: OpenAI dispatch records exact profile and provider provenance`, () => {
    const p = make(GPT);
    const first = start(p, ["--host=codex"]);
    assert.equal(first.json.action, "run", first.stdout);
    assert.equal(first.json.provider, "openai");
    assert.equal(Object.hasOwn(first.json, "agent"), false);
    assert.equal(first.json.profile, GPT.codex.profile);
    assert.equal(first.json.host, "codex");
    const [e] = readLogEntries(p);
    assert.equal(e.provider, "openai");
    assert.equal(e.profile, GPT.codex.profile);
    const meta = readMetaFile(p);
    assert.equal(meta.host, "codex");
    assert.match(meta.provenance.sections.codex, /^[a-f0-9]{16}$/);
    assert.equal(meta.provenance.flags.host, "codex");
    const st = run(p, ["status", p.id, "--chain", chain, "--report"]);
    assert.equal(st.json.steps[0].profile, GPT.codex.profile);
    assert.equal(st.json.steps[0].provider, "openai");
    assert.match(fs.readFileSync(path.join(p.agentDir, "report.md"), "utf8"), /\| openai \|/);
  });

  test(`${chain}: OpenAI execution inherits default configuration when no profile is selected`, () => {
    for (const policy of [PRESET, { ...PRESET, codex: { profile: null } }, { ...PRESET, codex: {} }]) {
      const p = make(policy);
      const first = start(p, ["--host", "codex"]);
      assert.equal(first.json.action, "run", first.stdout);
      assert.equal(first.json.provider, "openai");
      assert.equal(Object.hasOwn(first.json, "agent"), false);
      assert.equal(first.json.profile, null);
      assert.equal(readLogEntries(p)[0].profile, null);
      writeOverride(p, { ...GPT });
      writeResult(p, { status: "orchestrator-error", note: "no child started" });
      const again = run(p, ["next", p.id, "--chain", chain]);
      assert.equal(again.json.action, "run", again.stdout);
      assert.equal(again.json.profile, null, "a neutral retry must retain the original default-config choice");
    }
  });

  test(`${chain}: invalid provider/profile and unsupported host combinations reject without state writes`, () => {
    const cases = [
      [{ ladder: DEFAULT.ladder.map((r) => ({ ...r, provider: "other" })) }, [], /ladder\[0\]\.provider/],
      [{ ladder: DEFAULT.ladder.map((r) => ({ ...r, provider: null })) }, [], /ladder\[0\]\.provider/],
      [{ ...GPT, codex: { profile: "" } }, [], /codex\.profile/],
      [{ ...GPT, codex: { profile: " " } }, [], /codex\.profile/],
      [{ ...GPT, codex: { profile: 12 } }, [], /codex\.profile/],
      [{ ...GPT, codex: { profile: "bad\nprofile" } }, [], /codex\.profile/],
      [{}, ["--provider-mode", "openai"], /--provider-mode/],
      [{}, ["--provider-mode="], /--provider-mode/],
      [{ splitProviders: null }, ["--provider-mode=split"], /cannot replace.*splitProviders/],
      [{}, ["--host=other"], /--host/],
      [{}, ["--host"], /--host/],
    ];
    for (const [policy, flags, why] of cases) {
      const p = make(policy);
      const before = snapshot(path.join(p.root, "context"));
      const openspecBefore = snapshot(path.join(p.root, "openspec"));
      const res = start(p, flags);
      assert.equal(res.status, 1, res.stdout);
      assert.equal(res.json.action, "halt", res.stdout);
      assert.match(res.json.reason, why);
      assert.deepEqual(snapshot(path.join(p.root, "context")), before);
      assert.deepEqual(snapshot(path.join(p.root, "openspec")), openspecBefore);
    }
  });

  test(`${chain}: run host is immutable and changed policy cannot bypass host validation`, () => {
    const p = make(GPT);
    assert.equal(start(p, ["--host", "codex"]).json.action, "run");
    const before = snapshot(p.changeDir);
    const mismatch = start(p, ["--host", "claude"]);
    assert.equal(mismatch.status, 1, mismatch.stdout);
    assert.match(mismatch.json.reason, /Run host is codex/);
    assert.deepEqual(snapshot(p.changeDir), before);
    const modeConflict = start(p, ["--provider-mode", "claude"]);
    assert.equal(modeConflict.json.action, "halt");
    assert.deepEqual(snapshot(p.changeDir), before);
    const legacy = readMetaFile(p);
    delete legacy.providerMode;
    writeMetaFile(p, legacy);
    assert.equal(start(p, ["--provider-mode", "codex"]).json.action, "halt");
    writeOverride(p, { ladder: DEFAULT.ladder });
    writeResult(p, { status: "failed", note: "fixture" });
    const changed = snapshot(p.changeDir);
    const refused = run(p, ["next", p.id, "--chain", chain]);
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(refused.json.reason, /OpenAI-only ladder/);
    assert.deepEqual(snapshot(p.changeDir), changed);
  });

  test(`${chain}: neutral rerun preserves provider/profile/model/effort/prompt after policy changes`, () => {
    const p = make(GPT);
    const first = start(p, ["--host", "codex"]);
    assert.equal(first.json.action, "run", first.stdout);
    writeOverride(p, { ...GPT, codex: { profile: "replacement-profile" }, ladder: [{ ...PRESET.ladder[0], model: "new-model" }] });
    writeResult(p, { status: "orchestrator-error", note: "no child started" });
    const again = run(p, ["next", p.id, "--chain", chain]);
    assert.equal(again.json.action, "run", again.stdout);
    for (const key of ["n", "step", "provider", "profile", "host", "model", "effort", "prompt", "resultFile"]) {
      assert.deepEqual(again.json[key], first.json[key], key);
    }
    assert.equal(readLogEntries(p).filter((e) => !e.skipped).length, 1);
  });

  test(`${chain}: restricted native agent and advisor refuse OpenAI dispatch instead of silently dropping opt-ins`, () => {
    const step = chain === "10x" ? "plan" : "os-propose";
    for (const capability of [
      { agents: { restricted: true, steps: { [step]: "agent-smith:score" } } },
      { advisor: { enabled: true, templates: [step] } },
    ]) {
      const p = make({ ...GPT, ...capability });
      const result = start(p, ["--host", "codex"]);
      assert.equal(result.json.action, "halt", result.stdout);
      assert.match(result.json.reason, /OpenAI step .*cannot use/);
      assert.equal(readLogEntries(p).filter((e) => !e.skipped).length, 0);
    }
  });
}

test("a mixed ladder is supported under Claude without guessing providers from model names", () => {
  const ladder = DEFAULT.ladder.map((r, i) => i < 4 ? { ...r, provider: "openai" } : r);
  const p = makeProject({ policy: { ladder } });
  writeMetaFile(p, { id: p.id, goal: "fix typo" });
  const first = init(p, "fix typo");
  assert.equal(first.json.action, "run", first.stdout);
  assert.equal(first.json.provider, "openai");
    assert.equal(Object.hasOwn(first.json, "agent"), false);
  assert.equal(first.json.model, "sonnet", "model spelling must not choose a provider");
  assert.equal(first.json.host, "claude");
  assert.equal(first.json.profile, null);
});

test("mixed replacements keep ordinal gaps, provider-specific effort floors and shipped fallback rungs", () => {
  const ladder = DEFAULT.ladder.map((r, i) => i === 2 ? { model: "custom", effort: "high", provider: "openai" } : r);
  const steps = { plan: { baseTier: 2, minTier: 2, maxTier: 2 } };
  for (const [mode, provider, model] of [["codex", "openai", "custom"], ["claude", "claude", "sonnet"]]) {
    const p = makeProject({ policy: { ladder, steps } });
    const action = init(p, "fix typo", ["--rigor=standard", `--provider-mode=${mode}`]).json;
    assert.equal(action.provider, provider);
    assert.equal(action.model, model);
    assert.equal(action.effort, "high");
    assert.equal(readLogEntries(p).at(-1).tier, provider === "claude" ? 3 : 2);
  }
  const p = makeProject({ policy: { ladder: [...ladder, DEFAULT.ladder[7], PRESET.ladder[7]] } });
  const broken = init(p, "fix typo", ["--provider-mode=split"]);
  assert.equal(broken.json.action, "halt");
  assert.match(broken.json.reason, /Step plan uses openai.*ladder\[8\]/);
  assert.equal(fs.existsSync(p.agentDir), false);
});

test("a short provider ladder validates only its assigned steps, including the OpenSpec repair role", () => {
  const ladder = PRESET.ladder.slice(0, 4);
  const steps = { "os-propose": { baseTier: 3, maxTier: 3 }, "os-apply": { maxTier: 3 } };
  const start = (host, settings) => {
    const p = makeOpenspecProject({ policy: { ladder, steps: settings } });
    return init(p, "fix typo", ["--chain=openspec", `--host=${host}`, "--provider-mode=split"]).json;
  };
  assert.equal(start("claude", steps).action, "run");
  const denied = start("claude", { "os-propose": steps["os-propose"] });
  assert.match(denied.reason, /Step os-apply uses openai/);
  const repair = start("codex", { "os-verify": { maxTier: 3 } });
  assert.match(repair.reason, /Step os-apply-fix uses openai/);
});

test("late usage attaches to a recorded step after its provider ladder shrinks", () => {
  const p = makeProject({ policy: GPT });
  const first = init(p, "fix typo", ["--provider-mode=codex"]).json;
  writeResult(p, { status: "failed", note: "fixture" });
  assert.equal(run(p, ["next", p.id]).json.action, "run");
  writeOverride(p, { ladder: [PRESET.ladder[0]] });
  const late = run(p, ["usage", p.id, String(first.n), "--tokens=15"]);
  assert.equal(late.json.attached, true, late.stdout);
  assert.equal(readLogEntries(p).find((e) => e.n === first.n).usage.totalTokens, 15);
});

test("provider profile participates in provenance and drift tracking", () => {
  const p = makeProject({ policy: GPT });
  init(p, "fix typo", ["--host", "codex"]);
  const original = readMetaFile(p).provenance.sections.codex;
  writeOverride(p, { ...GPT, codex: { profile: "new-profile" } });
  writeResult(p, { status: "failed", note: "fixture" });
  const next = run(p, ["next", p.id]);
  assert.equal(next.json.action, "run", next.stdout);
  const meta = readMetaFile(p);
  assert.equal(meta.provenance.sections.codex, original, "provenance record is immutable");
  assert.ok(meta.provenance.drift.includes("codex"));
  assert.equal(next.json.profile, "new-profile");
});

function archivedAction(chain, capability = {}, selection = {}) {
  const policy = { ...GPT, ...capability };
  const p = chain === "10x"
    ? makeProject({ policy, plan: planText({ done: 1 }) })
    : makeOpenspecProject({ policy, proposal: true, design: true, specs: 1, tasks: { done: 1, open: 0 }, verify: PASS });
  if (chain === "10x") {
    fs.writeFileSync(path.join(p.changeDir, "change.md"), "---\nchange_id: demo\nstatus: impl_reviewed\ncreated: 2026-01-01\n---\n");
    writeReview(p, "plan-review", { verdict: "SOUND" });
    writeReview(p, "impl-review", { verdict: "APPROVED" });
  }
  const code = chain === "10x" ? "implement" : "os-apply";
  const review = chain === "10x" ? "impl-review" : "os-verify";
  writeLog(p, [entry(1, code, { provider: "openai", profile: GPT.codex.profile }), entry(2, review, { provider: "openai", profile: GPT.codex.profile })]);
  writeMetaFile(p, { id: p.id, goal: "fixture", host: "codex", archive: true, ...selection, ...(chain === "openspec" ? { chain } : {}) });
  gitInit(p);
  commitFiles(p, ["README.md"]);
  const before = git(p, ["rev-parse", "HEAD"]);
  return { p, before, result: run(p, ["next", p.id, "--chain", chain], { env: gitEnv(p) }) };
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: archive dispatch carries provider/profile without a numbered archive entry`, { skip: noGit }, () => {
    const { p, result } = archivedAction(chain);
    assert.equal(result.json.action, "archive", result.stdout);
    assert.equal(result.json.provider, "openai");
    assert.equal(Object.hasOwn(result.json, "agent"), false);
    assert.equal(result.json.profile, GPT.codex.profile);
    assert.equal(result.json.host, "codex");
    assert.equal(Object.hasOwn(result.json, "resultFile"), false);
    assert.equal(readLogEntries(p).filter((e) => !e.skipped).length, 2);
  });

  test(`${chain}: archive resolves the stored mode on the original host`, { skip: noGit }, () => {
    for (const [host, mode, provider] of [["codex", "claude", "claude"], ["claude", "split", "claude"], ["codex", "split", "openai"]]) {
      const { result } = archivedAction(chain, {}, { host, providerMode: mode });
      assert.equal(result.json.action, "archive", result.stdout);
      assert.equal(result.json.provider, provider);
      assert.equal(result.json.agent, provider === "claude" ? "agent-smith:step" : undefined);
      assert.match(result.json.prompt, /Archive|archive/);
    }
  });

  test(`${chain}: unsupported archive capability refuses before committing`, { skip: noGit }, () => {
    const step = chain === "10x" ? "archive" : "os-archive";
    const { p, before, result } = archivedAction(chain, { advisor: { enabled: true, templates: [step] } });
    assert.equal(result.json.action, "halt", result.stdout);
    assert.match(result.json.reason, /cannot use the native Claude advisor/);
    assert.equal(git(p, ["rev-parse", "HEAD"]), before);
    assert.equal(git(p, ["diff", "--cached", "--name-only"]), "");
  });
}

function comparisonSide(provider, tokens, policy = null) {
  const p = makeProject({ policy });
  writeLog(p, [entry(1, "implement", { ...(provider ? { provider } : {}), usage: { totalTokens: tokens } })]);
  writeMetaFile(p, { id: p.id, goal: "fixture", outcome: { action: "done" } });
  return p;
}

test("comparison pins provider identity and adds provider aggregates without removing legacy keys", () => {
  const baseline = comparisonSide("openai", 20);
  const routed = comparisonSide(null, 10, { prices: { usdPerMillionTokens: { sonnet: 1000000 } } });
  const args = ["compare", routed.id, "--baseline", baseline.root];
  const pinned = run(routed, args);
  assert.equal(pinned.json.pinned, false);
  assert.ok(pinned.json.reasons.includes("baseline-not-pinned"));
  const compared = run(routed, [...args, "--unpinned"]);
  assert.equal(compared.json.comparable, true, compared.stdout);
  assert.deepEqual(compared.json.baseline.tokens.byModel, { sonnet: 20 });
  assert.deepEqual(compared.json.baseline.tokens.byProviderModel, { "openai/sonnet": 20 });
  assert.deepEqual(compared.json.routed.tokens.byProviderTier, { "claude/sonnet/high": 10 });
  assert.deepEqual(compared.json.baseline.cost.byProviderModel, { "openai/sonnet": 20 });
  assert.ok(compared.json.warnings.includes("cross-provider-raw-tokens"));
  const markdown = run(routed, [...args, "--unpinned", "--format", "md"]);
  assert.match(markdown.stdout, /not normalized for tokenizer work or billing/);
});
