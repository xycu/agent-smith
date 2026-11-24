#!/bin/sh
# Scratch repo + linked worktree; minimal profile "t". Run with SCRATCH=<empty dir that is NOT under a default-writable tmp dir>.
# "$S"="read" is added so the macOS TMPDIR default write does not mask the hooks/config denial.
S=$SCRATCH; cd $S && mkdir home && printf 'default_permissions = "t"\n[permissions.t]\nextends = ":workspace"\n[permissions.t.network]\nenabled = false\n' > home/config.toml
git init -q main && cd main && git -c user.name=a -c user.email=a@b commit -q --allow-empty -m init && git worktree add -q ../wt -b wtb && cd ../wt
C=$(git rev-parse --path-format=absolute --git-common-dir); G=$(git rev-parse --path-format=absolute --absolute-git-dir); echo x > f
T="permissions.t.filesystem={\"$S\"=\"read\",\"$G\"=\"write\",\"$C/objects\"=\"write\",\"$C/refs\"=\"write\",\"$C/logs\"=\"write\"}"
export CODEX_HOME=$S/home
codex sandbox -c "$T" -- sh -c 'git add f && git -c user.name=a -c user.email=a@b commit -q -m c && echo COMMIT_OK; (echo h > '$C'/hooks/x) 2>&1 | head -2; echo HOOKS_DONE; (echo h > '$C'/config) 2>&1 | head -2; echo CONFIG_DONE; git branch nb && echo BRANCH_OK; git -c user.name=a -c user.email=a@b commit -q --allow-empty -m d && echo C2_OK; git branch -d nb && echo BDEL_OK; git gc --auto && echo GC_AUTO_OK; git pack-refs --all && echo PACKREFS_OK' 2>&1
ls $C/hooks/x 2>&1; tail -2 $C/config
