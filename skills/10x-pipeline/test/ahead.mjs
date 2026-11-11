// The router counts a file as a step's output when its mtime is later than the step's startedAt. Linux stamps files
// from a coarse clock, so a file a test writes right after `next` can land at or before that stamp and the step fails.
// A file a test writes to stand for a step's output gets an mtime a minute ahead. Same rule as `future` in advisor.test.mjs.
import fs from "node:fs";
import { writePlan as plainPlan, writeReview as plainReview } from "./helpers.mjs";

export function stampAhead(file) {
  const when = new Date(Date.now() + 60_000);
  fs.utimesSync(file, when, when);
}

export function writePlan(project, text) {
  plainPlan(project, text);
  stampAhead(project.planFile);
}

export function writeReview(project, name, opts) {
  plainReview(project, name, opts);
  stampAhead(`${project.changeDir}/reviews/${name}.md`);
}
