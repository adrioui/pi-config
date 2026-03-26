---
description: Create a local review worktree for a colleague branch from username:branch input
---
Set up a local review worktree for a colleague branch.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

If no argument was provided, ask for `github_username:branch_name` and stop.

Workflow:
1. Parse the argument as `username:branch`.
2. Inspect git remotes and derive the repository slug from `git remote get-url origin`.
3. Derive a short worktree directory name from a ticket slug in the branch name or from a sanitized branch suffix.
4. If safe and explicit, run the git remote/fetch/worktree steps inline.
5. If the repo has any documented Pi-specific local setup steps, surface them; otherwise rely on the worktree contents as-is.
6. If the repo appears to support `make setup`, try it and report the exact result.
7. Finish with remote name, fetched branch, worktree path, setup status, next commands, and cleanup commands if needed.

Rules:
- Do not auto-launch another session.
- Stop and ask if the requested remote/branch cannot be resolved cleanly.
