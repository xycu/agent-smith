import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const original = fs.mkdtempSync;
const worktreeProbe = new URL("../../../../.as-ci-probe-", import.meta.url).href;
const evidenceProbe = new URL(".as-ci-probe-", import.meta.url);
fs.mkdtempSync = (prefix, options) =>
  original(prefix instanceof URL && prefix.href === worktreeProbe ? evidenceProbe : prefix, options);
syncBuiltinESMExports();
