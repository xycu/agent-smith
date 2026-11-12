Judgment for 1.5: step 1 (parse) and step 4 (init) of both skills.

10x-pipeline step 1: "Parse the optional flag `--rigor` the same way, but its value is the next word, one of `lean`, `standard` or `thorough` (`--rigor=<level>` too), remove both from the goal text, and pass it on to `init`, with its value, only when the user gave it."
10x-pipeline step 4: "Add `--rigor <level>` only when the user named a rigor level, as the flag parsed in step 1 or in plain words ... Never pick one yourself. On a resume the flag can only raise the level."
openspec-pipeline step 1 and step 4: identical wording (step 4 init line also carries `--chain openspec`).
argument-hint of both lists `[--rigor <level>]`.

Reasoning: step 1 parses, strips from the goal and forwards only when given; step 4 forwards only when given and never self-chosen. Same flag, same value set, same conditions in both skills and both steps. Consistent.
