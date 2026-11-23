import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
console.log("Manual verification preflight, read-only checks");
console.log("Candidate " + git("rev-parse", "HEAD"));
console.log("Branch " + git("branch", "--show-current"));
console.log("Node " + process.version);
const plan = read("context/changes/openspec-2-upgrade/plan.md");
console.log("Pending Manual rows");
console.log(plan.split("#### Manual\n").at(-1).trim());
const names = fs.readdirSync(path.join(root, ".agents/skills")).filter((name) => name.startsWith("openspec-")).sort();
for (const name of names) {
  const canonical = path.join(root, ".agents/skills", name);
  const skill = fs.readFileSync(path.join(canonical, "SKILL.md"), "utf8");
  const link = path.join(root, ".claude/skills", name);
  const version = skill.match(/generatedBy:\s*"([^"]+)"/)?.[1];
  const linked = fs.lstatSync(link).isSymbolicLink() && fs.realpathSync(link) === fs.realpathSync(canonical);
  console.log(name + " generatedBy=" + version + " relativeLink=" + (linked && !path.isAbsolute(fs.readlinkSync(link))));
  if (version !== "2.0.0" || !linked) throw new Error("Integration mismatch " + name);
}
if (names.length !== 12) throw new Error("Expected twelve skills, found " + names.length);
const fixture = read("skills/10x-pipeline/test/codex-chain.test.mjs");
console.log("Existing fixture scope");
console.log(fixture.split("\n").filter((line) => line.includes("fake Codex process") || line.includes("no assertion that Agent was called")).join("\n"));
console.log("Partial discovery metadata check passed. No live matrix cell or external handoff was proved.");
