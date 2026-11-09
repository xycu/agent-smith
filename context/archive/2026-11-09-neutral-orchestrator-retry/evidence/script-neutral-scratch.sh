#!/bin/zsh
# Scratch run: neutral reruns. Usage: script-neutral-scratch.sh <worktree root>
R="$1/skills/10x-pipeline/scripts/route.mjs"
D=$(mktemp -d "${TMPDIR:-/tmp}/neutral.XXXXXX") || exit 1; cd "$D" || exit 1; mkdir -p context/changes/demo/agent-smith
printf -- '---\nid: demo\ncreated: 2026-01-01\n---\n# demo\n' > context/changes/demo/change.md
mkdir -p context/foundation; echo '{"isolation":{"require":false},"score":{"minRigor":null},"manualVerify":{"minRigor":null}}' > context/foundation/agent-smith-policy.json
RF=context/changes/demo/agent-smith/last-result.json
node $R init demo --goal "add a small thing" > init.json; node -e 'const j=require("./init.json");console.log("INIT step:",j.step,"n:",j.n)'
node -e 'const j=require("./init.json");require("fs").writeFileSync("p0.txt",j.prompt||"")'
echo '{"status":"orchestrator-error","note":"Agent tool timed out"}' > $RF
node $R next demo > n1.json; node -e 'const j=require("./n1.json");require("fs").writeFileSync("p1.txt",j.prompt||"");console.log("NEXT1 step:",j.step,"n:",j.n,"action:",j.action)'
echo "--- diff p0 p1 (init vs rerun 1):"; diff p0.txt p1.txt && echo IDENTICAL; wc -c p0.txt
echo '{"status":"orchestrator-error","note":"again"}' > $RF
node $R next demo > n2.json; node -e 'const j=require("./n2.json");require("fs").writeFileSync("p2.txt",j.prompt||"");console.log("NEXT2 step:",j.step,"n:",j.n)'
diff p0.txt p2.txt && echo IDENTICAL-2
echo "--- status (after 2 reruns):"; node $R status demo | node -e 'const j=JSON.parse(require("fs").readFileSync(0));console.log(JSON.stringify((j.steps||j.log||j).map?.(r=>({n:r.n,step:r.step,neutralRetries:r.neutralRetries})),null,0))'
echo '{"status":"orchestrator-error","note":"third"}' > $RF
echo "--- third:"; node $R next demo; echo "exit $?"
echo "--- report:"; node $R status demo --report >/dev/null; cat context/changes/demo/agent-smith/report.md
