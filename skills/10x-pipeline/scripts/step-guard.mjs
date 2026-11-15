#!/usr/bin/env node
// shortcut: literal shell words and separators only, rely on host permissions for dynamic programs.
const MAX_INPUT_BYTES = 64 * 1024;
const PUBLICATION = "Step publication belongs to the orchestrator. Leave push, GitHub calls and publication scripts to its terminal actions.";
const PRESERVATION = "This stateless guard cannot prove preservation. Preserve working-copy, staged-only and uniquely reachable commits in a commit or ref, and leave run rollback to the router.";
const DELETION = "Recursive deletion is forbidden. List and inspect files, unlink them one by one, then rmdir empty directories deepest first. Repository code uses removeTree.";

function commands(text) {
  const result = [];
  let words = [];
  let word = "";
  let started = false;
  let quote = null;
  const flushWord = () => {
    if (started) words.push(word);
    word = "";
    started = false;
  };
  const flushCommand = () => {
    flushWord();
    if (words.length) result.push(words);
    words = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\" && quote !== "'") {
      const next = text[++i];
      if (next === undefined) throw new Error("Unterminated shell escape.");
      if (next === "\n") continue;
      // Double quotes preserve backslashes before ordinary characters.
      if (quote === '"' && !['$', '\x60', '"', "\\"].includes(next)) word += "\\";
      word += next;
      started = true;
    } else if (quote) {
      if (c === quote) quote = null;
      else word += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      started = true;
    } else if (c === "#" && !started) {
      while (i < text.length && text[i] !== "\n") i++;
      flushCommand();
    } else if (";&|\n".includes(c)) {
      flushCommand();
    } else if (/\s/.test(c)) {
      flushWord();
    } else {
      word += c;
      started = true;
    }
  }
  if (quote) throw new Error("Unterminated shell quote.");
  flushCommand();
  return result;
}

const basename = (word) => word.split("/").at(-1);
const publicationScript = (word) => ["open-pr.mjs", "pr-comment.mjs"].includes(basename(word));
const beforePaths = (args) => args.slice(0, args.includes("--") ? args.indexOf("--") : args.length);

function gitProblem(words) {
  let at = 1;
  // Git global options that take a separate value precede the subcommand.
  while (at < words.length && words[at].startsWith("-")) {
    if (["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"].includes(words[at])) at += 2;
    else at++;
  }
  const sub = words[at];
  const args = words.slice(at + 1);
  const flags = [];
  const shortValues = sub === "commit" ? "mFcCtSu" : sub === "clean" ? "e" : "";
  const longValues = ["--message", "--file", "--author", "--date"];
  if (sub === "commit") longValues.push("--reuse-message", "--reedit-message", "--template", "--fixup", "--squash", "--cleanup", "--trailer", "--pathspec-from-file");
  if (sub === "clean") longValues.push("--exclude");
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break;
    if (longValues.includes(arg) || ["-m", "-F"].includes(arg)) { i++; continue; }
    if (shortValues && /^-[^-]/.test(arg)) {
      // An option's attached or separate value is data, even when it looks like another flag.
      for (let j = 1; j < arg.length; j++) {
        flags.push("-" + arg[j]);
        if (shortValues.includes(arg[j])) {
          if (j === arg.length - 1 && !"Su".includes(arg[j])) i++;
          break;
        }
      }
      continue;
    }
    flags.push(arg);
  }
  const dryRun = flags.findLast((arg) => ["-n", "--dry-run", "--no-dry-run"].includes(arg));
  if (sub === "push") return PUBLICATION;
  if (flags.includes("--no-verify") || (sub === "commit" && flags.some((arg) => /^-[^-]*n/.test(arg)))) {
    return "Bypassing Git hooks is forbidden. Run the authorized commit with its hooks enabled.";
  }
  if (sub === "restore" || sub === "checkout" ||
      (sub === "reset" && flags.some((arg) => arg === "--hard" || arg.startsWith("--hard="))) ||
      (sub === "clean" && !["-n", "--dry-run"].includes(dryRun)) ||
      (sub === "stash" && ["drop", "clear"].includes(args[0])) ||
      (["branch", "tag", "update-ref"].includes(sub) && flags.some((arg) => arg === "--delete" || /^-[^-]*[dD]/.test(arg))) ||
      (sub === "worktree" && ["remove", "prune"].includes(args[0])) ||
      (sub === "update-ref" && beforePaths(args).some((arg) => arg.startsWith("refs/agent-smith/")))) {
    return PRESERVATION;
  }
  return null;
}

function commandProblem(words) {
  const executable = basename(words[0]);
  if (executable === "gh" || publicationScript(words[0]) ||
      (executable === "node" && words.slice(1).some(publicationScript))) return PUBLICATION;
  if (executable === "git") return gitProblem(words);
  if (executable === "rm" && beforePaths(words.slice(1)).some((arg) => arg === "--recursive" || /^-[^-]*[rR]/.test(arg))) {
    return DELETION;
  }
  if (executable === "find" && words.includes("-delete")) return DELETION;
  return null;
}

function eventProblem(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("Expected a hook event object.");
  // agent_type alone can describe the main session's --agent selection.
  if (event.agent_type !== "agent-smith:step" || event.agent_id === undefined) return null;
  if (typeof event.agent_id !== "string" || !event.agent_id.trim() ||
      event.hook_event_name !== "PreToolUse" || event.tool_name !== "Bash" ||
      !event.tool_input || typeof event.tool_input.command !== "string" || !event.tool_input.command.trim()) {
    return "Malformed guarded Bash event. Retry with a valid PreToolUse command payload.";
  }
  for (const words of commands(event.tool_input.command)) {
    const problem = commandProblem(words);
    if (problem) return problem;
  }
  return null;
}

try {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_INPUT_BYTES) throw new Error("Hook input exceeds 64 KiB.");
    chunks.push(chunk);
  }
  const problem = eventProblem(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  if (problem) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: problem },
    }) + "\n");
  }
} catch (error) {
  process.stderr.write("Step guard failed closed. " + error.message + "\n");
  process.exitCode = 2;
}
