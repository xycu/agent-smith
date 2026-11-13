#!/bin/sh
# usage: script-crlf-scratch.sh <repo-root> <scratch-dir>
R=$1; S=$2; cd "$S" && git init -q . 2>&1 | head -1
mkdir -p context/changes/demo context/foundation
printf -- '---\nstatus: active\n---\n# Demo\n' > context/changes/demo/change.md
printf '{"isolation":{"require":false}}' > context/foundation/agent-smith-policy.json
printf '# Plan\r\n\r\n## Progress\r\n\r\n### Phase 1: Core\r\n\r\n#### Automated\r\n\r\n- [ ] 1.1 Do it\r\n' > context/changes/demo/plan.md
grep -c $'\r' context/changes/demo/plan.md
echo "== init"; node "$R/skills/10x-pipeline/scripts/route.mjs" init demo --goal "add a thing" > init.json 2>err1.txt; echo exit=$?; node -e 'JSON.parse(require("fs").readFileSync("init.json","utf8"));console.log("valid JSON")'; head -c 600 init.json; echo; cat err1.txt
echo "== status"; node "$R/skills/10x-pipeline/scripts/route.mjs" status demo > status.json 2>err2.txt; echo exit=$?; node -e 'JSON.parse(require("fs").readFileSync("status.json","utf8"));console.log("valid JSON")'; head -c 600 status.json; echo; cat err2.txt
grep -il "Router error" init.json status.json err1.txt err2.txt || echo "no Router error"
