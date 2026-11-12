#!/bin/sh
# usage: sh script-manual-halts.sh <route.mjs absolute path>
R="$1"
D=$(mktemp -d)
mkdir -p "$D/context/changes/x" "$D/context/foundation"
printf -- '---\nstatus: active\n---\n# x\n' > "$D/context/changes/x/change.md"
cd "$D"
echo "== 1.6 limits.maxTotalSteps string"
echo '{"limits":{"maxTotalSteps":"14"}}' > context/foundation/agent-smith-policy.json
node "$R" init x --goal g; echo "exit=$?"
ls context/changes/x
echo "== 1.7 status"
node "$R" status x | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log("valid JSON; policyProblem="+JSON.stringify(j.policyProblem))'
echo "== 2.5 plan template {idd}"
node -e '
const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1]+"/../policy.json","utf8"));
let t=p.prompts.plan; if(t.startsWith("@")) t=fs.readFileSync(process.argv[1]+"/../prompts/"+t.slice(9),"utf8");
fs.writeFileSync("context/foundation/agent-smith-policy.json",JSON.stringify({prompts:{plan:t.replaceAll("{id}","{idd}")}}));' "$(dirname "$R")"
node "$R" init x --goal g; echo "exit=$?"
ls context/changes/x
echo "$D" > /dev/stderr
