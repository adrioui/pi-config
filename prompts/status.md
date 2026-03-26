---
description: Show current work status across all worktrees and active branches
---
Show a status dashboard of all git worktrees:

```bash
git worktree list
```

For each worktree, report:
1. Branch name and associated issue/ticket
2. Dirty/clean state (uncommitted changes)
3. Ahead/behind remote
4. Last commit message and date
5. Running docker containers (if any)

Also check `thoughts/shared/handoffs/` for the latest handoff per issue to show current status.

Present as a compact, scannable table.
