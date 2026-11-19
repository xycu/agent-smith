#!/usr/bin/env node
// shortcut: literal shell words and separators only, rely on host permissions for dynamic programs.
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_JSON_DEPTH = 64;
const STEP_AGENT_TYPE = "agent-smith:step";
const PUBLICATION = "Step publication belongs to the orchestrator. Leave push, GitHub calls and publication scripts to its terminal actions.";
const PRESERVATION = "This stateless guard cannot prove preservation. Preserve working-copy, staged-only and uniquely reachable commits in a commit or ref, and leave run rollback to the router.";
const DELETION = "Recursive deletion is forbidden. List and inspect files, unlink them one by one, then rmdir empty directories deepest first. Repository code uses removeTree.";
const HEREDOC_ALTERNATIVE = " Quote the delimiter for literal text or use the Write tool.";

class HeredocDenial extends Error {}

const shellSpace = (c) => c === " " || c === "\t";
const shellBoundary = (c) => c === undefined || shellSpace(c) || "\n;&|<>()".includes(c);
const continuedAt = (text, at) => text[at] === "\\" && text[at + 1] === "\n";

function afterContinuations(text, at) {
  while (continuedAt(text, at)) at += 2;
  return at;
}

const operatorSuffixes = { "&": "&>", "|": "&|", "<": "<>&", ">": ">|&", "<<": "<-", "&>": ">" };

function shellOperator(text, at) {
  let operator = text[at];
  if (!operator || !";&|<>()".includes(operator)) return null;
  let end = at + 1;
  while (operatorSuffixes[operator]) {
    const next = afterContinuations(text, end);
    if (!text[next] || !operatorSuffixes[operator].includes(text[next])) break;
    operator += text[next];
    end = next + 1;
  }
  return { operator, end };
}

const isHeredoc = (operator) => operator === "<<" || operator === "<<-";
const parameterStart = /[A-Za-z0-9_@*#?$!\-([{]/;

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
    else if (c === "\x60" || (c === "$" && parameterStart.test(next ?? ""))) return true;
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
    if (continued && at < text.length) continue;
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
    const opening = c === "$" && quote !== "'" ? afterContinuations(text, at + 1) : at;
    if (!quote && (shellBoundary(c) || c === closing)) break;
    if (c === "\\" && quote !== "'") {
      if (next === undefined) throw new Error("Unterminated shell escape.");
      if (next === "\n") { at += 2; continue; }
      if (!quote || '$\x60"\\'.includes(next)) { value += next; bare = false; at += 2; continue; }
    }
    if (c === quote) quote = null;
    else if (!quote && (c === "'" || c === '"')) { quote = c; bare = false; }
    else if (quote !== "'" && (c === "\x60" || c === "$" && text[opening] && "({[".includes(text[opening]))) {
      at = shellExpansionEnd(text, opening, depth + 1);
      literal = false;
      bare = false;
      continue;
    } else {
      if (quote !== "'" && c === "$") {
        const marker = text[opening] ?? "";
        if (parameterStart.test(marker) || !quote && (marker === "'" || marker === '"')) literal = false;
      }
      if (!quote && /[*?[{}\x00]/.test(c)) literal = false;
      if (!quote && c === "~" && (value === "" || value.endsWith("="))) literal = false;
      value += c;
    }
    at++;
  }
  if (quote) throw new Error("Unterminated shell quote.");
  return { end: at, value, literal, bare };
}

function shellExpansionEnd(text, opening, depth) {
  if (depth > 64) throw new Error("Unsupported nesting in heredoc context. Use the Write tool.");
  const open = text[opening];
  const close = { "(": ")", "{": "}", "[": "]", "\x60": "\x60" }[open];
  let nested = 0;
  const caseDepths = [];
  let position = "command";
  const command = open === "\x60" || open === "(" && text[afterContinuations(text, opening + 1)] !== "(";
  let possibleShift = false;
  let pairedClose = false;
  for (let at = opening + 1; at < text.length;) {
    const c = text[at];
    if (c === close && nested === 0 && !caseDepths.length) {
      // Without a closing arithmetic pair, Bash can parse the construct as nested shell commands.
      if (possibleShift && !pairedClose) {
        throw new HeredocDenial("Ambiguous heredoc in a shell or arithmetic group." + HEREDOC_ALTERNATIVE);
      }
      return at + 1;
    }
    if (c === open) { nested++; position = "command"; at++; continue; }
    if (c === close) {
      if (nested !== caseDepths.at(-1)) nested = Math.max(0, nested - 1);
      if (!command && open === "(" && nested === 0) pairedClose = text[afterContinuations(text, at + 1)] === close;
      position = "command";
      at++;
      continue;
    }
    if (continuedAt(text, at)) { at += 2; continue; }
    if (command && c === "#") {
      at = text.indexOf("\n", at);
      if (at === -1) break;
    }
    const op = shellOperator(text, at);
    if (op) {
      if (isHeredoc(op.operator)) {
        if (command) unexpectedHeredoc();
        possibleShift ||= open === "(";
      }
      if (";&|()".includes(op.operator[0])) position = "command";
      at = op.end;
    } else if (shellSpace(text[at]) || text[at] === "\n") {
      if (text[at] === "\n") position = "command";
      at++;
    } else {
      const word = shellWord(text, at, depth, close);
      if (command && position && word.bare) {
        if (word.value === "case") caseDepths.push(nested);
        if (word.value === "esac") caseDepths.pop();
      }
      position = afterCompoundPrefix(position, word);
      at = word.end;
    }
  }
  throw new Error("Unterminated shell substitution.");
}

function literalMessage(text, at) {
  const start = /"\$(?:\\\n)*\((?:[ \t]|\\\n)*c(?:\\\n)*a(?:\\\n)*t(?:[ \t]|\\\n)*/y;
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
  const close = /(?:[ \t\n]|\\\n)*\)(?:\\\n)*"(?:\\\n)*/y;
  close.lastIndex = body.end;
  if (!close.test(text) || !shellBoundary(text[close.lastIndex])) unexpectedHeredoc();
  return { end: close.lastIndex, value: "", literal: true, capture: true };
}

const descriptorPath = /^\/dev\/(?:fd\/|std(?:in|out|err)$)/;

function textHeredocStage(tokens) {
  let command;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.heredoc) continue;
    if (token.literal && !token.capture) {
      if (command === "tee" && descriptorPath.test(token.value)) return false;
      command ??= token.value;
      continue;
    }
    const literalFile = ["<", ">", ">>"].includes(token.operator) &&
      (token.descriptor === undefined || (token.operator === "<" ? /^0+$/ : /^0*[12]$/).test(token.descriptor));
    const target = tokens[i + 1];
    if (!literalFile || !target?.literal || target.capture ||
        descriptorPath.test(target.value) || /^\/dev\/(?:tcp|udp)\//.test(target.value)) {
      return false;
    }
    i++;
  }
  return command === "cat" || command === "tee";
}

const compoundClosers = { "{": "}", if: "fi", case: "esac", for: "done", while: "done", until: "done", select: "done" };

function afterCompoundPrefix(position, { bare, value }) {
  if (!position || !bare) return null;
  if (value === "{") return "command";
  if (position === "named-coproc") return null;
  if (position === "coproc") return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? "named-coproc" : null;
  if (value === "time" || value === "coproc") return value;
  if (["!", "if", "while", "until", "then", "elif", "else", "do"].includes(value)) return "command";
  return position === "time" && ["-p", "--"].includes(value) ? position : null;
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
  let compoundPosition = "command";
  const addToken = (token) => {
    tokens.push(token);
    compoundPosition = afterCompoundPrefix(compoundPosition, token);
  };
  let pending = [];
  let pipelineSafe = true;
  let pipelineHeredoc = false;
  let awaitingStage = false;
  let unsafeRoute = false;
  let unsafeExpansion = false;
  const compounds = [];
  const finishStage = () => {
    const lastCapture = tokens.findLastIndex((token) => token.capture);
    if (lastCapture !== -1) {
      const words = tokens.map((token) => token.value);
      if (words[0] !== "git" || words[1] !== "commit" || words.includes(undefined)) unexpectedHeredoc();
      const operands = gitOptions(words).messageOperands;
      if (tokens.some((token, i) => (i < lastCapture && !token.literal) || (token.capture && !operands.has(i)))) {
        unexpectedHeredoc();
      }
    }
    pipelineSafe &&= textHeredocStage(tokens);
    tokens = [];
    compoundPosition = "command";
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
    if (c === "(" && text[afterContinuations(text, at + 1)] === "(") {
      at = shellExpansionEnd(text, at, 1);
      addToken({ literal: false });
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
        if (compounds.length || descriptor !== undefined && !/^0+$/.test(descriptor)) pipelineSafe = false;
        pipelineHeredoc = true;
        pending.push(doc);
        addToken({ heredoc: true, operator });
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
        if (operator === "(") compounds.push(")");
        if (operator === ")" && compounds.at(-1) === ")") compounds.pop();
        addToken({ ...op, descriptor });
        if (operator === "(" || operator === ")") compoundPosition = "command";
        awaitingStage = false;
      }
      at = end;
      continue;
    }
    const message = c === '"' ? literalMessage(text, at) : null;
    const word = message ?? shellWord(text, at);
    if (message) cut(at, message.end, '""');
    const functionBody = tokens.length === 2 && tokens[0].bare && tokens[0].value === "function";
    if (word.bare && (compoundPosition || functionBody) && Object.hasOwn(compoundClosers, word.value)) {
      compounds.push(compoundClosers[word.value]);
      compoundPosition = "command";
    } else if (word.bare && compoundPosition && word.value === compounds.at(-1)) {
      compounds.pop();
    }
    addToken(word);
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
  const messageOperands = new Set();
  const shortValues = sub === "commit" ? "mFcCtSu" : sub === "clean" ? "e" : "";
  const longValues = ["--message", "--file", "--author", "--date"];
  if (sub === "commit") longValues.push("--reuse-message", "--reedit-message", "--template", "--fixup", "--squash", "--cleanup", "--trailer", "--pathspec-from-file");
  if (sub === "clean") longValues.push("--exclude");
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break;
    if (longValues.includes(arg) || ["-m", "-F"].includes(arg)) {
      if (arg === "-m") messageOperands.add(at + i + 2);
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

function isGuarded(agentType, hasAgentId) {
  // agent_type alone can describe the main session's --agent selection.
  return agentType === STEP_AGENT_TYPE && hasAgentId;
}

function eventProblem(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("Expected a hook event object.");
  if (!isGuarded(event.agent_type, event.agent_id !== undefined)) return null;
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

const jsonEscapes = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
const numberEnds = ["zero", "integer", "fraction", "exponent-digits"];

function nextNumberPart(part, c) {
  if (c >= "0" && c <= "9") {
    if (part === "minus") return c === "0" ? "zero" : "integer";
    if (part === "point") return "fraction";
    if (part === "exponent" || part === "exponent-sign") return "exponent-digits";
    return part === "zero" ? null : part;
  }
  if (c === "." && (part === "zero" || part === "integer")) return "point";
  if ((c === "e" || c === "E") && (part === "zero" || part === "integer" || part === "fraction")) return "exponent";
  if ((c === "+" || c === "-") && part === "exponent") return "exponent-sign";
  return null;
}

// Validate the whole oversized object while retaining only its top-level identity.
function overflowIdentity() {
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  const stack = [];
  const textLimit = Math.max("agent_type".length, "agent_id".length, STEP_AGENT_TYPE.length);
  let started = false;
  let topKey = null;
  let agentType = null;
  let hasAgentId = false;
  let numberPart = null;
  let keyword = "";
  let stringKind = null;
  let captured = null;
  let escaped = false;
  let hexRemaining = 0;
  let code = 0;

  function malformed() {
    throw new Error("Invalid JSON in oversized hook input.");
  }

  function open(state) {
    if (stack.length === MAX_JSON_DEPTH) throw new Error("Oversized hook input exceeds 64 nested JSON containers.");
    stack.push(state);
  }

  function startString(kind) {
    stringKind = kind;
    captured = kind === "skip" ? null : "";
  }

  function capture(c) {
    if (captured !== null) captured = captured.length < textLimit ? captured + c : null;
  }

  function stringChar(c) {
    if (hexRemaining) {
      if (!/^[0-9a-fA-F]$/.test(c)) malformed();
      code = 16 * code + Number.parseInt(c, 16);
      if (--hexRemaining === 0) capture(String.fromCharCode(code));
    } else if (escaped) {
      escaped = false;
      if (c === "u") {
        hexRemaining = 4;
        code = 0;
      } else {
        const decoded = jsonEscapes[c];
        if (decoded === undefined) malformed();
        capture(decoded);
      }
    } else if (c === "\\") {
      escaped = true;
    } else if (c === '"') {
      if (stringKind === "key") topKey = captured === "agent_type" || captured === "agent_id" ? captured : null;
      if (stringKind === "type") agentType = captured === STEP_AGENT_TYPE ? STEP_AGENT_TYPE : null;
      stringKind = null;
    } else {
      if (c < " ") malformed();
      capture(c);
    }
  }

  function startValue(c) {
    const key = stack.length === 1 ? topKey : null;
    if (key === "agent_id") hasAgentId = true;
    if (key === "agent_type") agentType = null;
    if (c === '"') startString(key === "agent_type" ? "type" : "skip");
    else if (c === "{") open("key-or-end");
    else if (c === "[") open("item-or-end");
    else if (c === "t") keyword = "rue";
    else if (c === "f") keyword = "alse";
    else if (c === "n") keyword = "ull";
    else if (c === "-") numberPart = "minus";
    else if (c === "0") numberPart = "zero";
    else if (c >= "1" && c <= "9") numberPart = "integer";
    else malformed();
  }

  function scan(text) {
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (stringKind) {
        stringChar(c);
        continue;
      }
      if (keyword) {
        if (c !== keyword[0]) malformed();
        keyword = keyword.slice(1);
        continue;
      }
      if (numberPart) {
        const next = nextNumberPart(numberPart, c);
        if (next) {
          numberPart = next;
          continue;
        }
        if (!numberEnds.includes(numberPart)) malformed();
        numberPart = null;
      }
      if (" \t\n\r".includes(c)) continue;
      if (stack.length === 0) {
        if (started || c !== "{") malformed();
        started = true;
        open("key-or-end");
        continue;
      }
      const top = stack.length - 1;
      switch (stack[top]) {
        case "key-or-end":
          if (c === "}") { stack.pop(); break; }
          // Falls through for the first member.
        case "key":
          if (c !== '"') malformed();
          stack[top] = "colon";
          startString(top === 0 ? "key" : "skip");
          break;
        case "colon":
          if (c !== ":") malformed();
          stack[top] = "member";
          break;
        case "member":
          stack[top] = "object-after";
          startValue(c);
          break;
        case "object-after":
          if (c === "}") stack.pop();
          else if (c === ",") stack[top] = "key";
          else malformed();
          break;
        case "item-or-end":
          if (c === "]") { stack.pop(); break; }
          // Falls through for the first item.
        case "item":
          stack[top] = "array-after";
          startValue(c);
          break;
        case "array-after":
          if (c === "]") stack.pop();
          else if (c === ",") stack[top] = "item";
          else malformed();
          break;
      }
    }
  }

  return {
    write(bytes) { scan(decoder.decode(bytes, { stream: true })); },
    guardedAtEnd() {
      scan(decoder.decode());
      if (!started || stack.length) malformed();
      return isGuarded(agentType, hasAgentId);
    },
  };
}

async function readEventProblem() {
  let prefix = Buffer.allocUnsafe(MAX_INPUT_BYTES);
  let size = 0;
  let overflow = null;
  for await (const chunk of process.stdin) {
    if (overflow) {
      overflow.write(chunk);
      continue;
    }
    const retained = Math.min(MAX_INPUT_BYTES - size, chunk.length);
    chunk.copy(prefix, size, 0, retained);
    size += retained;
    if (retained === chunk.length) continue;
    overflow = overflowIdentity();
    overflow.write(prefix);
    prefix = null;
    overflow.write(chunk.subarray(retained));
  }
  if (!overflow) return eventProblem(JSON.parse(prefix.toString("utf8", 0, size)));
  if (overflow.guardedAtEnd()) throw new Error("Hook input exceeds 64 KiB.");
  return null;
}

try {
  const problem = await readEventProblem();
  if (problem) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: problem },
    }) + "\n");
  }
} catch (error) {
  process.stderr.write("Step guard failed closed. " + error.message + "\n");
  process.exitCode = 2;
}
