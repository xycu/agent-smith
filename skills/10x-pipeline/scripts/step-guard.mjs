#!/usr/bin/env node
// shortcut: literal shell words and separators only, rely on host permissions for dynamic programs.
const MAX_INPUT_BYTES = 64 * 1024;
const PUBLICATION = "Step publication belongs to the orchestrator. Leave push, GitHub calls and publication scripts to its terminal actions.";
const PRESERVATION = "This stateless guard cannot prove preservation. Preserve working-copy, staged-only and uniquely reachable commits in a commit or ref, and leave run rollback to the router.";
const DELETION = "Recursive deletion is forbidden. List and inspect files, unlink them one by one, then rmdir empty directories deepest first. Repository code uses removeTree.";
const HEREDOC_ALTERNATIVE = " Quote the delimiter for literal text or use the Write tool.";

class HeredocDenial extends Error {}

const shellSpace = (c) => c === " " || c === "\t";
const shellBoundary = (c) => c === undefined || shellSpace(c) || "\n;&|<>()".includes(c);
const continuedAt = (text, at) => text[at] === "\\" && text[at + 1] === "\n";

function shellOperator(text, at) {
  const here = /<(?:\\\n)*<(?:\\\n)*[<-]?/y;
  const other = /&>>|&>|\|&|\|\||&&|>>|>\||>&|<&|<>|[;&|<>()]/y;
  for (const pattern of [here, other]) {
    pattern.lastIndex = at;
    if (pattern.test(text)) {
      return { operator: text.slice(at, pattern.lastIndex).replaceAll("\\\n", ""), end: pattern.lastIndex };
    }
  }
  return null;
}

const isHeredoc = (operator) => operator === "<<" || operator === "<<-";

// shortcut: only an entire single- or double-quoted delimiter or a plain delimiter is supported.
function heredocOpener(text, { operator, end }) {
  const delimiter = /(?:[ \t]|\\\n)*(?:([A-Za-z0-9_.-](?:[A-Za-z0-9_.-]|\\\n)*)|'([^'\n]*)'|"((?:[^"\\\n]|\\[\s\S])*)")(?:\\\n)*/y;
  delimiter.lastIndex = end;
  const match = text.match(delimiter);
  if (!match || !shellBoundary(text[delimiter.lastIndex])) {
    throw new Error("Unsupported heredoc delimiter. Use a plain or quoted word or the Write tool.");
  }
  const [, plain, single, double] = match;
  return {
    end: delimiter.lastIndex,
    delimiter: plain?.replaceAll("\\\n", "") ?? single ??
      double.replace(/\\([$\x60"\\\n])/g, (_, escaped) => escaped === "\n" ? "" : escaped),
    quoted: plain === undefined,
    stripTabs: operator === "<<-",
  };
}

function heredocExpansion(line) {
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const next = line[i + 1];
    if (c === "\\" && next && "\\$\x60".includes(next)) i++;
    else if (c === "\x60" || (c === "$" && next && /[A-Za-z0-9_@*#?$!\-([{]/.test(next))) return true;
  }
  return false;
}

function heredocBody(text, at, doc) {
  let expansion = false;
  let parts = [];
  while (at < text.length) {
    const newline = text.indexOf("\n", at);
    const end = newline === -1 ? text.length : newline;
    let trailing = end;
    if (!doc.quoted && newline !== -1) {
      while (trailing > at && text[trailing - 1] === "\\") trailing--;
    }
    const continued = (end - trailing) % 2 === 1;
    parts.push(text.slice(at, continued ? end - 1 : end));
    at = newline === -1 ? text.length : newline + 1;
    if (continued) continue;
    const line = parts.join("");
    if (line === doc.delimiter || doc.stripTabs && line.replace(/^\t+/, "") === doc.delimiter) {
      return { end: at, expansion };
    }
    if (!doc.quoted && heredocExpansion(line)) expansion = true;
    parts = [];
  }
  throw new Error("Unterminated heredoc. Close it with the delimiter on its own line or use the Write tool.");
}

function unexpectedHeredoc() {
  throw new HeredocDenial("Heredoc substitution is only supported as the separate git commit -m message." + HEREDOC_ALTERNATIVE);
}

// This lexer is used only to classify heredoc syntax. The direct-command checker still sees its original words.
function shellWord(text, at, depth = 0, closing = null) {
  let quote = null;
  let literal = true;
  let bare = true;
  let value = "";
  while (at < text.length) {
    const c = text[at];
    const next = text[at + 1];
    if (!quote && (shellBoundary(c) || c === closing)) break;
    if (c === "\\" && quote !== "'") {
      if (next === undefined) throw new Error("Unterminated shell escape.");
      if (next === "\n") { at += 2; continue; }
      if (!quote || '$\x60"\\'.includes(next)) { value += next; bare = false; at += 2; continue; }
    }
    if (c === quote) quote = null;
    else if (!quote && (c === "'" || c === '"')) { quote = c; bare = false; }
    else if (quote !== "'" && (c === "\x60" || (c === "$" && next && "({[".includes(next)))) {
      at = shellExpansionEnd(text, at, depth + 1);
      literal = false;
      continue;
    } else {
      if (quote !== "'" && c === "$") literal = false;
      if (!quote && /[*?[{}\x00]/.test(c)) literal = false;
      if (!quote && c === "~" && (value === "" || value.endsWith("="))) literal = false;
      value += c;
    }
    at++;
  }
  if (quote) throw new Error("Unterminated shell quote.");
  return { end: at, value, literal, bare };
}

function shellExpansionEnd(text, start, depth, arithmetic = false) {
  if (depth > 64) throw new Error("Unsupported nesting in heredoc context. Use the Write tool.");
  const backtick = text[start] === "\x60";
  const opening = start + Number(!arithmetic && !backtick);
  const open = text[opening];
  const close = { "(": ")", "{": "}", "[": "]", "\x60": "\x60" }[open];
  let nested = 0;
  let cases = 0;
  let firstWord = true;
  const command = backtick || open === "(" && text[opening + 1] !== "(";
  for (let at = opening + 1; at < text.length;) {
    const c = text[at];
    if (c === close && nested === 0 && cases === 0) return at + 1;
    if (c === open) { nested++; at++; continue; }
    if (c === close) { nested = Math.max(0, nested - 1); firstWord = true; at++; continue; }
    if (continuedAt(text, at)) { at += 2; continue; }
    if (command && c === "#") {
      at = text.indexOf("\n", at);
      if (at === -1) break;
    }
    const op = shellOperator(text, at);
    if (op) {
      if (command && isHeredoc(op.operator)) unexpectedHeredoc();
      if (";&|".includes(op.operator[0])) firstWord = true;
      at = op.end;
    } else if (shellSpace(text[at]) || text[at] === "\n") {
      if (text[at] === "\n") firstWord = true;
      at++;
    } else {
      const word = shellWord(text, at, depth, close);
      if (command && firstWord && word.bare) {
        if (word.value === "case") cases++;
        if (word.value === "esac") cases = Math.max(0, cases - 1);
      }
      firstWord = false;
      at = word.end;
    }
  }
  throw new Error("Unterminated shell substitution.");
}

function literalMessage(text, at) {
  const start = /"\$\((?:[ \t]|\\\n)*cat(?:[ \t]|\\\n)*/y;
  start.lastIndex = at;
  if (!start.test(text)) return null;
  const op = shellOperator(text, start.lastIndex);
  if (!isHeredoc(op?.operator)) return null;
  const doc = heredocOpener(text, op);
  if (!doc.quoted) unexpectedHeredoc();
  const headerEnd = /(?:[ \t]|\\\n)*(?:#[^\n]*)?\n/y;
  headerEnd.lastIndex = doc.end;
  if (!headerEnd.test(text)) {
    if (text.indexOf("\n", doc.end) === -1) throw new Error("Unterminated heredoc. Use the Write tool.");
    unexpectedHeredoc();
  }
  const body = heredocBody(text, headerEnd.lastIndex, doc);
  const close = /[ \t\n]*\)"(?:\\\n)*/y;
  close.lastIndex = body.end;
  if (!close.test(text) || !shellBoundary(text[close.lastIndex])) unexpectedHeredoc();
  return { end: close.lastIndex, value: "", literal: true, capture: true };
}

function textHeredocStage(tokens) {
  let command;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.heredoc) continue;
    if (token.literal && !token.capture) {
      command ??= token.value;
      continue;
    }
    const literalFile = ["<", ">", ">>"].includes(token.operator) &&
      (token.descriptor === undefined || (token.operator === "<" ? /^0+$/ : /^0*[12]$/).test(token.descriptor));
    if (!literalFile || !tokens[++i]?.literal || tokens[i].capture) {
      return false;
    }
  }
  return command === "cat" || command === "tee";
}

function withoutHeredocData(text) {
  if (!/<(?:\\\n)*</.test(text)) return text;
  const parts = [];
  let keptFrom = 0;
  const cut = (start, end, replacement = "") => {
    parts.push(text.slice(keptFrom, start), replacement);
    keptFrom = end;
  };
  let tokens = [];
  let pending = [];
  let pipelineSafe = true;
  let pipelineHeredoc = false;
  let awaitingStage = false;
  let unsafeRoute = false;
  let unsafeExpansion = false;
  let groups = 0;
  let compounds = 0;
  const finishStage = () => {
    const messages = tokens.map((token, index) => token.capture ? index : -1).filter((i) => i !== -1);
    if (messages.length) {
      const words = tokens.map((token) => token.value);
      const operands = gitOptions(words).messageOperands;
      if (words[0] !== "git" || words[1] !== "commit" ||
          tokens.some((token) => token.operator) ||
          messages.some((i) => !operands.includes(i) || tokens.slice(0, i).some((token) => !token.literal))) {
        unexpectedHeredoc();
      }
    }
    pipelineSafe &&= textHeredocStage(tokens);
    tokens = [];
  };
  const finishPipeline = () => {
    finishStage();
    if (pipelineHeredoc && !pipelineSafe) unsafeRoute = true;
    pipelineSafe = true;
    pipelineHeredoc = false;
    awaitingStage = false;
  };

  for (let at = 0; at < text.length;) {
    const c = text[at];
    if (shellSpace(c)) { at++; continue; }
    if (continuedAt(text, at)) { at += 2; continue; }
    if (c === "#") {
      at = text.indexOf("\n", at);
      if (at === -1) break;
      continue;
    }
    if (text.startsWith("((", at)) {
      at = shellExpansionEnd(text, at, 1, true);
      tokens.push({ literal: false });
      awaitingStage = false;
      continue;
    }
    if (c === "\n") {
      at++;
      for (const doc of pending) {
        const body = heredocBody(text, at, doc);
        cut(at, body.end);
        unsafeExpansion ||= body.expansion;
        at = body.end;
      }
      pending = [];
      if (!awaitingStage) finishPipeline();
      continue;
    }
    const op = shellOperator(text, at);
    if (op) {
      const { operator, end } = op;
      const prev = tokens.at(-1);
      const descriptor = "<>".includes(operator[0]) && prev?.end === at && prev.bare && /^\d+$/.test(prev.value)
        ? tokens.pop().value
        : undefined;
      if (isHeredoc(operator)) {
        const doc = heredocOpener(text, op);
        if (groups || compounds || descriptor !== undefined && !/^0+$/.test(descriptor)) pipelineSafe = false;
        pipelineHeredoc = true;
        pending.push(doc);
        tokens.push({ heredoc: true, operator });
        awaitingStage = false;
        at = doc.end;
        continue;
      }
      if (operator === "|" || operator === "|&") {
        if (operator === "|&") pipelineSafe = false;
        finishStage();
        awaitingStage = true;
      } else if ([";", "&", "&&", "||"].includes(operator)) {
        if (operator === "&") pipelineSafe = false;
        finishPipeline();
      } else {
        if (operator === "(") groups++;
        if (operator === ")") groups = Math.max(0, groups - 1);
        tokens.push({ ...op, descriptor });
        awaitingStage = false;
      }
      at = end;
      continue;
    }
    const message = c === '"' ? literalMessage(text, at) : null;
    const word = message ?? shellWord(text, at);
    if (message) cut(at, message.end, '""');
    if (word.bare && tokens.length === 0) {
      if (["if", "case", "for", "while", "until", "select", "{"].includes(word.value)) compounds++;
      if (["fi", "esac", "done", "}"].includes(word.value)) compounds = Math.max(0, compounds - 1);
    } else if (word.bare && word.value === "{" &&
               (tokens.at(-1)?.operator === ")" || tokens[0]?.value === "function")) compounds++;
    tokens.push(word);
    awaitingStage = false;
    at = word.end;
  }
  if (pending.length) throw new Error("Unterminated heredoc. Use the Write tool.");
  finishPipeline();
  if (unsafeRoute) throw new HeredocDenial("Heredoc input needs a literal cat or tee route and literal files." + HEREDOC_ALTERNATIVE);
  if (unsafeExpansion) throw new HeredocDenial("Heredoc has an active expansion." + HEREDOC_ALTERNATIVE);
  return parts.length ? parts.join("") + text.slice(keptFrom) : text;
}

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

function gitOptions(words) {
  let at = 1;
  // Git global options that take a separate value precede the subcommand.
  while (at < words.length && words[at].startsWith("-")) {
    if (["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"].includes(words[at])) at += 2;
    else at++;
  }
  const sub = words[at];
  const args = words.slice(at + 1);
  const flags = [];
  const messageOperands = [];
  const shortValues = sub === "commit" ? "mFcCtSu" : sub === "clean" ? "e" : "";
  const longValues = ["--message", "--file", "--author", "--date"];
  if (sub === "commit") longValues.push("--reuse-message", "--reedit-message", "--template", "--fixup", "--squash", "--cleanup", "--trailer", "--pathspec-from-file");
  if (sub === "clean") longValues.push("--exclude");
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break;
    if (longValues.includes(arg) || ["-m", "-F"].includes(arg)) {
      if (arg === "-m") messageOperands.push(at + i + 2);
      i++;
      continue;
    }
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
  return { sub, args, flags, messageOperands };
}

function gitProblem(words) {
  const { sub, args, flags } = gitOptions(words);
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
  let command;
  try {
    command = withoutHeredocData(event.tool_input.command);
  } catch (error) {
    if (error instanceof HeredocDenial) return error.message;
    throw error;
  }
  for (const words of commands(command)) {
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
