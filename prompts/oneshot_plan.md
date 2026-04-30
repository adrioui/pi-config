---
description: Create a plan, then optionally prepare implementation when a reviewed plan exists
---
Run the plan-then-implementation-prep workflow.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

If no ticket or plan path was provided, ask for it and whether the plan is already approved.

Workflow:
1. Resolve the ticket or plan path.
2. Prefer the `oneshot_plan` subagent chain for the default plan-generation step unless the task clearly needs a more manual workflow.
3. If no reviewed plan exists yet, create or update the plan and stop for human review.
4. If the user confirms that an approved plan already exists, continue into implementation prep inline:
   - resolve the plan
   - prepare the worktree
   - print the exact next `/implement_plan ...` command
5. Do not implement code, auto-commit, or auto-create a PR here.
6. End by stating whether you stopped at the review gate or reached implementation prep.
