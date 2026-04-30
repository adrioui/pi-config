---
description: Create a development worktree using the repo helper script and print the next command to run
---
Create a development worktree.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

If no arguments were provided, ask for `worktree_name [base_branch] [plan_path optional]` and stop.

Workflow:
1. Read `hack/create_worktree.sh` first and follow its real CLI contract.
2. Parse the arguments as:
   - required: worktree name
   - optional: base branch
   - optional: plan path (for next-step instructions only)
3. Show the resolved inputs before executing anything risky if the intent is not crystal clear.
4. If safe and explicit, run `./hack/create_worktree.sh <worktree_name> [base_branch]`.
5. Report the created worktree path, script output, and exact next commands.
6. If a plan path was provided, print the exact `/implement_plan <relative-or-given-plan-path>` command to run inside the worktree.

Rules:
- Do not auto-launch a nested Pi session.
- If the helper script fails, show the failure and provide cleanup guidance.
