// Scratch OpenSpec projects for the OpenSpec chain tests. Builds on helpers.mjs, which stays as it is.
// Plain node: built-ins only.
import fs from "node:fs";
import path from "node:path";
import { makeProject, run } from "./helpers.mjs";

// A tasks.md with `done` ticked and `open` open rows, numbered 1.1, 1.2, ...
export function tasksText({ done = 0, open = 0 } = {}) {
  const rows = [];
  for (let i = 1; i <= done + open; i++) rows.push(`- [${i <= done ? "x" : " "}] 1.${i} Task ${i}`);
  return `## 1. Work\n\n${rows.join("\n")}\n`;
}

// Writes the artifact files of the change. `specs` is the number of specs/<cap-n>/spec.md files; `tasks` is
// { done, open } or a raw string; `verify` is the text of agent-smith/verify.md. A missing key writes nothing.
export function writeArtifacts(project, { proposal = false, design = false, specs = 0, tasks = null, verify = null } = {}) {
  fs.mkdirSync(project.changeDir, { recursive: true });
  if (proposal) fs.writeFileSync(path.join(project.changeDir, "proposal.md"), "## Why\n\nBecause.\n\n## What Changes\n\n- A thing.\n");
  if (design) fs.writeFileSync(path.join(project.changeDir, "design.md"), "## Context\n\nSmall.\n");
  for (let n = 1; n <= specs; n++) {
    const dir = path.join(project.changeDir, "specs", `cap-${n}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "spec.md"), "## ADDED Requirements\n\n### Requirement: Thing\n\nThe system SHALL do it.\n");
  }
  if (tasks !== null) fs.writeFileSync(path.join(project.changeDir, "tasks.md"), typeof tasks === "string" ? tasks : tasksText(tasks));
  if (verify !== null) writeVerify(project, verify);
}

export function writeVerify(project, text) {
  fs.mkdirSync(project.agentDir, { recursive: true });
  fs.writeFileSync(path.join(project.agentDir, "verify.md"), text);
}

// A scratch project with openspec/config.yaml and, unless `change` is false, the change folder as
// `openspec new change <id>` leaves it (only .openspec.yaml). makeProject always creates context/changes/<id>/;
// it is removed here, because an OpenSpec init halts on it (D8). The returned project's changeDir and agentDir point
// at openspec/changes/<id>/, so writeResult, writeLog, readLogEntries and readMetaFile of helpers.mjs work on it.
export function makeOpenspecProject({ id = "demo", policy = null, change = true, ...artifacts } = {}) {
  const base = makeProject({ id, policy, change: false });
  fs.rmSync(base.changeDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(base.root, "openspec/specs"), { recursive: true });
  fs.mkdirSync(path.join(base.root, "openspec/changes/archive"), { recursive: true });
  fs.writeFileSync(path.join(base.root, "openspec/config.yaml"), "schema: spec-driven\n");
  const changeDir = path.join(base.root, "openspec/changes", id);
  const project = {
    ...base,
    changeDir,
    agentDir: path.join(changeDir, "agent-smith"),
    planFile: null,
    tenxChangeDir: path.join(base.root, "context/changes", id),
  };
  if (change) {
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-01-01\n");
    writeArtifacts(project, artifacts);
  }
  return project;
}

// init with --chain openspec.
export function initOpenspec(project, goal, extra = []) {
  return run(project, ["init", project.id, "--goal", goal, "--chain", "openspec", ...extra]);
}

// Moves the change folder to openspec/changes/archive/<date>-<id>, as `openspec archive` does. Returns the new path.
export function moveToArchive(project, date = "2026-01-01") {
  const target = path.join(project.root, "openspec/changes/archive", `${date}-${project.id}`);
  fs.renameSync(project.changeDir, target);
  return target;
}
