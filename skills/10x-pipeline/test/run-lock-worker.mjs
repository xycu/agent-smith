// One process of the multi-process run-lock test (run-lock.test.mjs); not a test itself, so the suite glob skips it.
// argv: <root> <idPrefix> <rounds> <startAtMs> <slotMs> <holdMs>; env TMPDIR holds the locks, LOCK_MODULE (absolute path)
// replaces the module under test. Prints one JSON line: the hold intervals of the rounds this process won.
import { pathToFileURL } from "node:url";

const [root, prefix, rounds, startAt, slot, hold] = process.argv.slice(2);
const mod = await import(process.env.LOCK_MODULE
  ? pathToFileURL(process.env.LOCK_MODULE).href
  : new URL("../scripts/run-lock.mjs", import.meta.url).href);
process.setMaxListeners(0); // every acquire adds an exit handler
const now = () => performance.timeOrigin + performance.now(); // comparable across processes
class Busy extends Error {}
const intervals = [];
for (let r = 0; r < Number(rounds); r++) {
  while (now() < Number(startAt) + r * Number(slot)) { /* spin to the slot start */ }
  let lock;
  try {
    lock = mod.lockRunDirectory(root, `${prefix}${r}`, "10x", (reason) => { throw new Busy(reason); });
  } catch (e) {
    if (e instanceof Busy || e.code === "EEXIST") continue; // a lost round (the retry bound gave up), not an error
    throw e;
  }
  const start = now();
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(hold));
  const end = now();
  lock.release();
  intervals.push({ round: r, start, end });
}
console.log(JSON.stringify(intervals));
