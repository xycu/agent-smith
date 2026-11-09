#!/bin/sh
# Row 3.6 check. Usage: sh script-cost-manual.sh <repo root>
R="$1/skills/10x-pipeline/scripts/route.mjs"
mk() { # $1 dir $2 tokens
  mkdir -p "$1/context/foundation" "$1/context/changes/demo"
  printf -- '---\nid: demo\ncreated: 2026-01-01\n---\n# demo\n' > "$1/context/changes/demo/change.md"
  echo '{"isolation":{"require":false},"score":{"minRigor":null},"manualVerify":{"minRigor":null},"prices":{"usdPerMillionTokens":{"opus":30,"sonnet":6}}}' > "$1/context/foundation/agent-smith-policy.json"
  (cd "$1" && echo "--- init $1" >&2 && node "$R" init demo --goal "add thing" | tee init.out | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"));console.log("init valid JSON")')
  (cd "$1" && printf '{"status":"done","note":"x","usage":{"totalTokens":%s}}' "$2" > context/changes/demo/agent-smith/last-result.json && node "$R" next demo | head -c 250; echo)
}
T=$(mktemp -d "${TMPDIR:-/tmp}/cost36.XXXXXX")
mk "$T/a" 1000000; mk "$T/b" 2000000
cd "$T/a"
echo "== status"; node "$R" status demo | tee st.out | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"));console.log("status valid JSON")'
grep -n -i cost st.out
echo "== status --report"; node "$R" status demo --report | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"));console.log("report valid JSON")'
grep -n -i cost context/changes/demo/agent-smith/report.md
echo "== compare md"; node "$R" compare demo --baseline "$T/b" --format md
