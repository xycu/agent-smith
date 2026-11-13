#!/usr/bin/env node
// Router for /agent-smith:10x-pipeline.
// Decides the next step, model and effort from disk artifacts (plan.md Progress,
// review verdicts) plus the run log. The orchestrator never picks a model itself.
//
// Usage (run from the project root):
//   node route.mjs init   <change-id> [--goal "<text>"] [--rigor lean|standard|thorough] [--archive] [--chrome [false]]   # Chrome is on unless --chrome false
//   node route.mjs next   <change-id>        # consumes context/changes/<id>/agent-smith/last-result.json
//   node route.mjs risk   <change-id>        # read-only: churn hot paths, plan hits, diff hits
//   node route.mjs status <change-id> [--report]   # --report (re)writes agent-smith/report.md
//   node route.mjs verify-archive <change-id> [--path <p>]   # read-only: is the change archived (files only, no git)
//   node route.mjs compare <change-id> --baseline <dir> [--routed <dir>] [--format md] [--unpinned]   # read-only: usage of a routed run against a baseline run
//                                      # --unpinned: the baseline is a routed run too (scorer off), for the scorer A/B
//   node route.mjs usage  <change-id> <n> --tokens N [--tool-uses N] [--duration-ms N]   # attach a late usage figure to executed step <n>
//   Every command takes --chain 10x|openspec. Without it, a run whose openspec/changes/<id>/agent-smith/meta.json
//   (or that of its archive folder) holds chain "openspec" is an OpenSpec run; any other run is 10x.
//
// Policy: <skill>/policy.json, deep-merged with context/foundation/agent-smith-policy.json if present.
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  ROOT, out, parseFlags, loadPolicy, policyProblems, readPlan, archiveDirs, archiveRoot, isArchiveName, frontmatterField, guardArchived, paths, readLog, executed,
  readMeta, writeLog, budgetSteps, isObject, rigorLevels, maxLevel, resolveRigor, SHA_RE, runGit, gitOut,
  ignoredProbePaths, measureRisk, riskMeasured, scoreConfig, halt, acquireRunLock, priceTable, loadPrices, estimateCost, roundUsd,
  providerOf, hostOf, hostProblem, dispatchTarget,
} from "./state.mjs";
import { scoreSummary } from "./preplan.mjs";
import { beforeExtra, doneNotes, manualRows, tierFor, render } from "./steps.mjs";
import { readOpenspec, decideOpenspec, missingChangeReason } from "./openspec.mjs";
import {
  writeReport, endRun, lessonLimits, attachResult, decide, promptText, checkPrompts, promptProblem, artifactsLine, stepAgent,
  advisorOn, neutralRetry, cleanUsage, dispatchProblem,
} from "./flow.mjs";
import {
  provenanceConfig, provenanceRecord, recordDrift, provenanceWarnings, authorityLine, gitMessage, notWorkTree,
  isolationOn, isolationCheck, worktreeLine, startCommit, stepCommit, fileTimes, setTimes, writeState, rollback,
  archiveDone, lateUsagePrecheck, lateUsageCommit,
} from "./isolation.mjs";

// The undo on halt: the next call that rolled back ends in a halt, so the final failure keeps its partial edits for a
// human. The branch goes back to the head the failed step left, the worktree holds the snapshot (files the step added
// are untracked again, staged files come back unstaged), the router state and the file times the step left are
// written back, and the entry says `kept`. Returns null or the git failure.
// The undo of a rollback made by this call of next, for main's catch: set after the rollback, cleared by every halt
// that runs the undo itself.
let undoOnError = null;

function undoRollback(p, meta, log, rb) {
  const hard = rb.g(["reset", "-q", "--hard", rb.ref]);
  if (hard.status !== 0) return `git reset --hard ${rb.ref} failed: ${gitMessage(hard)}.`;
  const mixed = rb.g(["reset", "-q", `${rb.ref}^`]);
  if (mixed.status !== 0) {
    return `git reset ${rb.ref}^ failed: ${gitMessage(mixed)}. The run branch now points at the snapshot commit of ${rb.ref}; ` +
      `run git reset -q ${rb.ref}^ in the run worktree before resuming.`;
  }
  delete rb.last.rolledBack;
  rb.last.kept = rb.ref;
  writeState(p, meta, log);
  setTimes(p, rb.left);
  return null;
}

// A 10x run needs change.md (same text as decide in flow.mjs); halt before any write of init, next and status --report.
function haltNoChangeMd(p, id) {
  if (!fs.existsSync(path.join(p.change, "change.md"))) halt(`No change folder. Run /10x-new ${id} first.`);
}

function next(id, policy, chain = "10x") {
  const p = paths(id, policy, chain);
  const openspec = chain === "openspec";
  guardArchived(p, id);
  // The router never creates an OpenSpec change (D3), so a missing folder halts before agent-smith/ is made.
  if (openspec && !fs.existsSync(p.change)) halt(`${missingChangeReason(id)} Nothing was written.`);
  if (!openspec) haltNoChangeMd(p, id);
  fs.mkdirSync(p.dir, { recursive: true });
  const meta = readMeta(p.meta, { id, goal: "" });
  const log = readLog(p.log);
  checkPrompts(policy);
  // An orchestrator-error result reruns the pending entry unchanged (or halts at limits.maxNeutralRetries) and exits;
  // any other case returns here and goes on as before.
  neutralRetry(p, id, meta, log, policy);
  attachResult(p, log, policy);
  // An isolated run commits what a successful step left before risk, rigor and decide read the files.
  stepCommit(p, id, meta, log, policy);
  // An isolated run rolls a failed step back before risk, rigor and decide read the files. When this call ends in a
  // halt instead of a next step, the rollback is undone first, so the partial edits stay for a human.
  const rb = rollback(p, id, meta, log, policy);
  // A router error later in this call ends it in main's catch, which runs the same undo.
  if (rb) undoOnError = () => undoRollback(p, meta, log, rb);
  const end = (result) => {
    undoOnError = null;
    if (rb && result.action === "halt") {
      const failed = undoRollback(p, meta, log, rb);
      if (failed) result = { ...result, reason: `${result.reason} The rollback was not undone: ${failed} The partial edits are kept under ${rb.ref}.` };
    }
    return endRun(p, id, meta, log, result);
  };

  const planNow = readPlan(p.plan);
  const risk = planNow.exists ? measureRisk(p, meta, log, policy) : null;
  const { level, changed } = resolveRigor(meta, log, policy, planNow, risk);
  // A policy, prompt or agent edit since the record adds its section to provenance.drift; meta.json is written only then.
  const drifted = recordDrift(meta, policy);
  if (changed || drifted) fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");

  // A subagent that cannot decide from evidence stops the run once. The ack lives on the log entry.
  const ranNow = executed(log);
  const lastRan = ranNow[ranNow.length - 1];
  if (lastRan?.signals?.needsHuman && !lastRan.needsHumanAck) {
    lastRan.needsHumanAck = true;
    return end({
      action: "halt",
      reason: `Step ${lastRan.n} (${lastRan.step}) needs a human: ${lastRan.signals.needsHuman}`,
      steps: ranNow.length,
    });
  }

  const budget = Math.max(1, policy.limits.maxTotalSteps + (policy.rigor.budgetDelta?.[level] ?? 0));

  // decide() may skip a step: log the skip and ask again. A step is skipped at most once per call, because a
  // logged skip marks it handled; a second skip of the same step is a router bug and halts. Different steps may
  // skip in turn (the three pre-plan gates can all close), and step names are finite, so the loop ends.
  const skippedNow = new Set();
  const loggedBefore = log.length;
  let d;
  for (;;) {
    // The OpenSpec chain has its own order (ADR-013 D4) and no score, pre-plan, executor or manual-verify step.
    d = openspec ? decideOpenspec(p, log, policy, meta) : decide(p, log, policy, meta, { level, risk });
    if (!d.skip) break;
    if (skippedNow.has(d.skip.step)) {
      return end({ action: "halt", reason: "Router error: skip loop", steps: executed(log).length });
    }
    skippedNow.add(d.skip.step);
    log.push({
      skipped: true,
      step: d.skip.step,
      reason: d.skip.reason,
      rigor: level,
      risk: d.skip.risk,
      score: d.skip.score,
      afterN: executed(log).length,
      at: Date.now(),
    });
    writeLog(p.log, log);
  }
  const ran = executed(log);
  if (d.done && meta.archive === true) return archiveDone(p, id, meta, log, policy, level, d);
  if (d.halt || d.done) {
    return end(d.done
      ? {
        action: "done", reason: d.reason, manualPending: d.manualPending, ...doneNotes(d), steps: ran.length,
        ...(openspec ? {} : { changeStatus: frontmatterField(path.join(p.change, "change.md"), "status") }),
      }
      : { action: "halt", reason: d.halt, steps: ran.length });
  }

  // The budget halts only a run that still has a step to run; done and decide's own halts win (issue #87).
  if (budgetSteps(log) >= budget) {
    // This halt decides nothing: the skips logged above are dropped, so the resumed run decides them again from the
    // files it then finds (a logged skip would stay handled, whatever the owner changes before the resume).
    if (log.length > loggedBefore) {
      log.length = loggedBefore;
      writeLog(p.log, log);
    }
    return end({ action: "halt", reason: `Step budget ${budget} spent.` });
  }

  // An OpenSpec run has no plan (p.plan is null), so tierFor gets the empty summary: no phase bump, no simple discount.
  const plan = readPlan(p.plan);
  // The score shift reads the summary from the log, never complexity.json.
  const riskClear = riskMeasured(risk) && risk.hits.length === 0;
  const { tier, fails, simple, cheap, tierWhy, scoreShift: shifted } = tierFor(d, ran, policy, plan, meta, level, { summary: scoreSummary(log), riskClear });
  if (fails >= policy.escalation.maxAttemptsPerStep) {
    return end({ action: "halt", reason: `${d.step} failed ${fails} times in a row. Last note: ${ran[ran.length - 1]?.result?.note ?? "none"}` });
  }

  // A continued run must not keep the outcome of an earlier end.
  if (meta.outcome) {
    delete meta.outcome;
    fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
  }

  const target = dispatchTarget(policy, tier);
  const template = d.step === "manual-verify" && target.provider === "openai" && meta.chrome !== false
    ? "manual-verify-openai" : d.template ?? d.step;
  const unsupported = dispatchProblem(policy, target, d.step, template);
  if (unsupported) return end({ action: "halt", reason: unsupported, steps: ran.length });
  const vars = {
    id, goal: meta.goal, verdict: d.verdict ?? "", artifacts: artifactsLine(p, policy), authority: authorityLine(p, policy, template),
    phase: d.phase === undefined ? "" : String(d.phase), lastPhase: d.lastPhase === undefined ? "" : String(d.lastPhase),
    retry: (d.retry ?? []).join(", "), uncommitted: (d.uncommitted ?? []).join(", "), failure: d.failure ?? "",
    unproven: (d.unproven ?? []).join(", ") || "none", browserRows: (d.browserRows ?? []).join(", ") || "none", evidence: d.evidenceNote ?? "",
    lessonMax: String(lessonLimits(policy).maxCandidates), lessonChars: String(lessonLimits(policy).maxChars),
    findings: d.findings ?? "",
  };
  // The working-directory rules of an isolated run (meta.isolated), the rendered template, then the advisor rules for a
  // listed template (advisor.enabled), then the generic suffix.
  const advisor = advisorOn(policy, template);
  const prompt = worktreeLine(policy, meta) + render(promptText(policy, template), vars).trim()
    + (advisor ? "\n\n" + render(promptText(policy, "advisor"), vars).trim() : "")
    + "\n\n" + promptText(policy, "suffix");
  const agent = stepAgent(policy, d.step);
  const entry = {
    n: ran.length + 1,
    step: d.step,
    template,
    skill: d.skill ?? policy.steps[d.step].skill,
    tier,
    ...target,
    reason: d.reason,
    tierWhy,
    simple,
    rigor: level,
    startedAt: Date.now(),
    // An OpenSpec step records the ticked rows of tasks.md instead of the plan-based fields.
    before: openspec ? { ticks: readOpenspec(p).tasks.complete } : { autoDone: plan.autoDone, ...beforeExtra(policy, template, plan) },
  };
  // The commit the step of an isolated run starts from: HEAD when the entry is created, after the step commit above.
  // A head that cannot be read (git missing, a timeout, no commit) halts before the step is logged: a step without a
  // startSha could not be rolled back.
  if (meta.isolated === true) {
    const head = runGit(["rev-parse", "HEAD"], { timeout: policy.isolation?.gitTimeoutMs });
    const startSha = head.status === 0 ? head.stdout.trim() : "";
    if (!SHA_RE.test(startSha)) {
      const why = head.timedOut ? `git timed out after ${policy.isolation?.gitTimeoutMs} ms`
        : head.status !== 0 ? `git rev-parse HEAD failed: ${gitMessage(head).replace(/\.$/, "")}`
          : `git rev-parse HEAD printed "${startSha.slice(0, 80)}"`;
      return end({ action: "halt", reason: `Cannot read the start commit of step ${entry.n} (${d.step}) of an isolated run: ${why}. Fix git in the run worktree, then run next again.`, steps: ran.length });
    }
    entry.startSha = startSha;
    // The file times decide compares, so a rollback can set them back after the reset (0 when a file is absent).
    entry.before.mtimes = fileTimes(p);
  }
  if (d.verdict) entry.verdict = d.verdict; // the review verdict that caused this step
  if (d.step === "score") entry.advisory = true; // the score only advises: a failed attempt is neutral and uses no budget
  if (agent) entry.agent = agent; // the restricted agent type the step was dispatched with (agents.restricted)
  if (advisor) entry.advisor = true; // the prompt carried the advisor rules (advisor.enabled); no consult is verified
  if (shifted) entry.scoreShift = shifted;
  if (cheap) entry.cheap = true; // the first-attempt drop survived the score shift, the clamp and the floor
  if (d.phase !== undefined) { entry.phase = d.phase; entry.lastPhase = d.lastPhase; }
  if (d.executor) entry.executor = d.executor;
  if (Array.isArray(d.retry)) entry.retry = d.retry;
  if (d.step === "manual-verify") {
    const copy = (rows) => rows.map(({ id: rid, text, done }) => ({ id: rid, text, done }));
    entry.before.manual = copy(manualRows(plan));
    entry.before.auto = copy(plan.phaseList.flatMap((ph) => ph.auto));
  }
  // The exact prompt, kept only while the step is pending, so a neutral rerun returns it unchanged; attachResult drops it.
  entry.pendingPrompt = prompt;
  log.push(entry);
  writeLog(p.log, log);
  out({
    action: "run",
    change: id, root: ROOT, chain,
    n: entry.n,
    step: d.step,
    ...(agent ? { agent } : {}),
    host: hostOf(meta),
    ...target,
    reason: `${d.reason}; tier ${tier} (${tierWhy})`,
    prompt,
    resultFile: path.relative(ROOT, p.result),
  });
}

// Read-only, files only, no git: did /10x-archive move this change and stamp it archived.
function verifyArchive(id, flags, chain = "10x") {
  const no = (reason, extra = {}) => out({ archived: false, reason, ...extra }, 1);
  if (chain === "openspec") verifyOpenspecArchive(id, flags, no);
  let name;
  if (flags.path !== undefined) {
    if (typeof flags.path !== "string") no("--path needs a folder");
    const m = flags.path.replace(/^\.\//, "").replace(/\/$/, "").match(/^context\/archive\/([^/\\]+)$/);
    if (!m || !archiveDirs(id).includes(m[1])) no(`--path is not an archive folder of ${id}`);
    name = m[1];
  } else {
    const found = archiveDirs(id);
    if (found.length > 1) {
      const folders = found.map((n) => `context/archive/${n}`);
      no(`More than one archive folder for ${id}: ${folders.join(", ")}. Pass --path.`, { ambiguous: folders });
    }
    name = found[0];
  }
  const p = paths(id);
  const stillThere = fs.existsSync(p.change);
  if (name === undefined) {
    const stamped = stillThere && frontmatterField(path.join(p.change, "change.md"), "status") === "archived";
    no(stamped
      ? `No archive folder for ${id}: context/changes/${id} is stamped archived but was not moved.`
      : `No archive folder for ${id} under context/archive/.`);
  }
  const rel = `context/archive/${name}`;
  const changeFile = path.join(ROOT, rel, "change.md");
  if (!fs.existsSync(changeFile)) no(`${rel}/change.md is missing.`);
  const status = frontmatterField(changeFile, "status");
  if (status !== "archived") no(`${rel}/change.md has status ${status === null ? "(none)" : status}, not archived.`);
  if (stillThere) no(`context/changes/${id} still exists next to ${rel}.`);
  const archivedAt = frontmatterField(changeFile, "archived_at");
  out({
    archived: true,
    path: rel,
    archivedAt: archivedAt === "null" ? null : archivedAt,
    report: fs.existsSync(path.join(ROOT, rel, "agent-smith/report.md")) ? `${rel}/agent-smith/report.md` : null,
  });
}

// verify-archive for an OpenSpec run (ADR-013 D5): archived when an archive folder of the id exists under
// openspec/changes/archive/ and openspec/changes/<id>/ is gone. OpenSpec stamps no status, so none is read. A --path
// that misses lists the archive folders of the id that do exist (a run that crossed midnight gets another date).
function verifyOpenspecArchive(id, flags, no) {
  const root = archiveRoot("openspec");
  const found = archiveDirs(id, "openspec");
  const others = (skip) => {
    const rest = found.filter((n) => n !== skip).map((n) => `${root}/${n}`);
    return rest.length ? ` Archive folders of ${id}: ${rest.join(", ")}.` : ` No archive folder of ${id} under ${root}/.`;
  };
  let name;
  if (flags.path !== undefined) {
    if (typeof flags.path !== "string") no("--path needs a folder");
    const clean = flags.path.replace(/^\.\//, "").replace(/\/$/, "");
    const m = clean.startsWith(`${root}/`) ? clean.slice(root.length + 1) : null;
    if (m === null || /[/\\]/.test(m) || !found.includes(m)) no(`--path ${clean} is not an archive folder of ${id}.${others(m)}`);
    name = m;
  } else {
    if (found.length > 1) {
      const folders = found.map((n) => `${root}/${n}`);
      no(`More than one archive folder for ${id}: ${folders.join(", ")}. Pass --path.`, { ambiguous: folders });
    }
    name = found[0];
  }
  const live = fs.existsSync(path.join(ROOT, "openspec/changes", id));
  if (name === undefined) {
    no(live ? `openspec/changes/${id} still exists and no archive folder of ${id} is under ${root}/, so the change is not archived.`
      : `No archive folder for ${id} under ${root}/.`);
  }
  const rel = `${root}/${name}`;
  if (live) no(`openspec/changes/${id} still exists next to ${rel}.`);
  out({
    archived: true,
    path: rel,
    report: fs.existsSync(path.join(ROOT, rel, "agent-smith/report.md")) ? `${rel}/agent-smith/report.md` : null,
  });
}

// Read-only: prints the churn numbers for a change.
function riskCommand(id, policy, chain = "10x") {
  const p = paths(id, null, chain);
  const meta = readMeta(p.meta, { id, goal: "" });
  const r = measureRisk(p, meta, readLog(p.log), policy);
  out({ source: r.source, hot: r.hot, planPaths: r.planPaths, unclassified: r.unclassified, planHits: r.planHits, diffHits: r.diffHits, level: r.level });
}

// ---- compare --------------------------------------------------------------

// Read-only: compares the usage of a routed run with a baseline run of the same change.
// Each side is a run folder in its own checkout. Nothing is written, nothing is routed.

const BASELINE_PIN = { provider: "claude", model: "sonnet", effort: "high" };

// A figure counts only when it is a non-negative safe integer; run.jsonl may be edited by hand.
function validFigure(v) {
  return Number.isSafeInteger(v) && v >= 0;
}

// Floor division for BigInt (the built-in operator truncates toward zero).
function floorDivBig(a, b) {
  const q = a / b;
  return a % b !== 0n && (a < 0n) !== (b < 0n) ? q - 1n : q;
}

// Find the agent-smith folder of one side: the folder itself, the live change folder, then the archive. The chain picks
// the roots: context/changes and context/archive (10x), openspec/changes and openspec/changes/archive (OpenSpec).
function locateSide(dirArg, id, side, chain = "10x") {
  const base = path.resolve(ROOT, dirArg);
  const live = path.join(base, chain === "openspec" ? "openspec/changes" : "context/changes", id, "agent-smith");
  const archiveDir = path.join(base, archiveRoot(chain));
  let archived = [];
  try {
    archived = fs.readdirSync(archiveDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && isArchiveName(d.name, id, chain)).map((d) => d.name).sort();
  } catch { /* no archive folder */ }
  const hasLog = (dir) => fs.existsSync(path.join(dir, "run.jsonl"));
  const tried = [base, live, archived.length ? path.join(archiveDir, `${archived[0]}/agent-smith`) : path.join(archiveDir, `<date>-${id}/agent-smith`)];
  if (hasLog(base)) return { source: "folder", dir: base, alsoArchived: false };
  if (hasLog(live)) return { source: "changes", dir: live, alsoArchived: archived.length > 0 };
  if (archived.length > 1) {
    halt(`${side}: more than one archive folder for ${id} under ${archiveDir}: ${archived.join(", ")}. Pass the exact folder.`);
  }
  if (archived.length === 1 && hasLog(path.join(archiveDir, archived[0], "agent-smith"))) {
    return { source: "archive", dir: path.join(archiveDir, archived[0], "agent-smith"), alsoArchived: false };
  }
  return halt(`${side}: no run.jsonl found for ${id}. Looked in: ${tried.map((t) => path.join(t, "run.jsonl")).join(", ")}.`);
}

// `producedFile` is the score file of the policy compare loads: a produced file, dropped from inputFiles like plan.md.
// `prices` is the price table of that policy, so both sides are priced alike; null gives `cost: null`.
function readSide(dirArg, id, side, producedFile, chain = "10x", prices = null) {
  const found = locateSide(dirArg, id, side, chain);
  const log = readLog(path.join(found.dir, "run.jsonl")).filter(isObject); // readLog lets a JSON array through
  const meta = readMeta(path.join(found.dir, "meta.json"), {});
  const steps = executed(log);
  const skipped = log.filter((e) => e.skipped).map((e) => (typeof e.step === "string" ? e.step : "unknown"));
  const figure = (key) => {
    let total = 0;
    let withFigures = 0;
    for (const e of steps) {
      const v = e.usage?.[key];
      // A running total past the safe-integer range counts as a missing figure, so the pair is not comparable.
      if (validFigure(v) && !Number.isSafeInteger(total + v)) continue;
      if (validFigure(v)) { total += v; withFigures++; }
    }
    return { total, stepsWithFigures: withFigures };
  };
  // Tokens per model alias, and per tier as <model>/<effort>: byModel cannot show an effort move.
  const byModel = {};
  const byTier = {};
  const byProviderModel = {};
  const byProviderTier = {};
  for (const e of steps) {
    const v = e.usage?.totalTokens;
    if (!validFigure(v)) continue;
    const model = typeof e.model === "string" && e.model ? e.model : "unknown";
    const effort = typeof e.effort === "string" && e.effort ? e.effort : "unknown";
    byModel[model] = (byModel[model] ?? 0) + v;
    byTier[`${model}/${effort}`] = (byTier[`${model}/${effort}`] ?? 0) + v;
    const providerModel = `${providerOf(e)}/${model}`;
    byProviderModel[providerModel] = (byProviderModel[providerModel] ?? 0) + v;
    byProviderTier[`${providerModel}/${effort}`] = (byProviderTier[`${providerModel}/${effort}`] ?? 0) + v;
  }
  // The cost estimate at a blended rate: USD in total and per alias over priced steps, summed before rounding.
  let cost = null;
  if (prices) {
    const est = estimateCost(steps, prices);
    const usdByModel = {};
    const usdByProviderModel = {};
    for (const e of steps) {
      const usd = est.perEntry[e.n];
      if (typeof usd !== "number") continue;
      const model = typeof e.model === "string" && e.model ? e.model : "unknown";
      usdByModel[model] = (usdByModel[model] ?? 0) + usd;
      const providerModel = `${providerOf(e)}/${model}`;
      usdByProviderModel[providerModel] = (usdByProviderModel[providerModel] ?? 0) + usd;
    }
    cost = {
      usd: est.priced ? roundUsd(est.usd) : null, priced: est.priced, withFigures: est.withFigures, unpriced: est.unpriced,
      byModel: Object.fromEntries(Object.entries(usdByModel).map(([m, v]) => [m, roundUsd(v)])),
      byProviderModel: Object.fromEntries(Object.entries(usdByProviderModel).map(([m, v]) => [m, roundUsd(v)])),
    };
  }
  const changeDir = path.basename(found.dir) === "agent-smith" ? path.dirname(found.dir) : null;
  // The files a run produces are not inputs: plan.md and plan-brief.md for 10x; the planning artifacts os-propose writes
  // and the verdict os-verify writes for OpenSpec.
  const produced = new Set(chain === "openspec" ? ["proposal.md", "design.md", "tasks.md", "verify.md", producedFile] : ["plan.md", "plan-brief.md", producedFile]);
  let plan = null;
  let inputFiles = null;
  if (changeDir) {
    const pl = readPlan(path.join(changeDir, "plan.md"));
    if (pl.exists) plan = { phases: pl.phases, rows: pl.rows };
    try {
      inputFiles = fs.readdirSync(changeDir, { withFileTypes: true })
        .filter((d) => d.isFile() && !produced.has(d.name))
        .map((d) => d.name).sort();
    } catch { inputFiles = null; }
  }
  return {
    source: found.source,
    dir: found.dir,
    goal: typeof meta.goal === "string" ? meta.goal : null,
    baseSha: typeof meta.baseSha === "string" ? meta.baseSha : null,
    rigor: meta.rigor?.level ?? null,
    outcome: meta.outcome?.action ?? null,
    provenance: isObject(meta.provenance) ? meta.provenance : null,
    steps: steps.length,
    skipped,
    failedAttempts: steps.filter((e) => e.ok === false && !e.fallback).length,
    plan,
    inputFiles,
    tokens: { ...figure("totalTokens"), byModel, byTier, byProviderModel, byProviderTier },
    cost,
    toolUses: figure("toolUses"),
    durationMs: figure("durationMs"),
    alsoArchived: found.alsoArchived,
    pinned: steps.length > 0 && steps.every((e) => providerOf(e) === BASELINE_PIN.provider && e.model === BASELINE_PIN.model && e.effort === BASELINE_PIN.effort),
  };
}

// The A9 decision on exact tokens. A target with at most 2 decimals is decided in exact integer math;
// any other target uses a float test with a relative slack that only absorbs the rounding of target * baseline.
function dropMet(diff, baseline, target) {
  const cents = Math.round(target * 100);
  if (cents / 100 === target) return BigInt(diff) * 10000n >= BigInt(cents) * BigInt(baseline);
  const right = target * baseline;
  return diff * 100 >= right - 4 * Number.EPSILON * Math.max(1, right);
}

// The exact drop rounded down to 2 decimals.
function dropPercentOf(diff, baseline) {
  return Number(floorDivBig(BigInt(diff) * 10000n, BigInt(baseline))) / 100;
}

function comparePair(id, flags, policy, chain = "10x") {
  // Flags and the target are checked before anything is read.
  for (const key of ["baseline", "routed", "format"]) {
    if (flags[key] !== undefined && typeof flags[key] !== "string") halt(`Missing value for --${key}.`);
  }
  if (flags.baseline === undefined) halt("compare needs --baseline <dir>: compare <change-id> --baseline <dir> [--routed <dir>] [--format md] [--unpinned].");
  if (flags.format !== undefined && flags.format !== "json" && flags.format !== "md") {
    halt(`Invalid --format ${flags.format}. Use json or md.`);
  }
  // --unpinned is checked like --archive of init: a bare flag or "true" turns it on, "false" turns it off.
  let unpinned = false;
  if (flags.unpinned !== undefined) {
    if (flags.unpinned === true || flags.unpinned === "true") unpinned = true;
    else if (flags.unpinned === "false") unpinned = false;
    else halt(`Invalid --unpinned ${flags.unpinned}. Use --unpinned, --unpinned true or --unpinned false.`);
  }
  let target = policy.compare?.targetDropPercent;
  if (target === undefined) target = null;
  if (target !== null && !(typeof target === "number" && Number.isFinite(target) && target >= 0 && target <= 100)) {
    halt(`Invalid compare.targetDropPercent ${JSON.stringify(target)}. Use null or a number from 0 to 100.`);
  }

  // The score file is produced by the run, so only the scorer-on arm of an A/B pair has it.
  const producedFile = scoreConfig(policy)?.file ?? "complexity.json";
  // Prices come from the policy of the project that runs compare, as the target does. Display only: no verdict reads them.
  const prices = priceTable(policy);
  const baseline = readSide(flags.baseline, id, "baseline", producedFile, chain, prices);
  const routed = readSide(typeof flags.routed === "string" ? flags.routed : ROOT, id, "routed", producedFile, chain, prices);

  const reasons = [];
  const warnings = [];
  // --unpinned waives only the pin: the baseline of a scorer A/B pair is a routed run with the scorer off.
  if (baseline.steps > 0 && !baseline.pinned && !unpinned) reasons.push("baseline-not-pinned");
  if (unpinned) warnings.push("baseline-unpinned");
  const sides = [["baseline", baseline], ["routed", routed]];
  const providers = new Set(sides.flatMap(([, side]) => Object.keys(side.tokens.byProviderModel).map((key) => key.split("/")[0])));
  if (providers.size > 1) warnings.push("cross-provider-raw-tokens");
  for (const [name, s] of sides) {
    if (s.steps === 0) reasons.push(`no-steps:${name}`);
    if (s.outcome !== "done") reasons.push(`outcome-not-done:${name}`);
    if (s.steps > 0 && s.tokens.stepsWithFigures < s.steps) reasons.push(`usage-incomplete:${name}`);
  }
  const baselineComplete = baseline.steps > 0 && baseline.tokens.stepsWithFigures === baseline.steps;
  if (baselineComplete && baseline.tokens.total === 0) reasons.push("baseline-total-zero");

  if (baseline.goal !== routed.goal) warnings.push("goal-mismatch");
  if (baseline.baseSha !== routed.baseSha) warnings.push("baseSha-mismatch");
  if (baseline.skipped.length) warnings.push(`baseline-skipped-steps:${baseline.skipped.length}`);
  if (baseline.inputFiles && routed.inputFiles) {
    const differ = [
      ...baseline.inputFiles.filter((n) => !routed.inputFiles.includes(n)),
      ...routed.inputFiles.filter((n) => !baseline.inputFiles.includes(n)),
    ].sort();
    if (differ.length) warnings.push(`input-files-differ:${differ.join(",")}`);
  }
  for (const [name, s] of sides) if (s.alsoArchived) warnings.push(`archive-also-present:${name}`);
  // A step with a token figure and no price leaves that side's cost short; comparable does not read it.
  for (const [name, s] of sides) if (s.cost && s.cost.unpriced.length) warnings.push(`cost-incomplete:${name}`);
  // The expected set follows the flag, never baseline.pinned: a pinned baseline changes ladder, rigor and score by design.
  const expected = provenanceConfig(policy).expected[unpinned ? "unpinned" : "pinned"];
  warnings.push(...provenanceWarnings(sides.map(([name, s]) => [name, s.provenance]), expected));

  const comparable = reasons.length === 0;
  let dropPercent = null;
  let verdict = "not comparable";
  if (comparable) {
    const diff = baseline.tokens.total - routed.tokens.total;
    dropPercent = dropPercentOf(diff, baseline.tokens.total);
    if (unpinned) verdict = "unpinned";
    else verdict = target === null ? "target not set" : dropMet(diff, baseline.tokens.total, target) ? "met" : "not met";
  }
  const strip = ({ alsoArchived, pinned, ...rest }) => rest;
  return {
    change: id,
    baseline: strip(baseline),
    routed: strip(routed),
    pinned: baseline.pinned,
    comparable,
    reasons,
    warnings,
    dropPercent,
    targetDropPercent: target,
    verdict,
  };
}

// Markdown form of the same pair object, so the two outputs cannot disagree.
function compareMarkdown(pair) {
  const { baseline: b, routed: r } = pair;
  const row = (label, f) => `| ${label} | ${f(b)} | ${f(r)} |`;
  const list = (a) => (a.length ? a.join(", ") : "none");
  const withSteps = (key) => (s) => `${s[key].total} (${s[key].stepsWithFigures} of ${s.steps})`;
  const models = (s) => {
    const names = Object.keys(s.tokens.byModel).sort();
    return names.length ? names.map((m) => `${m} ${s.tokens.byModel[m]}`).join(", ") : "none";
  };
  const tiers = (s) => {
    const names = Object.keys(s.tokens.byTier).sort();
    return names.length ? names.map((t) => `${t} ${s.tokens.byTier[t]}`).join(", ") : "none";
  };
  // Cost rows print only when compare ran with prices; both sides are priced from the same table.
  const priced = b.cost !== null && r.cost !== null;
  const costCell = (s) => `${s.cost.usd === null ? "-" : `$${s.cost.usd.toFixed(2)}`} (${s.cost.priced} of ${s.cost.withFigures} priced)`;
  const costModels = (s) => {
    const names = Object.keys(s.cost.byModel).sort();
    return names.length ? names.map((m) => `${m} $${s.cost.byModel[m].toFixed(2)}`).join(", ") : "none";
  };
  return [
    `# Usage comparison: ${pair.change}`,
    "",
    "| | Baseline | Routed |",
    "| --- | --- | --- |",
    row("Outcome", (s) => s.outcome ?? "none"),
    row("Rigor", (s) => s.rigor ?? "none"),
    row("Steps", (s) => s.steps),
    row("Skipped", (s) => list(s.skipped)),
    row("Failed attempts", (s) => s.failedAttempts),
    row("Tokens", withSteps("tokens")),
    ...(priced ? [row("Cost (estimate)", costCell)] : []),
    row("Tool uses", withSteps("toolUses")),
    row("Duration (ms)", withSteps("durationMs")),
    row("Plan phases and rows", (s) => (s.plan ? `${s.plan.phases} and ${s.plan.rows}` : "none")),
    row("Source", (s) => s.source),
    "",
    `Tokens by model, baseline: ${models(b)}`,
    `Tokens by model, routed: ${models(r)}`,
    `Tokens by tier, baseline: ${tiers(b)}`,
    `Tokens by tier, routed: ${tiers(r)}`,
    ...(priced ? [`Cost by model, baseline: ${costModels(b)}`, `Cost by model, routed: ${costModels(r)}`] : []),
    `Tokens by provider/model, baseline: ${Object.entries(b.tokens.byProviderModel).sort().map(([key, value]) => `${key} ${value}`).join(", ") || "none"}`,
    `Tokens by provider/model, routed: ${Object.entries(r.tokens.byProviderModel).sort().map(([key, value]) => `${key} ${value}`).join(", ") || "none"}`,
    "",
    `Baseline pinned to sonnet at high effort: ${pair.pinned ? "yes" : "no"}`,
    `Drop: ${pair.dropPercent === null ? "none" : `${pair.dropPercent}%`} (rounded down to 2 decimals; the verdict uses exact tokens)`,
    `Target: ${pair.targetDropPercent === null ? "not set" : `${pair.targetDropPercent}%`}`,
    `Verdict: ${pair.verdict}. Unit: raw tokens, a proxy for the weekly limit.${priced ? " Cost is an estimate at a blended rate and does not enter the verdict." : ""}`,
    ...(pair.warnings.includes("cross-provider-raw-tokens") ? ["Cross-provider token counts are raw; they are not normalized for tokenizer work or billing."] : []),
    `Reasons: ${list(pair.reasons)}`,
    `Warnings: ${list(pair.warnings)}`,
    "",
  ].join("\n");
}

function compareCommand(id, flags, policy, chain = "10x") {
  const pair = comparePair(id, flags, policy, chain);
  if (flags.format === "md") {
    process.stdout.write(compareMarkdown(pair));
    process.exit(0);
  }
  out(pair);
}

function status(id, flags, chain = "10x", policy = null) {
  const p = paths(id, null, chain);
  // A moved OpenSpec run halts as archived instead of printing an empty log.
  if (chain === "openspec") guardArchived(p, id);
  const log = readLog(p.log);
  // The cost estimate, only when the merged policy prices a model; without prices status has no cost key.
  const prices = loadPrices();
  const cost = prices ? estimateCost(executed(log), prices) : null;
  const res = {
    change: id,
    host: hostOf(readMeta(p.meta, {})),
    prComment: readMeta(p.meta, {}).prComment === true,
    rigor: readMeta(p.meta, {}).rigor?.level ?? null,
    steps: log.map((e) => e.skipped ? {
      skipped: true, step: e.step, reason: e.reason, rigor: e.rigor ?? null, afterN: e.afterN ?? null, risk: e.risk ?? null,
      ...(e.score ? { score: e.score } : {}),
    } : ({
      n: e.n, step: e.step, template: e.template ?? null, provider: providerOf(e), model: e.model, effort: e.effort, simple: e.simple ?? null,
      ...(providerOf(e) === "openai" ? { profile: e.profile ?? null } : {}),
      ok: e.ok ?? null, verified: e.verified ?? null, note: e.result?.note ?? null, reason: e.reason,
      usage: e.usage ?? null,
      ...(cost ? { cost: typeof cost.perEntry[e.n] === "number" ? roundUsd(cost.perEntry[e.n]) : null } : {}),
      ...(e.step === "manual-verify" ? {
        ticked: e.ticked?.length ?? 0,
        unproven: e.unproven?.length ?? 0,
        proved: (Array.isArray(e.proved) ? e.proved : []).reduce((acc, r) => {
          const kind = isObject(r) && typeof r.kind === "string" ? r.kind : "other";
          acc[kind] = (acc[kind] ?? 0) + 1;
          return acc;
        }, {}),
        pending: Array.isArray(e.pending) ? e.pending.length : 0,
        ...(Array.isArray(e.browserRows) ? { browserRows: e.browserRows.length } : {}),
        ...(isObject(e.unprovenWhy) ? { unprovenWhy: e.unprovenWhy } : {}),
      } : {}),
      ...(e.score ? { score: e.score } : {}),
      ...(e.invalid ? { invalid: e.invalid } : {}),
      ...(e.scoreShift ? { scoreShift: e.scoreShift } : {}),
      ...(typeof e.agent === "string" ? { agent: e.agent } : {}),
      // The number of neutral reruns after orchestrator faults (limits.maxNeutralRetries), only when there was one.
      ...(Array.isArray(e.neutralRetries) && e.neutralRetries.length > 0 ? { neutralRetries: e.neutralRetries.length } : {}),
      ...(isObject(e.review) ? { review: e.review } : {}),
      ...(typeof e.commit === "string" ? { commit: e.commit.slice(0, 7) } : {}),
      ...(Array.isArray(e.swept) && e.swept.length > 0 ? { swept: e.swept } : {}),
      ...(typeof e.rolledBack === "string" ? { rolledBack: e.rolledBack } : {}),
      ...(typeof e.kept === "string" ? { kept: e.kept } : {}),
    })),
  };
  // status stays usable on a broken policy; the fault shows here, and init, next and usage halt on it.
  const policyProblem = policyProblems(policy) ?? promptProblem(policy);
  if (policyProblem) res.policyProblem = policyProblem;
  if (cost) {
    res.cost = {
      usd: cost.priced ? roundUsd(cost.usd) : null, currency: "USD", rate: "blended",
      priced: cost.priced, withFigures: cost.withFigures, unpriced: cost.unpriced,
    };
  }
  // The OpenSpec state the router reads from files, as the contract test compares it with `openspec instructions apply`.
  if (chain === "openspec") {
    const os = readOpenspec(p);
    res.openspec = { planningComplete: os.planningComplete, tasks: { total: os.tasks.total, complete: os.tasks.complete } };
  }
  if (flags.report) {
    guardArchived(p, id);
    if (chain === "openspec") {
      if (!fs.existsSync(p.change)) halt(`No change folder openspec/changes/${id}.`);
    } else haltNoChangeMd(p, id);
    const meta = readMeta(p.meta, { id, goal: "" });
    res.report = writeReport(p, id, meta, log);
  }
  out(res);
}

// ---- late usage figure ------------------------------------------------------

// The three flags of `usage` and the figure key each one sets.
const USAGE_FLAGS = [["tokens", "totalTokens"], ["tool-uses", "toolUses"], ["duration-ms", "durationMs"]];

// Attaches a usage figure that reached the orchestrator after `next` ran to executed step <n>. A refusal prints
// { action: "usage", attached: false, n, reason }, exits 1 and writes nothing. A figure is never overwritten.
function usageCommand(id, rest, flags, policy, chain = "10x") {
  const refuse = (reason, n = null) => out({ action: "usage", attached: false, n, reason }, 1);
  // Arguments first, before anything is read. <n> directly follows the change id; a flag there is no step number.
  const rawN = rest[0];
  if (typeof rawN !== "string" || !/^[1-9]\d*$/.test(rawN) || !Number.isSafeInteger(Number(rawN))) {
    refuse("Usage: route.mjs usage <change-id> <n> --tokens N [--tool-uses N] [--duration-ms N] [--chain 10x|openspec]; <n> is the step number, a positive integer that directly follows the change id.");
  }
  const n = Number(rawN);
  const raw = {};
  for (const [flag, key] of USAGE_FLAGS) {
    if (flags[flag] === undefined) continue;
    const v = flags[flag];
    if (typeof v !== "string" || !/^\d+$/.test(v) || !Number.isSafeInteger(Number(v))) {
      refuse(`--${flag} needs a non-negative integer, got ${v === true ? "no value" : JSON.stringify(v)}.`, n);
    }
    raw[key] = Number(v);
  }
  const usage = cleanUsage(raw);
  if (!usage) refuse("Give at least one of --tokens, --tool-uses and --duration-ms.", n);

  const p = paths(id, policy, chain);
  guardArchived(p, id, chain);
  if (chain === "openspec" && !fs.existsSync(p.change)) refuse(missingChangeReason(id), n);
  if (!fs.existsSync(p.log)) refuse(`No run log for ${id}.`, n);
  const log = readLog(p.log);
  const entry = executed(log).find((e) => e.n === n);
  if (!entry) refuse(`Step ${n} is not logged.`, n);
  if (!isObject(entry.result)) refuse(`Step ${n} (${entry.step}) has no result yet; put the figure in its result file.`, n);
  const base = { action: "usage", attached: true, n, step: entry.step, usage };
  if (entry.usage !== undefined) {
    if (isDeepStrictEqual(entry.usage, usage)) out({ ...base, unchanged: true, report: null, commit: null });
    refuse(`Step ${n} (${entry.step}) already has the figure ${JSON.stringify(entry.usage)}; a figure is never overwritten.`, n);
  }
  const meta = readMeta(p.meta, { id, goal: "" });
  const ended = isObject(meta.outcome);
  // The archive state: the run is done, started with --archive, and the folder is committed for /10x-archive. Everything
  // is checked before the first write, because the write dirties the folder and only a commit cleans it again.
  const archiveState = ended && meta.outcome.action === "done" && meta.archive === true;
  if (archiveState) {
    const why = lateUsagePrecheck(p, id, meta, policy);
    if (why) refuse(why, n);
  }
  const oldBytes = archiveState ? [p.log, p.report].map((file) => [file, fs.existsSync(file) ? fs.readFileSync(file) : null]) : [];
  entry.usage = usage;
  entry.usageLate = true;
  writeLog(p.log, log);
  // An ended run has a report; rewrite it so the Tokens column, the totals and the cost include the figure.
  let report = null;
  let reportError;
  if (ended) {
    try { report = writeReport(p, id, meta, log); } catch (e) { reportError = e.message; }
  }
  if (!archiveState) out({ ...base, unchanged: false, report, ...(reportError ? { reportError } : {}), commit: null });

  // The archive state: commit the folder before the archive subagent starts. A failure before the commit exists puts
  // the old bytes back, so the folder stays as committed (the router has already unstaged its own add).
  const restore = () => {
    for (const [file, bytes] of oldBytes) {
      if (bytes === null) { try { fs.unlinkSync(file); } catch { /* already gone */ } } else fs.writeFileSync(file, bytes);
    }
  };
  if (reportError) {
    restore();
    refuse(`report.md was not written: ${reportError}. The figure was not kept; the change folder is as committed.`, n);
  }
  const res = lateUsageCommit(p, id, policy, n);
  if (res.error && !res.made) {
    restore();
    refuse(`${res.error} The figure was not kept; the change folder is as committed.`, n);
  }
  out({
    ...base, unchanged: false, report, commit: res.commit ? res.commit.slice(0, 7) : null,
    ...(res.error ? { reason: res.error } : {}),
  });
}

// ---- chain ----------------------------------------------------------------

const CHAINS = ["10x", "openspec"];

// The chain an earlier init stored for this id: the meta.json of openspec/changes/<id>/agent-smith/ or, when the live
// folder is gone, of its archive folder. { chain: "openspec" | null, live, tenx }; a 10x run stores no chain key, so
// `tenx` is true when a live 10x run holds its own agent-smith/meta.json, and only then does --chain openspec contradict it.
// An archived OpenSpec run does not claim a name that a 10x change uses, live (context/changes/<id>/) or archived
// (context/archive/<date>-<id>/), so the 10x skill, which never passes --chain, keeps reaching its own change.
function storedChain(id) {
  const p = paths(id, null, "openspec");
  const isOpenspec = (file) => readMeta(file, {}).chain === "openspec";
  const tenx = fs.existsSync(paths(id, null, "10x").meta);
  if (fs.existsSync(p.change)) return { chain: isOpenspec(p.meta) ? "openspec" : null, live: true, tenx };
  if (fs.existsSync(path.join(ROOT, "context/changes", id)) || archiveDirs(id, "10x").length) return { chain: null, live: false, tenx };
  const root = archiveRoot("openspec");
  const moved = archiveDirs(id, "openspec").some((name) => isOpenspec(path.join(ROOT, root, name, "agent-smith/meta.json")));
  return { chain: moved ? "openspec" : null, live: false, tenx };
}

// The chain of this command. A --chain that contradicts the stored chain halts. Without the flag the stored chain
// applies, else 10x. init without the flag halts on a live OpenSpec run; on a name only an archived OpenSpec run
// holds it resolves to openspec, so the archive guard halts it as archived.
function resolveChain(cmd, id, flags) {
  const stored = storedChain(id);
  if (flags.chain === undefined) {
    if (cmd === "init" && stored.chain === "openspec" && stored.live) {
      halt(`Change ${id} is an OpenSpec run: openspec/changes/${id}/agent-smith/meta.json holds chain "openspec". A 10x init does not apply; resume it with --chain openspec. Nothing was written.`);
    }
    return stored.chain ?? "10x";
  }
  if (stored.chain !== null && flags.chain !== stored.chain) {
    halt(`Change ${id} is an OpenSpec run (its agent-smith/meta.json holds chain "openspec"), so --chain ${flags.chain} does not apply. Drop --chain or pass --chain openspec.`);
  }
  if (flags.chain === "openspec" && stored.chain === null && stored.tenx) {
    halt(`Change ${id} is a 10x run (context/changes/${id}/agent-smith/meta.json exists), so --chain openspec does not apply. Drop --chain or pass --chain 10x. Nothing was written.`);
  }
  return flags.chain;
}

// ---- main -----------------------------------------------------------------

// The flags init reads; any other flag halts it.
const INIT_FLAGS = ["goal", "rigor", "archive", "chrome", "chain", "host", "pr-comment"];

function main() {
  const [cmd, id, ...rest] = process.argv.slice(2);
  if (!cmd || !id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    halt("Usage: route.mjs init|next|status|risk <change-id> [--goal text] [--rigor level] [--archive] [--chrome [false]] [--report] | usage <change-id> <n> --tokens N [--tool-uses N] [--duration-ms N] | verify-archive <change-id> [--path <p>] | compare <change-id> --baseline <dir> [--routed <dir>] [--format md] [--unpinned]; every command takes [--chain 10x|openspec]");
  }
  const flags = parseFlags(rest, ["goal"]);
  // --chain is checked before anything is read.
  if (flags.chain !== undefined && !CHAINS.includes(flags.chain)) {
    halt(`Invalid --chain ${flags.chain === true ? "(no value)" : flags.chain}. Use one of: ${CHAINS.join(", ")}.`);
  }
  if (flags.host !== undefined && (cmd !== "init" || !["claude", "codex"].includes(flags.host))) {
    halt("--host is an init option and needs claude or codex. Nothing was written.");
  }
  if (flags["pr-comment"] !== undefined && cmd !== "init") {
    halt("--pr-comment is an init option. Nothing was written.");
  }
  const policy = loadPolicy();
  // A malformed cap, ladder or tier halts before the chain, the run lock or any write.
  if (["init", "next", "usage"].includes(cmd)) {
    const bad = policyProblems(policy) ?? promptProblem(policy);
    if (bad) halt(bad);
  }
  const chain = resolveChain(cmd, id, flags);
  // openspec/changes/archive/ is OpenSpec's archive root, so the name archive cannot be an OpenSpec change.
  if (chain === "openspec" && id === "archive") {
    halt("The change name archive is reserved: openspec/changes/archive/ is OpenSpec's archive folder. Use another name. Nothing was written.");
  }
  if (["init", "next", "usage"].includes(cmd)) {
    const p = paths(id, null, chain);
    const stored = readMeta(p.meta, {});
    const host = cmd === "init" ? flags.host ?? hostOf(stored) : hostOf(stored);
    if (cmd === "init" && fs.existsSync(p.meta) && host !== hostOf(stored)) {
      halt(`Run host is ${hostOf(stored)}; --host ${host} cannot resume it. Use the original host or a new change. Nothing was written.`);
    }
    const incompatible = hostProblem(policy, host);
    if (incompatible) halt(incompatible);
  }
  if (["init", "next", "usage"].includes(cmd) || (cmd === "status" && flags.report)) acquireRunLock(id, chain);

  if (cmd === "init") {
    const levels = rigorLevels(policy);
    // --rigor is checked before anything is written.
    if (flags.rigor !== undefined && (typeof flags.rigor !== "string" || !levels.includes(flags.rigor))) {
      halt(`Invalid --rigor ${flags.rigor === true ? "(no value)" : flags.rigor}. Use one of: ${levels.join(", ")}.`);
    }
    // --archive is checked before anything is written: a bare flag or "true" turns it on, "false" turns it off.
    let archive;
    if (flags.archive !== undefined) {
      if (flags.archive === true || flags.archive === "true") archive = true;
      else if (flags.archive === "false") archive = false;
      else halt(`Invalid --archive ${flags.archive}. Use --archive, --archive true or --archive false.`);
    }
    // --chrome is checked before anything is written, like --archive: a bare flag or "true" stores true, "false" stores false.
    // Chrome is on by default, so only a stored false turns the Chrome rules off; a resume without the flag keeps the value.
    let chrome;
    if (flags.chrome !== undefined) {
      if (flags.chrome === true || flags.chrome === "true") chrome = true;
      else if (flags.chrome === "false") chrome = false;
      else halt(`Invalid --chrome ${flags.chrome}. Use --chrome, --chrome true or --chrome false.`);
    }
    let prComment;
    if (flags["pr-comment"] !== undefined) {
      if (flags["pr-comment"] === true || flags["pr-comment"] === "true") prComment = true;
      else if (flags["pr-comment"] === "false") prComment = false;
      else halt(`Invalid --pr-comment ${flags["pr-comment"]}. Use --pr-comment, --pr-comment true or --pr-comment false.`);
    }
    // A flag init does not read (a typo such as --gaol) would take the next word as its value and start
    // the run without it, so it halts before anything is written.
    const unknown = Object.keys(flags).filter((k) => k !== "_" && !INIT_FLAGS.includes(k));
    if (unknown.length) {
      halt(`Unknown flag(s) for init: ${unknown.map((k) => `--${k}`).join(", ")}. init reads: ${INIT_FLAGS.map((k) => `--${k}`).join(", ")}. Nothing was written.`);
    }
    // Words that belong to no flag (an unquoted goal) halt before anything is written.
    if (flags._.length) {
      halt(`Unexpected argument(s) after the flags: ${flags._.join(" ")}. Quote the goal: --goal "<text>". Nothing was written.`);
    }
    const p = paths(id, null, chain);
    guardArchived(p, id);
    if (chain === "openspec") {
      // The router never creates the change (D3), and a 10x change of the same name would collide (D8).
      if (!fs.existsSync(p.change)) halt(`${missingChangeReason(id)} Nothing was written.`);
      if (fs.existsSync(path.join(ROOT, "context/changes", id))) {
        halt(`context/changes/${id}/ exists: a 10x change already uses the name ${id}. An OpenSpec run needs a name no 10x change uses. Nothing was written.`);
      }
    }
    if (chain !== "openspec") haltNoChangeMd(p, id);
    const prev = readMeta(p.meta, {});
    // No flag keeps the stored value, so a resume of an archive run is checked again.
    if ((archive ?? prev.archive) === true) {
      const timeout = policy.archive?.gitTimeoutMs;
      const inside = runGit(["rev-parse", "--is-inside-work-tree"], { timeout });
      if (inside.status !== 0 || inside.stdout.trim() !== "true") {
        halt(`${notWorkTree(inside, timeout)} Nothing was written.`);
      }
      const ignored = ignoredProbePaths(id, { timeout, chain });
      if (ignored.length) {
        halt(`--archive needs git to track the change folder, but git ignores ${ignored.join(", ")}. Fix .gitignore or run without --archive. Nothing was written.`);
      }
    }
    // Run isolation (isolation.require true) is checked before anything is written. meta.isolated and meta.branch are
    // set only at an init whose log has no executed entry, so a run is isolated from its first step or not at all.
    const fresh = executed(readLog(p.log)).length === 0;
    const branch = isolationOn(policy) ? isolationCheck(id, policy, prev, fresh, chain) : null;
    fs.mkdirSync(p.dir, { recursive: true });
    // An empty, blank or valueless --goal keeps the stored goal.
    const goal = typeof flags.goal === "string" && flags.goal.trim() ? flags.goal : typeof prev.goal === "string" ? prev.goal : "";
    // Keep every stored field (rigor and whatever later changes add); a stored rigor that is no object is dropped.
    const meta = { ...prev, id, goal, host: flags.host ?? hostOf(prev) };
    if (!isObject(prev.rigor)) delete meta.rigor;
    if (archive !== undefined) meta.archive = archive;
    if (chrome !== undefined) meta.chrome = chrome;
    if (prComment !== undefined) meta.prComment = prComment;
    // Only an OpenSpec run carries a chain key; a 10x meta.json stays as it was.
    if (chain === "openspec") meta.chain = "openspec";
    if (branch !== null && fresh) { meta.isolated = true; meta.branch = branch; }
    if (flags.rigor !== undefined) {
      // On resume --rigor can raise the requested level, never lower it.
      const old = isObject(prev.rigor) && levels.includes(prev.rigor.requested) ? prev.rigor.requested : flags.rigor;
      meta.rigor = { ...meta.rigor, requested: maxLevel(levels, old, flags.rigor) };
    }
    // The commit the run started from: churn is counted up to it. Set once, kept on resume.
    if (!(typeof meta.baseSha === "string" && SHA_RE.test(meta.baseSha))) {
      delete meta.baseSha;
      const head = (gitOut(["rev-parse", "HEAD"]) ?? "").trim();
      if (SHA_RE.test(head)) meta.baseSha = head;
    }
    // What the run runs with: recorded at the first init of a run with no executed step, kept on resume, never
    // rewritten. A run with executed steps and no record (started before provenance existed) gets none.
    if (meta.provenance === undefined && executed(readLog(p.log)).length === 0) {
      const record = provenanceRecord(policy, meta);
      if (record) meta.provenance = record;
    }
    fs.writeFileSync(p.meta, JSON.stringify(meta, null, 2) + "\n");
    // The start commit of an isolated run, after baseSha and the meta.json write and before the first entry exists.
    if (meta.isolated === true && !Object.hasOwn(meta, "startCommit") && executed(readLog(p.log)).length === 0) {
      startCommit(p, id, meta, policy);
    }
    next(id, policy, chain);
  } else if (cmd === "next") {
    next(id, policy, chain);
  } else if (cmd === "status") {
    status(id, flags, chain, policy);
  } else if (cmd === "risk") {
    riskCommand(id, policy, chain);
  } else if (cmd === "usage") {
    usageCommand(id, rest, flags, policy, chain);
  } else if (cmd === "verify-archive") {
    verifyArchive(id, flags, chain);
  } else if (cmd === "compare") {
    compareCommand(id, flags, policy, chain);
  } else {
    halt(`Unknown command ${cmd}`);
  }
}

try {
  main();
} catch (e) {
  // Never a stack trace: a bad policy or a bad file ends the run with JSON.
  let reason = `Router error: ${e instanceof Error ? e.message : String(e)}`;
  // A rollback made earlier in this call is undone, as on any other halt, so the partial edits stay for a human.
  if (undoOnError) {
    const undo = undoOnError;
    undoOnError = null;
    let failed;
    try { failed = undo(); } catch (u) { failed = u instanceof Error ? u.message : String(u); }
    reason += failed ? ` The rollback was not undone: ${failed}` : " The rollback of the failed step was undone; its partial edits are back in the worktree.";
  }
  halt(reason);
}
