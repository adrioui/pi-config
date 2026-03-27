---
description: Show current work status across all worktrees and active branches
---
Show a status dashboard of all git worktrees.

Arguments: $@

Special case: if the arguments explicitly ask for a pi-web capability check, do that first with `web_search`, `fetch_content`, or `code_search`, then return the result without building the full dashboard.

Primary local command:

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

Stay local by default. If the user explicitly asks for external context, remote service docs, or a pi-web capability check, use `web_search`, `fetch_content`, or `code_search` in addition to the local status checks.
