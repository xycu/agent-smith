# Archive SHA repointing

Recorded 2026-11-16T17:43:59Z.

The integration target is `origin/main` at snapshot `39a82d652026ed5ab041b8fed599ed700030a84d`. The integration commit is `39a82d652026ed5ab041b8fed599ed700030a84d`, `docs(community-standards): complete community standards`.

## Evidence and scope

PR #207 was merged into `main` with the integration commit above. Its recorded commit list includes both original phase commits. The repository has complete history, and both original commits resolve uniquely and lie outside the target ancestry following the squash merge. The integration commit belongs to the target ancestry. [Implementation PR](https://github.com/xycu/agent-smith/pull/207)

The eight implementation-file patches in the squash commit match the PR patches after normalization of Git index and hunk coordinates. The README also contains an unrelated branch-prefix documentation change on main. The matching implementation patches establish the integration scope for Phase 1 rows 1.1–1.6 and Phase 2 rows 2.1–2.3.

The original commits are `f7d72a65`, `docs(community-standards): add contribution policies (p1)`, and `49697498`, `docs(community-standards): add issue and PR templates (p2)`.

## Approved update

The user explicitly selected “Update and archive” after reviewing the nine-row mapping and acknowledging the Phase 2 formal-review coverage warning. Only the existing SHA suffixes on these nine completed Progress rows were changed. Rows 2.4–2.7 already reference `39a82d65` and retain their existing text.

| Row ID | Old suffix and resolved OID | New SHA |
| --- | --- | --- |
| 1.1 | `f7d72a65` (`f7d72a654e7040e48e07b08da59b96cc0a9da3c8`) | `39a82d65` |
| 1.2 | `f7d72a65` (`f7d72a654e7040e48e07b08da59b96cc0a9da3c8`) | `39a82d65` |
| 1.3 | `f7d72a65` (`f7d72a654e7040e48e07b08da59b96cc0a9da3c8`) | `39a82d65` |
| 1.4 | `f7d72a65` (`f7d72a654e7040e48e07b08da59b96cc0a9da3c8`) | `39a82d65` |
| 1.5 | `f7d72a65` (`f7d72a654e7040e48e07b08da59b96cc0a9da3c8`) | `39a82d65` |
| 1.6 | `f7d72a65` (`f7d72a654e7040e48e07b08da59b96cc0a9da3c8`) | `39a82d65` |
| 2.1 | `49697498` (`496974982d0ee95a19f3d350b849a9314df9d5a9`) | `39a82d65` |
| 2.2 | `49697498` (`496974982d0ee95a19f3d350b849a9314df9d5a9`) | `39a82d65` |
| 2.3 | `49697498` (`496974982d0ee95a19f3d350b849a9314df9d5a9`) | `39a82d65` |

Affected-row total is 9. This record documents archive provenance. Formal implementation-review coverage remains Phase 1, with Phase 2 post-publication verification recorded separately.
