import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { readReview } from "../../../../skills/10x-pipeline/scripts/state.mjs";
const d = fs.mkdtempSync(path.join(os.tmpdir(), "rv-")); const f = path.join(d, "r.md");
fs.writeFileSync(f, "# Review\n\n**Verdict:** SOUND\n**Findings:** 0 critical, 0 warnings\n");
const r = readReview(f); console.log(JSON.stringify(r));
fs.unlinkSync(f); fs.rmdirSync(d);
if (r.verdict !== "SOUND" || r.critical !== 0 || r.warnings !== 0) { console.log("FAIL"); process.exit(1); }
console.log("OK: verdict SOUND parsed, 0/0 counts");
