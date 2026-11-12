Judgment for row 1.9: diff of .github/workflows/ci.yml against main (git diff main -- .github/workflows/ci.yml).

Quoted added lines (3 insertions, 0 deletions, 2 hunks):
+# The first step of `test` refuses uid 0, because ADR-020 D4 requires a non-root runner user.
+      - name: Refuse to run as root (ADR-020)
+        run: test "$(id -u)" -ne 0 || { echo "::error::the runner runs this job as uid 0; ADR-020 requires a non-root service user"; exit 1; }

Reasoning: only one header comment line and one new step were added; nothing was removed or changed.
The new step sits directly under `steps:` and above `- uses: actions/checkout@fbc6f399... # v5.1.0`, so it runs before checkout.
Row supported.
