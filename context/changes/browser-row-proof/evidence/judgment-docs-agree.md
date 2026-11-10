Checked docs/REFERENCE.md "Manual verification" (line 172, 180) and docs/ADR/ADR-012-automate-manual-checks.md "Amendment 1".
Policy keys: REFERENCE line 172 "manualVerify.browserRowWords ... default playwright, e2e, end-to-end, browser and chrome" and "manualVerify.browserProofKinds (default browser, test, command, script)"; ADR Rules: same keys and same defaults.
Proof kinds: both say browser, test, command, script prove a browser row.
Reason text: both "browser row ticked with <kind> evidence; only browser, test, command, script evidence proves it"; nochrome reason "Chrome off (--chrome false)" in both.
Upgrade note: REFERENCE line 180 "provenance.drift for manualVerify ... prompts", old browserWords ignored; ADR Risks "provenance.drift for manualVerify and prompts", and Unchanged says browserWords stays ignored.
Limits (REFERENCE ~314) and ADR Live check agree on the tabs_context_mcp result.
Conclusion: the texts agree.
