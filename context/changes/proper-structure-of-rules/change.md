---
change_id: proper-structure-of-rules
title: Hierarchical rule levels for skills, with OpenSpec definitions outside the 10x folder
status: preparing
created: 2026-11-13
updated: 2026-11-13
archived_at: null
---

## Notes

There should be hierchical level of behaviour and structure in the skill
1. Top level - applicalbe to everything
2. Framework specific (either 10xDevs or OpenSpec)
3. Skill specific (i.e. that applies only to 10x-research)
Every level should split into two categories:
1. Always true - lower level are not allowed to change the given behaviour
2. Default values - provides defualt but the lower level can change it when needed
Also while implementing this change please make sure that OpenSpec definitions are in OpenSpec folder not in 10xDevs
