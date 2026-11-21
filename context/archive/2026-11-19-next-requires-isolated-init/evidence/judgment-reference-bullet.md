Row 2.4: new bullet in docs/REFERENCE.md line 143, directly after the init halt bullets (lines 141-142).

Quoted text:
"With `isolation.require` on and no `isolated: true` in `meta.json` (no file, or a file without the flag), `next` halts, writes nothing and names `init`, so a skipped `init` cannot start steps on the default branch. Both chains share the rule. With isolation off nothing changes, including `next` without `meta.json`."

Reasoning: it uses the same vocabulary as the neighbouring init bullets (isolation.require, meta.json, halts, writes nothing), states the trigger, the effect and the reason in one sentence, and covers the isolation-off exception explicitly ("With isolation off nothing changes"). Reads clearly beside the init bullets.
